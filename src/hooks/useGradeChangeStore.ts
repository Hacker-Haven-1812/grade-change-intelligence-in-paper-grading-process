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

const MAX_HISTORY = 60; // ~60 ticks of trajectory history
const TICK_MS = 1500;

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
  acceptRecommendation: () => void;
  rejectRecommendation: (reason: RejectReason) => void;

  // model retraining indicator
  retrainingProgress: number; // 0..100
  retrainingCount: number;
  lastRetrainedAt: number | null;
}

const DEFAULT_INPUTS: ProcessInputs = {
  stock_flow: 150,
  filler_flow: 25,
  steam_pressure: 3.5,
  machine_speed: 550,
};

function seedHistory(inputs: ProcessInputs): ProcessState[] {
  const out: ProcessState[] = [];
  for (let i = MAX_HISTORY; i > 0; i--) {
    const state = generateProcessState(inputs, 2.5, (Math.random() - 0.5) * 1.2);
    state.timestamp = Date.now() - i * TICK_MS;
    out.push(state);
  }
  return out;
}

export const useGradeChangeStore = create<GradeChangeStore>((set, get) => ({
  inputs: DEFAULT_INPUTS,
  setInput: (key, value) => {
    const next = { ...get().inputs, [key]: value };
    set({ inputs: next });
    get().tick(); // immediately refresh derived state when operator moves a slider
  },
  applyInputs: (inputs) => {
    set({ inputs });
    get().tick();
  },

  current: generateProcessState(DEFAULT_INPUTS),
  history: seedHistory(DEFAULT_INPUTS),
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
  acceptRecommendation: () => {
    const { recommendation, inputs, feedbackLog, retrainingCount } = get();
    const entry: FeedbackEntry = {
      id: `FB-${Date.now().toString(36).toUpperCase()}`,
      timestamp: Date.now(),
      recommendation_id: recommendation.id,
      risk_prob: recommendation.risk_prob,
      action: "Accepted",
      inputs_snapshot: inputs,
      applied_stock_flow: recommendation.adjustments.suggested_stock_flow,
    };
    // Apply the recommended stock flow to the live inputs (closed-loop)
    const nextInputs: ProcessInputs = {
      ...inputs,
      stock_flow: recommendation.adjustments.suggested_stock_flow,
      machine_speed: recommendation.adjustments.suggested_machine_speed,
    };
    set({
      feedbackLog: [entry, ...feedbackLog].slice(0, 100),
      inputs: nextInputs,
      retrainingCount: retrainingCount + 1,
      lastRetrainedAt: Date.now(),
      retrainingProgress: 0,
    });
    get().tick();
  },
  rejectRecommendation: (reason) => {
    const { recommendation, inputs, feedbackLog } = get();
    const entry: FeedbackEntry = {
      id: `FB-${Date.now().toString(36).toUpperCase()}`,
      timestamp: Date.now(),
      recommendation_id: recommendation.id,
      risk_prob: recommendation.risk_prob,
      action: "Rejected",
      reject_reason: reason,
      inputs_snapshot: inputs,
    };
    set({
      feedbackLog: [entry, ...feedbackLog].slice(0, 100),
    });
  },

  retrainingProgress: 100,
  retrainingCount: 0,
  lastRetrainedAt: null,
}));

/**
 * Drives the real-time simulation loop. Call once near the root of the app.
 */
export function startSimulationLoop() {
  if (typeof window === "undefined") return () => {};
  const interval = setInterval(() => {
    const store = useGradeChangeStore.getState();
    if (store.running) {
      store.tick();
    }
    // Incrementally advance retraining progress when an accept has triggered it
    if (store.retrainingProgress < 100) {
      useGradeChangeStore.setState({
        retrainingProgress: Math.min(100, store.retrainingProgress + 8),
      });
    }
  }, TICK_MS);
  return () => clearInterval(interval);
}

/**
 * Selector helper: compute the rolling correlation matrix from history.
 */
export function selectCorrelationMatrix() {
  const history = useGradeChangeStore.getState().history;
  return computeCorrelationMatrix(history);
}

export { predictOffSpecRisk, optimizeSetpoints };
