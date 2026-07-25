"use client";

import { create } from "zustand";
import {
  buildRecommendation,
  computeCorrelationMatrix,
  generateProcessState,
  optimizeSetpoints,
  predictOffSpecRisk,
  type FeedbackEntry,
  type ProcessInputs,
  type ProcessState,
  type Recommendation,
  type RejectReason,
} from "@/lib/gradeChangeEngine";

// NOTE: socket.io-client is imported lazily inside startSimulationLoop() so
// that this module remains SSR-safe. Importing it at the top level causes
// a client-side hydration crash because Next.js evaluates "use client"
// modules on the server during the initial HTML render, and the package
// touches `window`/`navigator` on import.
type Socket = { connected: boolean; emit: (e: string, d?: unknown) => void; disconnect: () => void; on: (e: string, cb: (...a: unknown[]) => void) => void };

const MAX_HISTORY = 60; // ~60 ticks of trajectory history
const TICK_MS = 1500;
const QCS_WS_PORT = 3030; // mini-service port; routed through Caddy via XTransformPort

interface GradeChangeStore {
  // live inputs (operator-adjustable)
  inputs: ProcessInputs;
  setInput: (key: keyof ProcessInputs, value: number) => void;
  applyInputs: (inputs: ProcessInputs) => void;

  // live state & history
  current: ProcessState;
  history: ProcessState[];
  recommendation: Recommendation;

  // simulation control
  running: boolean;
  toggleRunning: () => void;
  tick: () => void;

  // operator feedback
  feedbackLog: FeedbackEntry[];
  acceptRecommendation: () => Promise<void>;
  rejectRecommendation: (reason: RejectReason) => Promise<void>;
  hydrateFeedbackFromServer: () => Promise<void>;

  // model retraining indicator
  retrainingProgress: number; // 0..100
  retrainingCount: number;
  lastRetrainedAt: number | null;

  // backend connectivity
  backendStatus: "connecting" | "live" | "fallback" | "offline";
  wsConnected: boolean;
}

const DEFAULT_INPUTS: ProcessInputs = {
  stock_flow: 150,
  filler_flow: 25,
  steam_pressure: 3.5,
  machine_speed: 550,
};

/**
 * Deterministic initial state — used for both the server render and the
 * first client render so hydration matches. The random history is seeded
 * inside startSimulationLoop() once we're on the client.
 */
function deterministicInitialState(inputs: ProcessInputs): ProcessState {
  const bw_target =
    inputs.stock_flow * 0.5 +
    inputs.steam_pressure * 2.0 -
    inputs.machine_speed * 0.05;
  const actual_bw = bw_target; // no noise — matches server render exactly
  const deviation_pct = 0;
  return {
    ...inputs,
    bw_target,
    actual_bw,
    deviation_pct,
    is_off_spec: false,
    timestamp: 0, // fixed — real timestamps only on client ticks
  };
}

function emptyHistory(inputs: ProcessInputs): ProcessState[] {
  // Return an array of deterministic placeholder states so the chart has
  // something to render on first paint. The real seeded history replaces
  // these on the client.
  const placeholder = deterministicInitialState(inputs);
  return Array.from({ length: MAX_HISTORY }, (_, i) => ({
    ...placeholder,
    timestamp: -((MAX_HISTORY - i) * TICK_MS),
  }));
}

function seedHistory(inputs: ProcessInputs): ProcessState[] {
  const out: ProcessState[] = [];
  for (let i = MAX_HISTORY; i > 0; i--) {
    const state = generateProcessState(inputs, 2.5, (Math.random() - 0.5) * 1.2);
    state.timestamp = Date.now() - i * TICK_MS;
    out.push(state);
  }
  return out;
}

// Module-level WebSocket handle — single connection per page load.
let qcsSocket: Socket | null = null;
// Tracks whether we've already logged the QCS connection error this session
// so the console doesn't fill with retry noise.
let qcsConnectErrorLogged = false;

