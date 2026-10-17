"use client";
import { useCallback, useState } from "react";

interface SearchHit { id: string; score: number; labels: string[]; props: any; text: string; vScore?: number; kScore?: number; }

export default function VectorSearchPanel({ tenant = "acme-robotics" }: { tenant?: string }) {
  const [q, setQ] = useState("payments deploy batch size");
  const [mode, setMode] = useState<"hybrid" | "vector">("hybrid");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tenant=${tenant}&mode=${mode}`).then((r) => r.json());
      setResults(res.results ?? res);
    } catch (e: any) {
      setResults([]);
    } finally { setLoading(false); }
  }

  return (
    <div className="glass rounded-3xl p-6 mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="mono text-xs text-cyanx">VECTOR + HYBRID SEARCH</span>
        <span className="mono text-[10px] px-2 py-1 rounded-full border border-line text-slate-400">{tenant}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="semantic recall… e.g. 'retry logic', 'auth keys', 'rollback'"
          className="flex-1 mono text-xs bg-black/60 border border-line rounded-xl p-3 outline-none focus:border-amberx"
        />
        <button onClick={run} disabled={loading} className="px-5 py-3 rounded-xl bg-cyanx text-black font-bold disabled:opacity-50">{loading ? "…" : "Search →"}</button>
        <div className="flex gap-1">
          <button onClick={() => setMode("hybrid")} className={`mono text-[9px] px-3 py-2 rounded-lg ${mode === "hybrid" ? "bg-limex text-black font-bold" : "border border-line bg-black/40 text-slate-300"}`}>hybrid</button>
          <button onClick={() => setMode("vector")} className={`mono text-[9px] px-3 py-2 rounded-lg ${mode === "vector" ? "bg-neon/20 text-neon font-bold border border-neon" : "border border-line bg-black/40 text-slate-300"}`}>vector</button>
        </div>
      </div>

      <div className="mono text-[10px] text-slate-400">
        hybrid = 60% vector similarity + 40% keyword overlap · FalkorDB equivalent: SCAN VECTOR + full-text index
      </div>

      {results === null && !loading && (
        <div className="mono text-[11px] text-slate-500 p-4">Type a query — semantic recall over every node's text (name, title, rationale, text).</div>
      )}
      {loading && <div className="mono text-[11px] text-cyanx p-4">Embedding + searching graph text…</div>}

      {results && results.length > 0 && (
        <div className="overflow-x-auto border border-line rounded-xl bg-black/40">
          <table className="w-full mono text-[10.5px]">
            <thead>
              <tr className="text-slate-400 border-b border-line">
                <th className="text-left py-1.5 pr-2">score</th><th className="text-left py-1.5 pr-2">node</th><th className="text-left py-1.5 pr-2">labels</th><th className="text-left py-1.5">text</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-black/20"}>
                  <td className="py-1.5 pr-2 border-b border-line/30 text-limex font-bold">{Number(r.score).toFixed(3)}</td>
                  <td className="py-1.5 pr-2 border-b border-line/30 text-slate-200 truncate max-w-[120px]">{r.id}</td>
                  <td className="py-1.5 pr-2 border-b border-line/30 text-cyanx">{r.labels.join(" · ")}</td>
                  <td className="py-1.5 pr-2 border-b border-line/30 text-slate-200 break-words">{r.text?.slice(0, 160) ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results && results.length === 0 && (
        <div className="mono text-[11px] text-slate-500 p-4">No nodes matched the query with score ≥ threshold. Try broader terms.</div>
      )}
    </div>
  );
}
