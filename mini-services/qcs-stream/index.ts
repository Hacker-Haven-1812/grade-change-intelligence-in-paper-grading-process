/**
 * GradeChange AI — QCS Live Stream Mini-Service
 * =============================================
 * A standalone Socket.io server that emulates a Honeywell QCS / DCS
 * Historian feed for the dashboard. In a real deployment this service
 * would subscribe to the OPC-UA / Modbus bridge and forward tags
 * verbatim; here it generates a synthetic but physics-informed stream
 * so the dashboard has a live data source to render against.
 *
 * Port: 3030 (must match the XTransformPort query used by the frontend).
 *
 * Events emitted (server → client):
 *   - "qcs:sample"   { timestamp, stock_flow, filler_flow, steam_pressure,
 *                      machine_speed, bw_target, actual_bw, deviation_pct,
 *                      is_off_spec, risk_prob }
 *   - "qcs:status"   { ok: true, lineId: "PM-04", tickMs: 1500 }
 *
 * Events received (client → server):
 *   - "qcs:setpoint" { stock_flow?, machine_speed? }   (operator override)
 *   - "qcs:scenario" { scenarioId: "A-to-B" | "B-to-C" | ... }
 */

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3030;
const TICK_MS = 1500;

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ---------------------------------------------------------------------------
// Physics-informed synthetic generator (mirrors the client engine so the
// dashboard can run in "live" mode without needing a backend ML call per tick)
// ---------------------------------------------------------------------------
type Inputs = {
  stock_flow: number;
  filler_flow: number;
  steam_pressure: number;
  machine_speed: number;
};

const RANGES: Record<keyof Inputs, [number, number]> = {
  stock_flow: [100, 200],
  filler_flow: [10, 50],
  steam_pressure: [2.0, 5.0],
  machine_speed: [300, 800],
};

const MODEL_WEIGHTS: Record<keyof Inputs, number> = {
  stock_flow: 0.045,
  steam_pressure: 0.78,
  machine_speed: -0.0042,
  filler_flow: 0.018,
};
const MODEL_BIAS = -7.8;

function scaleFeature(k: keyof Inputs, v: number): number {
  const [lo, hi] = RANGES[k];
  return (v - (lo + hi) / 2) / ((hi - lo) / 2);
}

function predictRisk(inputs: Inputs): number {
  const z =
    (Object.keys(MODEL_WEIGHTS) as (keyof Inputs)[])
      .reduce((acc, k) => acc + MODEL_WEIGHTS[k] * scaleFeature(k, inputs[k]), 0) +
    MODEL_BIAS;
  const risk = 1 / (1 + Math.exp(-z));
  const steamDanger = Math.max(0, inputs.steam_pressure - 4.3) * 0.6;
  return Math.max(0, Math.min(1, risk + steamDanger));
}

function gaussian(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std + mean;
}

function computeTargetBW(inputs: Inputs): number {
  return inputs.stock_flow * 0.5 + inputs.steam_pressure * 2.0 - inputs.machine_speed * 0.05;
}

function generateSample(inputs: Inputs) {
  const bw_target = computeTargetBW(inputs);
  const steamBias = (inputs.steam_pressure - 3.5) * 1.2;
  const actual_bw = bw_target + steamBias + gaussian(0, 2.5) + (Math.random() - 0.5) * 1.5;
  const deviation_pct = (Math.abs(actual_bw - bw_target) / Math.max(bw_target, 1)) * 100;
  return {
    timestamp: Date.now(),
    stock_flow: inputs.stock_flow,
    filler_flow: inputs.filler_flow,
    steam_pressure: inputs.steam_pressure,
    machine_speed: inputs.machine_speed,
    bw_target,
    actual_bw,
    deviation_pct,
    is_off_spec: deviation_pct > 2.5,
    risk_prob: predictRisk(inputs),
  };
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------
const SCENARIOS: Record<string, Inputs> = {
  "A-to-B": { stock_flow: 145, filler_flow: 24, steam_pressure: 3.3, machine_speed: 540 },
  "B-to-C": { stock_flow: 178, filler_flow: 38, steam_pressure: 4.5, machine_speed: 690 },
  "C-to-D": { stock_flow: 192, filler_flow: 46, steam_pressure: 4.7, machine_speed: 760 },
  recovery: { stock_flow: 168, filler_flow: 31, steam_pressure: 4.1, machine_speed: 620 },
};

let currentInputs: Inputs = {
  stock_flow: 150,
  filler_flow: 25,
  steam_pressure: 3.5,
  machine_speed: 550,
};

io.on("connection", (socket) => {
  console.log(`[qcs-stream] client connected: ${socket.id}`);

  // Send current status on connect
  socket.emit("qcs:status", { ok: true, lineId: "PM-04", tickMs: TICK_MS });

  // Handle operator setpoint overrides
  socket.on("qcs:setpoint", (data: Partial<Inputs>) => {
    if (typeof data?.stock_flow === "number") {
      currentInputs.stock_flow = clamp(data.stock_flow, ...RANGES.stock_flow);
    }
    if (typeof data?.machine_speed === "number") {
      currentInputs.machine_speed = clamp(data.machine_speed, ...RANGES.machine_speed);
    }
    if (typeof data?.steam_pressure === "number") {
      currentInputs.steam_pressure = clamp(data.steam_pressure, ...RANGES.steam_pressure);
    }
    if (typeof data?.filler_flow === "number") {
      currentInputs.filler_flow = clamp(data.filler_flow, ...RANGES.filler_flow);
    }
    console.log(`[qcs-stream] setpoint override:`, currentInputs);
  });

  // Handle scenario switches
  socket.on("qcs:scenario", (data: { scenarioId: string }) => {
    const scenario = SCENARIOS[data?.scenarioId];
    if (scenario) {
      currentInputs = { ...scenario };
      console.log(`[qcs-stream] scenario → ${data.scenarioId}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[qcs-stream] client disconnected: ${socket.id} (${reason})`);
  });
});

// ---------------------------------------------------------------------------
// Tick loop — broadcast a fresh sample to all connected clients every TICK_MS
// ---------------------------------------------------------------------------
setInterval(() => {
  const sample = generateSample(currentInputs);
  io.emit("qcs:sample", sample);
}, TICK_MS);

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

httpServer.listen(PORT, () => {
  console.log(`[qcs-stream] GradeChange QCS stream service listening on :${PORT}`);
  console.log(`[qcs-stream] tick=${TICK_MS}ms · line=PM-04 · path=/`);
});