export const useGradeChangeStore = create<GradeChangeStore>((set, get) => ({
  inputs: DEFAULT_INPUTS,
  setInput: (key, value) => {
    const next = { ...get().inputs, [key]: value };
    set({ inputs: next });
    get().tick();
    // Forward operator overrides to the QCS bridge so the live stream
    // reflects the new setpoints.
    if (qcsSocket?.connected) {
      qcsSocket.emit("qcs:setpoint", { [key]: value });
    }
  },
  applyInputs: (inputs) => {
    set({ inputs });
    get().tick();
    if (qcsSocket?.connected) {
      qcsSocket.emit("qcs:setpoint", inputs);
    }
  },

  current: deterministicInitialState(DEFAULT_INPUTS),
  history: emptyHistory(DEFAULT_INPUTS),
  recommendation: buildRecommendation(DEFAULT_INPUTS),

  running: true,
  toggleRunning: () => set((s) => ({ running: !s.running })),
  tick: () => {
    const { inputs, history } = get();
    const state = generateProcessState(inputs);
    const recommendation = buildRecommendation(inputs);
    const nextHistory = [...history.slice(-(MAX_HISTORY - 1)), state];
    set({ current: state, history: nextHistory, recommendation });
  },

  feedbackLog: [],
  acceptRecommendation: async () => {
    const { recommendation, inputs, feedbackLog, retrainingCount, current } = get();
    // 1) Optimistic update — instant UI feedback
    const optimisticEntry: FeedbackEntry = {
      id: `FB-${Date.now().toString(36).toUpperCase()}`,
      timestamp: Date.now(),
      recommendation_id: recommendation.id,
      risk_prob: recommendation.risk_prob,
      action: "Accepted",
      inputs_snapshot: inputs,
      applied_stock_flow: recommendation.adjustments.suggested_stock_flow,
    };
    const nextInputs: ProcessInputs = {
      ...inputs,
      stock_flow: recommendation.adjustments.suggested_stock_flow,
      machine_speed: recommendation.adjustments.suggested_machine_speed,
    };
    set({
      feedbackLog: [optimisticEntry, ...feedbackLog].slice(0, 100),
      inputs: nextInputs,
      retrainingCount: retrainingCount + 1,
      lastRetrainedAt: Date.now(),
      retrainingProgress: 0,
    });
    get().tick();

    // 2) Persist to backend (fire-and-forget with reconciliation)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: recommendation.id,
          action: "Accepted",
          inputs_snapshot: inputs,
          risk_prob: recommendation.risk_prob,
          bw_target: current.bw_target,
          actual_bw: current.actual_bw,
          deviation_pct: current.deviation_pct,
          is_off_spec: current.is_off_spec,
          suggested_stock_flow: recommendation.adjustments.suggested_stock_flow,
          suggested_machine_speed: recommendation.adjustments.suggested_machine_speed,
          applied_stock_flow: recommendation.adjustments.suggested_stock_flow,
          applied_machine_speed: recommendation.adjustments.suggested_machine_speed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reconcile: replace optimistic id with the server-generated id and
        // pull the authoritative retraining count.
        set((s) => ({
          feedbackLog: s.feedbackLog.map((e) =>
            e.id === optimisticEntry.id ? { ...e, id: data.id } : e
          ),
          retrainingCount: data.retraining_count ?? s.retrainingCount,
        }));
      }
    } catch (err) {
      // Offline / DB-down — keep the optimistic entry, log to console.
      console.warn("[feedback] accept persist failed (offline mode):", err);
    }
  },
  rejectRecommendation: async (reason) => {
    const { recommendation, inputs, feedbackLog, current } = get();
    const optimisticEntry: FeedbackEntry = {
      id: `FB-${Date.now().toString(36).toUpperCase()}`,
      timestamp: Date.now(),
      recommendation_id: recommendation.id,
      risk_prob: recommendation.risk_prob,
      action: "Rejected",
      reject_reason: reason,
      inputs_snapshot: inputs,
    };
    set({ feedbackLog: [optimisticEntry, ...feedbackLog].slice(0, 100) });

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: recommendation.id,
          action: "Rejected",
          reject_reason: reason,
          inputs_snapshot: inputs,
          risk_prob: recommendation.risk_prob,
          bw_target: current.bw_target,
          actual_bw: current.actual_bw,
          deviation_pct: current.deviation_pct,
          is_off_spec: current.is_off_spec,
          suggested_stock_flow: recommendation.adjustments.suggested_stock_flow,
          suggested_machine_speed: recommendation.adjustments.suggested_machine_speed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        set((s) => ({
          feedbackLog: s.feedbackLog.map((e) =>
            e.id === optimisticEntry.id ? { ...e, id: data.id } : e
          ),
        }));
      }
    } catch (err) {
      console.warn("[feedback] reject persist failed (offline mode):", err);
    }
  },
  hydrateFeedbackFromServer: async () => {
    try {
      const res = await fetch("/api/feedback?limit=50", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        const entries: FeedbackEntry[] = data.entries.map((e: any) => ({
          id: e.id,
          timestamp: new Date(e.timestamp).getTime(),
          recommendation_id: e.recommendation_id,
          risk_prob: e.risk_prob,
          action: e.action,
          reject_reason: e.reject_reason,
          inputs_snapshot: e.inputs_snapshot,
          applied_stock_flow: e.applied_stock_flow,
        }));
        // Merge: keep optimistic entries that haven't been reconciled yet,
        // append server-only entries, dedupe by id.
        set((s) => {
          const localIds = new Set(s.feedbackLog.map((e) => e.id));
          const merged = [
            ...s.feedbackLog,
            ...entries.filter((e) => !localIds.has(e.id)),
          ].slice(0, 100);
          return { feedbackLog: merged };
        });
      }
      // Pull stats too
      const statsRes = await fetch("/api/feedback/stats", { cache: "no-store" });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (stats.retraining_count) {
          set({ retrainingCount: stats.retraining_count });
        }
        if (stats.last_retrained_at) {
          set({ lastRetrainedAt: new Date(stats.last_retrained_at).getTime() });
        }
      }
    } catch (err) {
      console.warn("[feedback] hydrate failed (offline mode):", err);
    }
  },

  retrainingProgress: 100,
  retrainingCount: 0,
  lastRetrainedAt: null,

  backendStatus: "connecting",
  wsConnected: false,
}));

