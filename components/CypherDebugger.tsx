"use client";
import { useCallback, useMemo, useRef, useState } from "react";

interface CypherResult { ok: boolean; data: any[]; headers: string[]; ms: number; error?: string; cypher: string; }

export default function CypherDebugger({ tenant = "acme-robotics" }: { tenant?: string }) {
  const [cypher, setCypher] = useState("MATCH (n) RETURN labels(n) AS label, count(*) AS n ORDER BY n DESC LIMIT 10");
  const [result, setResult] = useState<CypherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);

  const presets = [
    "MATCH (n) RETURN labels(n) AS label, count(*) AS n ORDER BY n DESC LIMIT 10",
    "MATCH p=(i:Incident {id:'inc_2041'})-[:AFFECTS]->(s:Service)<-[:DEPLOYED_TO]-(d:Deploy)<-[:DEPLOYED_AS]-(pr:PR)<-[:AUTHORED]-(u:Person) RETURN pr.title, u.name, d.at ORDER BY d.at DESC LIMIT 5",
    "MATCH (s:Service)-[:DEPENDS_ON*1..3]->(d:Service) RETURN s.name AS source, d.name AS downstream, count(*) AS hops ORDER BY hops DESC LIMIT 10",
    "MATCH (p:Person)-[:WORKED_ON]->(s:Service) RETURN p.name AS expert, s.name AS service ORDER BY p.name LIMIT 10",
    "MATCH (m:Memory) RETURN m.kind AS kind, count(*) AS n ORDER BY n DESC",
    "MATCH (c:Community) RETURN c LIMIT 5",
  ];

  async function run() {
    setLoading(true);
    try {
      const t0 = performance.now();
      const res = await fetch("/api/cypher", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, cypher }),
      }).then((r) => r.json());
      const ms = (performance.now() - t0).toFixed(1);
      const data = res.data ?? res;
      const headers = res.headers ?? (data.length ? Object.keys(data[0]) : []);
      setResult({ ok: true, data: Array.isArray(data) ? data : [data], headers, ms: Number(ms), cypher });
      setHistory((h) => [cypher, ...h.slice(0, 9)]);
    } catch (e: any) {
      setResult({ ok: false, data: [], headers: [], ms: 0, error: String(e?.message ?? e), cypher });
    } finally { setLoading(false); }
  }

  async function runPreset(p: string) {
    setCypher(p); run();
  }

  return (
    <div className="glass rounded-3xl p-6 mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono text-xs text-cyanx">CYPHER DEBUGGER · real OpenCypher against the graph</span>
        <span className="mono text-[10px] px-2 py-1 rounded-full border border-line text-slate-400">{tenant}</span>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={cypher}
          onChange={(e) => setCypher(e.target.value)}
          rows={2}
          className="w-full mono text-xs bg-black/60 border border-line rounded-xl p-3 outline-none focus:border-amberx"
          placeholder="MATCH (n) RETURN n LIMIT 5"
        />
        <div className="flex items-center gap-2">
          <button onClick={run} disabled={loading} className="px-5 py-2 rounded-xl bg-amberx text-black font-bold disabled:opacity-50">{loading ? "Running…" : "Run →"}</button>
          <button onClick={() => navigator.clipboard.writeText(cypher)} className="mono text-[10px] px-3 py-2 rounded-xl border border-line text-slate-300">copy</button>
          <div className="mono text-[10px] text-slate-400 ml-auto">POST /api/cypher</div>
        </div>
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-1 max-w-[900px]">
        {presets.map((p) => (
          <button key={p} onClick={() => runPreset(p)} className="mono text-[10px] px-2.5 py-1.5 rounded-lg bg-black/40 border border-line hover:border-limex text-left whitespace-nowrap">
            {p.slice(0, 44)}…
          </button>
        ))}
      </div>

      {/* results */}
      <div className="relative overflow-x-auto border border-line rounded-xl bg-black/40" ref={outputRef}>
        {!result ? (
          <div className="mono text-[11px] text-slate-500 p-4">Run a query. Results render as a table with headers; Cypher path shown per row.</div>
        ) : result.error ? (
          <div className="mono text-[11px] p-4 text-roseX bg-roseX/10 border border-roseX/30 rounded">
            <div className="font-bold">Error</div><div className="text-slate-300 mt-1">{result.error}</div>
            <div className="mono text-xs text-slate-500 mt-2 whitespace-pre-wrap">{result.cypher}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-2 border-b border-line bg-black/30">
              <span className="mono text-[10px] text-limex font-bold">{result.data.length} row{result.data.length === 1 ? "" : "s"}</span>
              <span className="mono text-[10px] text-slate-400">{result.ms} ms · {result.headers.join(" · ")}</span>
            </div>
            <table className="w-full mono text-[10.5px]">
              <thead>
                <tr>
                  {result.headers.map((h) => (
                    <th key={h} className="text-left py-1.5 pr-2 border-b border-line text-slate-400 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.slice(0, 200).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-black/20"}>
                    {result.headers.map((h) => {
                      const v = row[h];
                      return (
                        <td key={h} className="py-1.5 pr-2 border-b border-line/30 text-slate-200">
                          {Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {result.data.length > 200 && (
                  <tr><td className="py-1 text-[9px] text-slate-500" colSpan={result.headers.length}>… and {result.data.length - 200} more rows</td></tr>
                )}
              </tbody>
            </table>
            <div className="mono text-[9px] text-slate-500 p-2 border-t border-line">
              Cypher executed: <span className="text-cyanx">{result.cypher}</span>
            </div>
          </>
        )}
      </div>

      {/* history */}
      {history.length > 0 && (
        <div className="mt-3">
          <span className="mono text-[10px] text-slate-400">history</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {history.map((h, i) => (
              <button key={i} onClick={() => runPreset(h)} className="mono text-[9px] px-2 py-1 rounded-lg bg-black/30 border border-line/30 text-slate-400 hover:border-cyanx whitespace-nowrap truncate max-w-[200px]">{h}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
