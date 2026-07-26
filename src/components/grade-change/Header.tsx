"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, Radio, ServerCog, Wifi } from "lucide-react";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";

export function Header() {
  const running = useGradeChangeStore((s) => s.running);
  const toggleRunning = useGradeChangeStore((s) => s.toggleRunning);
  const retrainingCount = useGradeChangeStore((s) => s.retrainingCount);
  const wsConnected = useGradeChangeStore((s) => s.wsConnected);
  const backendStatus = useGradeChangeStore((s) => s.backendStatus);
  // Render a fixed placeholder clock until the client mounts — avoids
  // server/client hydration mismatch on the live timestamp.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now
    ? now.toLocaleTimeString("en-GB", { hour12: false })
    : "--:--:--";

  // Map backendStatus to the QCS / DCS pill tones — they reflect the real
  // state of the live stream + REST API connection.
  const qcsTone: "emerald" | "amber" | "red" =
    wsConnected ? "emerald" : backendStatus === "fallback" ? "amber" : "red";
  const qcsDetail = wsConnected ? "LIVE · 200 Hz" : backendStatus === "fallback" ? "SIM · 1.5 Hz" : "OFFLINE";
  const dcsTone: "emerald" | "amber" = backendStatus === "live" || backendStatus === "fallback" ? "emerald" : "amber";
  const dcsDetail = backendStatus === "offline" ? "DEGRADED" : "STREAMING";

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-border/60">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
            <Activity className="h-5 w-5 text-primary" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary led-pulse text-primary" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wider text-foreground">
                GRADECHANGE
              </span>
              <span className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
                AI
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Predictive Quality Control · v2.4.1
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="ml-2 hidden items-center gap-2 lg:flex">
          <StatusPill
            icon={<ServerCog className="h-3.5 w-3.5" />}
            label="Honeywell QCS"
            tone={qcsTone}
            detail={qcsDetail}
          />
          <StatusPill
            icon={<Radio className="h-3.5 w-3.5" />}
            label="DCS Historian"
            tone={dcsTone}
            detail={dcsDetail}
          />
          <StatusPill
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="Inference Engine"
            tone="amber"
            detail={`RETRAINS · ${retrainingCount}`}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Live clock */}
          <div className="hidden md:flex flex-col items-end leading-none">
            <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {clock}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Plant Local Time · UTC+05:30
            </span>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={toggleRunning}
            className={`group flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              running
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            }`}
            aria-label={running ? "Pause live simulation" : "Resume live simulation"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                running ? "bg-emerald-400 led-pulse text-emerald-400" : "bg-amber-400"
              }`}
            />
            {running ? "LIVE" : "PAUSED"}
          </button>

          <div className="hidden sm:flex items-center gap-1 text-emerald-400">
            <Wifi className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Ticker bar */}
      <div className="h-7 overflow-hidden border-t border-border/40 bg-background/40">
        <div className="ticker flex h-full items-center gap-8 whitespace-nowrap pl-4 text-[11px] font-mono text-muted-foreground">
          <TickerContent />
          <TickerContent />
        </div>
      </div>
    </header>
  );
}

function TickerContent() {
  const items = [
    "QCS scanner: 14 active sensors · 200 Hz",
    "DCS Historian: 4.2 MB/s ingest",
    "Model: RandomForestClassifier · 100 trees · AUC 0.94",
    "Recipe Rule #412: Steam ceiling 4.5 bar",
    "Last retrain: historical pattern #89 weighted 0.91",
    "Trajectory horizon: 30–60 s forward window",
    "Off-spec threshold: ±2.5% Basis Weight deviation",
    "Operator-in-the-loop: Accept/Reject logged to audit trail",
  ];
  return (
    <>
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="text-primary">◆</span>
          {t}
        </span>
      ))}
    </>
  );
}

function StatusPill({
  icon,
  label,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  tone: "emerald" | "amber" | "red";
}) {
  const toneMap = {
    emerald: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/8 text-amber-300",
    red: "border-red-500/30 bg-red-500/8 text-red-300",
  } as const;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1 ${toneMap[tone]}`}
    >
      <span className="opacity-80">{icon}</span>
      <div className="leading-none">
        <div className="text-[10px] uppercase tracking-wider opacity-70">
          {label}
        </div>
        <div className="font-mono text-[10px] font-semibold">{detail}</div>
      </div>
    </div>
  );
}
