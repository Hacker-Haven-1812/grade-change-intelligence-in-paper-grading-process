"use client";

import { useEffect } from "react";
import { Header } from "@/components/grade-change/Header";
import { SidebarControls } from "@/components/grade-change/SidebarControls";
import { RiskGauge, KPICards } from "@/components/grade-change/RiskGauge";
import { TrajectoryChart } from "@/components/grade-change/TrajectoryChart";
import { RecommendationCard } from "@/components/grade-change/RecommendationCard";
import { ShapChart, CorrelationHeatmap } from "@/components/grade-change/ShapChart";
import { FeedbackAuditTrail } from "@/components/grade-change/FeedbackAuditTrail";
import { startSimulationLoop, useGradeChangeStore } from "@/hooks/useGradeChangeStore";

export default function Home() {
  useEffect(() => {
    // startSimulationLoop is async because it dynamically imports
    // socket.io-client (browser-only). We don't await it — the cleanup
    // function is captured and returned to React.
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    startSimulationLoop().then((fn) => {
      if (cancelled) {
        fn?.();
      } else {
        cleanup = fn;
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="relative min-h-screen grid-bg">
      {/* Subtle radial gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.78 0.16 70 / 8%), transparent), radial-gradient(ellipse 60% 40% at 90% 110%, oklch(0.62 0.16 250 / 10%), transparent)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />

        <main className="flex-1 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row">
            {/* Sidebar */}
            <SidebarControls />

            {/* Main dashboard */}
            <div className="flex-1 space-y-5">
              {/* Top row: risk gauge + KPI cards */}
              <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
                <RiskGauge />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h1 className="text-base font-bold tracking-tight text-foreground">
                      Grade Transition Cockpit
                    </h1>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Line 3 · PM-04 · Recipe v18.2
                    </span>
                  </div>
                  <KPICards />
                  <CurrentStateStrip />
                </div>
              </div>

              {/* Middle row: trajectory + recommendation */}
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <TrajectoryChart />
                <RecommendationCard />
              </div>

              {/* Bottom row: SHAP + correlation + audit trail */}
              <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                <ShapChart />
                <CorrelationHeatmap />
                <div className="lg:col-span-2 xl:col-span-1">
                  <FeedbackAuditTrail />
                </div>
              </div>

              <FooterNote />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function CurrentStateStrip() {
  const current = useGradeChangeStore((s) => s.current);
  const inputs = useGradeChangeStore((s) => s.inputs);

  const cells = [
    { label: "Actual BW", value: current.actual_bw.toFixed(2), unit: "g/m²", tone: current.is_off_spec ? "red" : "default" },
    { label: "Target BW", value: current.bw_target.toFixed(2), unit: "g/m²", tone: "default" },
    { label: "Deviation", value: `${current.deviation_pct.toFixed(2)}%`, unit: "", tone: current.is_off_spec ? "red" : "emerald" },
    { label: "Steam", value: inputs.steam_pressure.toFixed(2), unit: "bar", tone: inputs.steam_pressure > 4.3 ? "amber" : "default" },
    { label: "Speed", value: inputs.machine_speed.toFixed(0), unit: "m/min", tone: "default" },
    { label: "Stock", value: inputs.stock_flow.toFixed(1), unit: "L/min", tone: "default" },
  ] as const;

  return (
    <div className="glass-panel grid grid-cols-3 gap-2 rounded-lg p-3 sm:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className="text-center">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {c.label}
          </div>
          <div
            className={
              "mt-0.5 font-mono text-sm font-bold tabular-nums " +
              (c.tone === "red"
                ? "text-red-400 text-glow-red"
                : c.tone === "amber"
                ? "text-amber-400"
                : c.tone === "emerald"
                ? "text-emerald-400"
                : "text-foreground")
            }
          >
            {c.value}
            <span className="ml-0.5 text-[9px] text-muted-foreground">{c.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FooterNote() {
  return (
    <footer className="flex flex-col items-start justify-between gap-2 border-t border-border/40 pt-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 led-pulse text-emerald-400" />
        <span className="font-mono">
          System nominal · Inference latency 142 ms · QCS link 200 Hz · 14 sensors active
        </span>
      </div>
      <div className="font-mono">
        GradeChange AI © 2026 · Predictive Quality Control Overlay · v1.0.0
      </div>
    </footer>
  );
}
