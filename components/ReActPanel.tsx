"use client";
import { useCallback, useState } from "react";

export default function ReActPanel({ tenant = "acme-robotics" }: { tenant?: string }) {
  const [q, setQ] = useState("why did payments-api fail?");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/react", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, question: q }),
      }).then((r) => r.json());
      setResult({ ...res, q });
    } catch (e: any) {
      setResult({ error: String(e?.message ?? e), q });
    } finally { setLoading(false); }
  }

  return (
    <div className="glass rounded-3xl p-6 mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="mono text-xs text-neon">REACT AGENT LOOP</span>
        <span className="mono text-[10px] px-2 py-1 rounded-full border border-line text-slate-400">{tenant}</span>
      </div>
      <div className="mono text-[10px] text-slate-400">
        Reason → Act → Observe → answer. Every tool call shows its Cypher.
      </div>

      <div className="flex items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Ask anything — agent decides which graph tools to call"
          className="flex-1 mono text-xs bg-black/60 border border-line rounded-xl p-3 outline-none focus:border-neon"
        />
        <button onClick={run} disabled={loading} className="px-5 py-3 rounded-xl bg-neon text-black font-bold disabled:opacity-50">
          {loading ? "thinking…" : "Reason →"}
        </button>
      </div>

      {!result && (
        <div className="mono text-[11px] text-slate-500 p-4">
          Example: "why did payments-api fail?" · "who knows route-optimizer?" · "what breaks if auth-service goes down?"
        </div>
      )}

      {result?.error && (
        <div className="mono text-[11px] p-4 text-roseX bg-roseX/10 border border-roseX/30 rounded">
          <div className="font-bold">Error</div><div className="text-slate-300 mt-1">{result.error}</div>
        </div>
      )}

      {result && !result.error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 border-b border-line bg-black/30">
            <span className="mono text-[10px] text-neon font-bold">ReAct trace · {result.iterations} iteration{result.iterations === 1 ? "" : "s"}</span>
            <span className="mono text-[10px] text-slate-400">confidence {(result.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="mono text-[10px] overflow-y-auto max-h-[420px] border border-line rounded-xl bg-black/40 p-3">
            {result.steps.map((s: any, i: number) => (
              <div key={i} className="mb-3 pb-2 border-b border-line/30 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="mono text-[9px] px-1.5 py-0.5 rounded bg-black/50 border border-line text-cyanx">step {s.step}</span>
                  <span className="mono text-[9px] text-slate-300">{s.action}</span>
                  <span className="ml-auto mono text-[9px] text-slate-500">{s.observationSummary}</span>
                </div>
                <div className="mono text-xs text-slate-200 pl-2 border-l border-cyanx/30">{s.thought}</div>
                {s.cypher && (
                  <div className="mono text-[9px] text-amberx mt-1 pl-2 whitespace-pre-wrap">{s.cypher}</div>
                )}
                <div className="mono text-xs text-slate-300 mt-1 pl-2">
                  {JSON.stringify(s.observation).slice(0, 220)}
                </div>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-line">
              <span className="mono text-[9px] text-limex font-bold">Answer:</span>
              <div className="mono text-xs text-slate-200 mt-1 whitespace-pre-wrap">{result.answer}</div>
              <div className="mono text-[9px] text-slate-500 mt-2">Cypher log: {result.cypherLog.length} query{result.cypherLog.length !== 1 ? "s" : ""} executed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
