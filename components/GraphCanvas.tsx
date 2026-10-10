"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface GNode { id: string; labels: string[]; props: any; x?: number; y?: number; vx?: number; vy?: number }
export interface GEdge { id: string; from: string; to: string; type: string; props?: any }

const COLORS: Record<string, string> = {
  Person: "#38e1ff", Service: "#b6ff5c", Incident: "#ff5c8a", PR: "#ffb224",
  Deploy: "#ff8a5c", Doc: "#7c5cff", Ticket: "#5cc8ff", Decision: "#ffd25c",
  Team: "#8affda", Fact: "#c9b8ff", Episode: "#ff9ad5", Task: "#ffffff",
  Skill: "#6b7a99", Runbook: "#7c5cff", Step: "#555f7a", Session: "#444c66",
  Customer: "#9dff6e", Rota: "#ff5c8a", System: "#b6ff5c", Memory: "#ff9ad5",
};

function colorFor(n: GNode) {
  for (const l of n.labels) if (COLORS[l]) return COLORS[l];
  return "#8b95b0";
}
function labelOf(n: GNode) {
  return n.props?.name ?? n.props?.title?.slice(0, 22) ?? n.id;
}

export default function GraphCanvas({ nodes, edges, highlight = [], height = 520 }: { nodes: GNode[]; edges: GEdge[]; highlight?: string[]; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<GNode | null>(null);
  const hl = useMemo(() => new Set(highlight), [highlight]);
  const sim = useMemo(() => {
    const W = 900, H = height;
    const pts: GNode[] = nodes.slice(0, 220).map((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const r = 180 + (i % 5) * 34;
      return { ...n, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r * 0.72, vx: 0, vy: 0 };
    });
    const idPos = new Map(pts.map((p) => [p.id, p]));
    const es = edges.filter((e) => idPos.has(e.from) && idPos.has(e.to)).slice(0, 400);
    // 90 ticks of spring layout
    for (let t = 0; t < 90; t++) {
      for (const e of es) {
        const a = idPos.get(e.from)!; const b = idPos.get(e.to)!;
        const dx = (b.x! - a.x!), dy = (b.y! - a.y!);
        const d = Math.max(20, Math.hypot(dx, dy));
        const f = (d - 110) * 0.012;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx! += fx; a.vy! += fy; b.vx! -= fx; b.vy! -= fy;
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = b.x! - a.x!, dy = b.y! - a.y!;
        const d2 = dx * dx + dy * dy + 40;
        const f = 2600 / d2;
        const d = Math.sqrt(d2);
        a.vx! -= (dx / d) * f * 0.02; a.vy! -= (dy / d) * f * 0.02;
        b.vx! += (dx / d) * f * 0.02; b.vy! += (dy / d) * f * 0.02;
      }
      for (const p of pts) { p.x! += p.vx!; p.y! += p.vy!; p.vx! *= 0.86; p.vy! *= 0.86; }
    }
    return { pts, es, idPos };
  }, [nodes, edges, height]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!; if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    // scale sim coords (900xH) to canvas
    const sx = W / 900;
    ctx.clearRect(0, 0, W, H);
    // edges
    for (const e of sim.es) {
      const a = sim.idPos.get(e.from)!, b = sim.idPos.get(e.to)!;
      const hot = hl.has(e.from) && hl.has(e.to);
      ctx.strokeStyle = hot ? "rgba(182,255,92,.8)" : "rgba(124,92,255,.28)";
      ctx.lineWidth = hot ? 1.8 : 1;
      ctx.beginPath(); ctx.moveTo(a.x! * sx, a.y!); ctx.lineTo(b.x! * sx, b.y!); ctx.stroke();
      if (hot) {
        const mx = ((a.x! + b.x!) / 2) * sx, my = (a.y! + b.y!) / 2;
        ctx.fillStyle = "rgba(182,255,92,.9)"; ctx.font = "9px JetBrains Mono";
        ctx.fillText(e.type, mx + 4, my - 4);
      }
    }
    // nodes
    for (const p of sim.pts) {
      const x = p.x! * sx, y = p.y!;
      const hot = hl.has(p.id);
      const c = colorFor(p);
      if (hot) { ctx.fillStyle = "rgba(182,255,92,.18)"; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); }
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, hot ? 7 : 5, 0, 7); ctx.fill();
      ctx.fillStyle = hot ? "#fff" : "rgba(226,232,255,.75)";
      ctx.font = `${hot ? "bold " : ""}10px Space Grotesk`;
      ctx.fillText(labelOf(p).slice(0, 20), x + 10, y + 3);
    }
    (cv as any)._pts = sim.pts.map((p) => ({ ...p, sx }));
  }, [sim, hl, height]);

  return (
    <div className="relative">
      <canvas
        ref={ref}
        style={{ height }}
        className="w-full rounded-2xl bg-black/40 border border-line cursor-crosshair"
        onMouseMove={(e) => {
          const cv = ref.current!; const r = cv.getBoundingClientRect();
          const mx = e.clientX - r.left, my = e.clientY - r.top;
          const pts: GNode[] = (cv as any)._pts ?? [];
          let best: GNode | null = null; let bd = 1e9;
          for (const p of pts) { const d = Math.hypot((p.x as number) * (r.width / 900) - mx, (p.y as number) - my); if (d < 14 && d < bd) { bd = d; best = p; } }
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div className="absolute bottom-3 left-3 glass rounded-xl px-3 py-2 mono text-[11px] max-w-[320px]">
          <div className="text-white font-bold">{labelOf(hover)} <span className="text-slate-400">{hover.id}</span></div>
          <div className="text-cyanx">{hover.labels.join(" · ")}</div>
          <div className="text-slate-300 truncate">{JSON.stringify(hover.props).slice(0, 140)}</div>
        </div>
      )}
      <div className="absolute top-3 right-3 flex flex-wrap gap-1.5 max-w-[300px] justify-end">
        {Object.entries(COLORS).slice(0, 9).map(([k, v]) => (
          <span key={k} className="mono text-[10px] px-2 py-1 rounded-full bg-black/60 border border-line"><span style={{ color: v }}>●</span> {k}</span>
        ))}
      </div>
    </div>
  );
}
