"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Crosshair } from "lucide-react";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";

export function TrajectoryChart() {
  const history = useGradeChangeStore((s) => s.history);
  const current = useGradeChangeStore((s) => s.current);

  // Build chart data: actual BW, target BW, ±2.5% control limits, predicted forward window
  const data = useMemo(() => {
    return history.map((s, i) => {
      const target = s.bw_target;
      const upper = target * 1.025;
      const lower = target * 0.975;
      return {
        idx: i,
        time: new Date(s.timestamp).toLocaleTimeString("en-GB", { hour12: false }).slice(3),
        actual: Number(s.actual_bw.toFixed(2)),
        target: Number(target.toFixed(2)),
        upper: Number(upper.toFixed(2)),
        lower: Number(lower.toFixed(2)),
        isOff: s.is_off_spec,
      };
    });
  }, [history]);

  // Forward predicted trajectory — linear extrapolation from current state with decay
  const predicted = useMemo(() => {
    const lookahead = 12; // ~18 s forward
    const risk = useGradeChangeStore.getState().recommendation.risk_prob;
    const start = current.actual_bw;
    const target = current.bw_target;
    const pts: { idx: number; predicted: number; time: string }[] = [];
    const baseIdx = history.length;
    for (let i = 1; i <= lookahead; i++) {
      // The model assumes the recommended action will move BW toward target
      // exponentially; risk modulates the convergence rate.
      const convergence = 1 - Math.exp(-i / (8 * (1 - risk + 0.2)));
      const v = start + (target - start) * convergence + (Math.random() - 0.5) * risk * 2;
      pts.push({
        idx: baseIdx + i,
        predicted: Number(v.toFixed(2)),
        time: `+${i * 1.5}s`,
      });
    }
    return pts;
  }, [history, current]);

  const merged = [...data, ...predicted];

  // Y domain — pad around the max/min of actual + limits
  const allVals = merged.flatMap((d) =>
    "actual" in d ? [d.actual, d.upper, d.lower] : [d.predicted]
  );
  const yMin = Math.floor(Math.min(...allVals) - 2);
  const yMax = Math.ceil(Math.max(...allVals) + 2);

  return (
    <section className="glass-panel rounded-lg p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Real-Time Basis Weight Trajectory
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Predicted vs actual with ±2.5% specification envelope · 90 s rolling window
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <LegendDot color="bg-primary" label="Actual BW" />
          <LegendDot color="bg-sky-400" label="Setpoint" />
          <LegendDot color="bg-amber-400" label="Predicted" dashed />
          <LegendDot color="bg-red-500/40" label="Spec Limit" dashed />
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="specBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="oklch(0.32 0.02 250 / 30%)" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "oklch(0.65 0.01 250)", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "oklch(0.32 0.02 250 / 50%)" }}
              axisLine={{ stroke: "oklch(0.32 0.02 250 / 50%)" }}
              interval="preserveStartEnd"
              minTickGap={36}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: "oklch(0.65 0.01 250)", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "oklch(0.32 0.02 250 / 50%)" }}
              axisLine={{ stroke: "oklch(0.32 0.02 250 / 50%)" }}
              label={{
                value: "g/m²",
                angle: -90,
                position: "insideLeft",
                fill: "oklch(0.65 0.01 250)",
                fontSize: 10,
              }}
            />
            <Tooltip content={<TrajectoryTooltip />} />

            {/* Spec band */}
            <ReferenceArea
              y1={current.bw_target * 0.975}
              y2={current.bw_target * 1.025}
              fill="url(#specBand)"
              strokeOpacity={0}
            />

            <Line
              type="monotone"
              dataKey="upper"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="lower"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeDasharray="2 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#f59e0b"
              strokeWidth={2.2}
              dot={(props) => {
                const { cx, cy, payload, index } = props;
                if (payload.isOff) {
                  return (
                    <circle
                      key={`dot-off-${payload.idx ?? index}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#ef4444"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  );
                }
                return <g key={`dot-${payload.idx ?? index}`} />;
              }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#fbbf24"
              strokeWidth={1.8}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
            />

            {/* Vertical marker at "now" */}
            <ReferenceLine x={data[data.length - 1]?.time} stroke="#f59e0b" strokeOpacity={0.4} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Crosshair className="h-3 w-3 text-primary" />
          NOW · {data[data.length - 1]?.time ?? "--:--"}
        </span>
        <span>
          Window: 90 s · Tick: 1.5 s · Forward prediction horizon: 18 s
        </span>
      </div>
    </section>
  );
}

function TrajectoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload ?? {};
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 p-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1 font-mono text-[10px] text-muted-foreground">{label}</div>
      {p.actual !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-primary">● Actual BW</span>
          <span className="font-mono font-semibold">{p.actual} g/m²</span>
        </div>
      )}
      {p.predicted !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-amber-300">● Predicted</span>
          <span className="font-mono font-semibold">{p.predicted} g/m²</span>
        </div>
      )}
      {p.target !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sky-300">● Setpoint</span>
          <span className="font-mono">{p.target} g/m²</span>
        </div>
      )}
      {p.upper !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-red-300">● Spec ±2.5%</span>
          <span className="font-mono text-[10px]">
            [{p.lower}, {p.upper}]
          </span>
        </div>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span
        className={`inline-block ${color} ${dashed ? "border-t-2 border-dashed" : ""}`}
        style={{
          width: 14,
          height: dashed ? 0 : 3,
          borderRadius: dashed ? 0 : 2,
          borderColor: color.replace("bg-", ""),
        }}
      />
      {label}
    </span>
  );
}