/**
 * Drives the real-time simulation loop.
 *
 * Strategy:
 *   1. Try to connect to the QCS WebSocket mini-service (port 3030). If it
 *      connects, every "qcs:sample" event replaces the synthetic tick —
 *      the dashboard is then driven by the "live" feed.
 *   2. If the WS fails to connect within 3s, fall back to the local
 *      synthetic generator so the dashboard is always animated, even in
 *      standalone demos without the mini-service running.
 *   3. Either way, the retraining progress bar advances every tick.
 */
export async function startSimulationLoop() {
  if (typeof window === "undefined") return () => {};

  // --- Seed real history on the client (replaces the deterministic
  //     placeholder history that SSR rendered). This runs once, before
  //     the first tick, so the chart immediately shows realistic data. ---
  useGradeChangeStore.setState((s) => ({
    history: seedHistory(s.inputs),
    current: generateProcessState(s.inputs),
  }));

  // --- WS connection attempt ---
  // Dynamic import keeps socket.io-client out of the SSR bundle — the
  // package is browser-only and crashes hydration if evaluated on the server.
  try {
    const { io: initSocket } = await import("socket.io-client");
    qcsSocket = initSocket({
      path: "/",
      query: { XTransformPort: QCS_WS_PORT },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 3000,
    }) as unknown as Socket;

    qcsSocket.on("connect", () => {
      useGradeChangeStore.setState({
        wsConnected: true,
        backendStatus: "live",
      });
      console.log("[qcs] live stream connected");
    });

    qcsSocket.on("disconnect", () => {
      useGradeChangeStore.setState({
        wsConnected: false,
        backendStatus: "fallback",
      });
      console.warn("[qcs] live stream disconnected — falling back to synthetic tick");
    });

    qcsSocket.on("qcs:sample", (sample: ProcessState) => {
      const store = useGradeChangeStore.getState();
      if (!store.running) return;
      // The WS sample already contains all ProcessState fields; use it directly
      // but rebuild the recommendation from the inputs to keep the engine
      // attribution consistent with what the operator sees.
      const recommendation = buildRecommendation({
        stock_flow: sample.stock_flow,
        filler_flow: sample.filler_flow,
        steam_pressure: sample.steam_pressure,
        machine_speed: sample.machine_speed,
      });
      const nextHistory = [...store.history.slice(-(MAX_HISTORY - 1)), sample];
      useGradeChangeStore.setState({
        current: sample,
        history: nextHistory,
        recommendation,
        inputs: {
          stock_flow: sample.stock_flow,
          filler_flow: sample.filler_flow,
          steam_pressure: sample.steam_pressure,
          machine_speed: sample.machine_speed,
        },
      });
    });

    qcsSocket.on("connect_error", (err: unknown) => {
      // Suppress noisy transport errors — the socket.io reconnection logic
      // will keep retrying, and the synthetic fallback keeps the dashboard
      // animated in the meantime. Only log once per session.
      if (!qcsConnectErrorLogged) {
        qcsConnectErrorLogged = true;
        console.info(
          "[qcs] live stream unavailable — dashboard running on synthetic fallback. " +
            "Start the QCS mini-service (mini-services/qcs-stream) for live data."
        );
      }
      useGradeChangeStore.setState({ backendStatus: "fallback", wsConnected: false });
    });
  } catch (err) {
    console.warn("[qcs] WS init failed, using synthetic fallback:", err);
    useGradeChangeStore.setState({ backendStatus: "fallback" });
  }

  // --- Local tick loop (used as fallback and to advance retraining) ---
  const interval = setInterval(() => {
    const store = useGradeChangeStore.getState();
    // Only run the synthetic tick if we're NOT receiving live WS samples
    if (store.running && !store.wsConnected) {
      store.tick();
    }
    if (store.retrainingProgress < 100) {
      useGradeChangeStore.setState({
        retrainingProgress: Math.min(100, store.retrainingProgress + 8),
      });
    }
  }, TICK_MS);

  // --- Hydrate audit trail from server on mount ---
  useGradeChangeStore.getState().hydrateFeedbackFromServer();

  return () => {
    clearInterval(interval);
    qcsSocket?.disconnect();
    qcsSocket = null;
  };
}

/**
 * Selector helper: compute the rolling correlation matrix from history.
 */
export function selectCorrelationMatrix() {
  const history = useGradeChangeStore.getState().history;
  return computeCorrelationMatrix(history);
}

export { predictOffSpecRisk, optimizeSetpoints };
