"use client";
import { useCallback, useState } from "react";

interface AdvResult { ok: boolean; tool: string; data: any; ms: number; error?: string; cypher: string; }

const TOOLS = [
  { id: "graph.degreeCentrality", label: "Degree Centrality", desc: "Most connected nodes", args: { kind: "all" } },
  { id: "graph.closenessCentrality", label: "Closeness Centrality", desc: "Nodes closest to everyone", args: {} },
  { id: "graph.betweennessCentrality", label: "Betweenness Centrality", desc: "Bridges between graph parts", args: {} },
  { id: "graph.harmonicCentrality", label: "Harmonic Centrality", desc: "Inverse-distance ranking", args: {} },
  { id: "graph.communityDetection", label: "Community Detection", desc: "Label-propagation groups", args: {} },
  { id: "graph.maxFlow", label: "Max Flow", desc: "Bottlenecks between two nodes", args: { from: "s_auth", sink: "s_billing" } },
  { id: "graph.rootCauseChain", label: "Root-Cause Chain", desc: "Incident → deploy → PR → author", args: { incidentId: "inc_2041" } },
  { id: "graph.blastRadius", label: "Blast Radius", desc: "Downstream impact", args: { serviceId: "s_auth", depth: 3 } },
];

export default function AdvancedGraphPanel({ tenant = "acme-robotics" }: { tenant?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [result, setResult] = useState<AdvResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(tool: string, args: Record<string, any>) {
    setActive(tool); setLoading(true);
    try {
      const t0 = performance.now();
      const res = await fetch("/api/advanced-mcp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, args, tenant }),
      }).then((r) => r.json());
      const ms = (performance.now() - t0).toFixed(1);
      setResult({ ok: true, tool, data: res.result ?? res.results ?? res, ms: Number(ms), cypher: res.cypher });
    } catch (e: any) {
      setResult({ ok: false, tool, data: null, ms: 0, error: String(e?.message ?? e), cypher: "" });
    } finally { setLoading(false); }
  }

  if (!result) return (
    <div className="glass rounded-3xl p-6 mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="mono text-xs text-cyanx">ADVANCED GRAPH ALGORITHMS</span>
        <span className="mono text-[10px] px-2 py-1 rounded-full border border-line text-slate-400">{tenant}</span>
      </div>
      <div className="mono text-[11px] text-slate-500">Pick an algorithm — every result shows its exact Cypher.</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => run(t.id, t.args)} className="mono text-[9px] px-3 py-2 rounded-lg bg-black/40 border border-line text-left leading-snug hover:border-limex">
            <div className="font-bold text-slate-200">{t.label}</div><div className="text-slate-500">{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="glass rounded-3xl p-6 mt-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="mono text-xs text-cyanx">ADVANCED GRAPH ALGORITHMS</span>
          <span className="mono text-[10px] px-2 py-1 rounded-full border border-line text-slate-400">{tenant}</span>
        </div>
        <button onClick={() => setActive(null)} className="mono text-[10px] px-3 py-2 rounded-xl border border-line text-slate-400">back</button>
      </div>

      {result.error ? (
        <div className="mono text-[11px] p-4 text-roseX bg-roseX/10 border border-roseX/30 rounded">
          <div className="font-bold">{result.tool}</div><div className="text-slate-300 mt-1">{result.error}</div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line rounded-xl bg-black/40">
          <div className="flex items-center justify-between p-2 border-b border-line bg-black/30">
            <span className="mono text-[10px] text-limex font-bold">{result.tool}</span>
            <span className="mono text-[10px] text-slate-400">{result.ms} ms</span>
          </div>
          <div className="mono text-[10.5px] p-3 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(result.data, null, 2)}
          </div>
          <div className="mono text-[9px] text-slate-500 p-2 border-t border-line">
            Cypher: <span className="text-cyanx">{result.cypher}</span>
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => run(t.id, t.args)} disabled={loading} className={`mono text-[9px] px-3 py-2 rounded-lg text-left leading-snug ${active === t.id ? "bg-neon/20 border-neon text-white" : "bg-black/40 border border-line text-slate-400 hover:border-limex"}`}>
            <div className="font-bold">{t.label}</div><div className="text-[9px]">{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
