"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import GraphCanvas from "@/components/GraphCanvas";

interface Step { agent: string; tool: string; input: any; outputSummary: string; cypher?: string; path?: string[] }
interface ChatRes { answer: string; steps: Step[]; citations: any[]; actions: any[]; confidence: number; ms: number }

const PRESETS = [
  "Investigate inc_2041 — payments p99 spike",
  "Who knows payments-api?",
  "What breaks if auth-service goes down?",
  "Why did we require hardware keys for oncall?",
  "Show refund SLA and open tickets",
  "What did we learn from the route-optimizer incident?",
];

// Minimal markdown renderer for agent answers (headings, bold, inline code, bullets).
// Keeps the bundle dependency-free; answers are agent-generated, so escape HTML first.
function renderMiniMd(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("##")) return `<h2>${line.replace(/^#+/, "").trim()}</h2>`;
      let h = line
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
      if (/^\s*[-*]\s+/.test(h)) return `<li>${h.replace(/^\s*[-*]\s+/, "")}</li>`;
      if (h.trim() === "") return "<br/>";
      return `<p>${h}</p>`;
    })
    .join("");
}

export default function Console() {
  const [tenant, setTenant] = useState("acme-robotics");
  const [sessionId] = useState("console");
  const [q, setQ] = useState(PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<ChatRes | null>(null);
  const [graph, setGraph] = useState<any>({ nodes: [], edges: [], stats: null });
  const [backend, setBackend] = useState<any>(null);
  const [cypher, setCypher] = useState("MATCH (i:Incident)-[:AFFECTS]->(s:Service) RETURN i.id, s.name LIMIT 5");
  const [cypherOut, setCypherOut] = useState<any>(null);
  const [memQ, setMemQ] = useState("payments deploy");
  const [mem, setMem] = useState<any>(null);
  const [proof, setProof] = useState<any>(null);
  const [proofLoading, setProofLoading] = useState(false);

  const highlight = useMemo(() => {
    const s = new Set<string>();
    res?.steps.forEach((st) => st.path?.forEach((p) => s.add(p)));
    return [...s];
  }, [res]);

  const loadGraph = useCallback(async (t: string, center?: string) => {
    const r = await fetch(`/api/graph?tenant=${t}${center ? `&center=${center}` : ""}`).then((x) => x.json());
    setGraph(r);
  }, []);

  const loadHealth = useCallback(async (t: string) => {
    const r = await fetch(`/api/health?tenant=${t}`).then((x) => x.json());
    setBackend(r.backend); setGraph((g: any) => ({ ...g, stats: r.stats }));
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const qq = sp.get("q"); if (qq) setQ(qq);
    const t = sp.get("tenant"); if (t) setTenant(t);
  }, []);

  useEffect(() => { loadGraph(tenant); loadHealth(tenant); }, [tenant, loadGraph, loadHealth]);

  async function ask(question?: string) {
    const qq = question ?? q;
    setLoading(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant, question: qq, sessionId }) }).then((x) => x.json());
      setRes(r);
      const center = r.steps?.[0]?.path?.[0] ?? r.citations?.[0]?.id;
      await loadGraph(tenant, center);
    } finally { setLoading(false); }
  }

  useEffect(() => { ask(q); /* auto-run once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCypher() {
    const r = await fetch("/api/graph", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant, cypher }) }).then((x) => x.json());
    setCypherOut(r);
  }
  async function loadMem() {
    const r = await fetch(`/api/memory?tenant=${tenant}&q=${encodeURIComponent(memQ)}`).then((x) => x.json());
    setMem(r);
  }
  async function loadProof() {
    setProofLoading(true);
    try {
      const r = await fetch(`/api/proof?tenant=${tenant}`).then((x) => x.json());
      setProof(r);
    } finally { setProofLoading(false); }
  }

  return (
    <main className="min-h-screen relative">
      <div className="absolute inset-0 bg-grid opacity-70" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon to-cyanx grid place-items-center font-bold text-black">M</div>
            <div><div className="font-bold tracking-widest text-sm">MERIDIAN CONSOLE</div><div className="mono text-[11px] text-slate-400">4 agents · 1 FalkorDB graph · {backend?.mode ?? "…"} backend</div></div>
          </a>
          <div className="flex items-center gap-2">
            {["acme-robotics", "globex", "initech"].map((t) => (
              <button key={t} onClick={() => setTenant(t)} className={`mono text-xs px-3 py-2 rounded-xl border ${tenant === t ? "bg-limex text-black border-limex font-bold" : "glass"}`}>{t}</button>
            ))}
            <span className="mono text-[11px] px-3 py-2 rounded-xl border border-line bg-panel">◉ {backend?.mode === "falkordb" ? `FalkorDB ${backend?.url}` : "in-memory mirror (set FALKORDB_URL for live)"}</span>
          </div>
        </div>

        {/* ask bar */}
        <div className="glass rounded-3xl p-4 sm:p-5 mt-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask the company brain…" className="flex-1 bg-black/50 border border-line rounded-2xl px-5 py-3.5 outline-none focus:border-neon text-[15px]" />
            <button onClick={() => ask()} disabled={loading} className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-neon to-cyanx text-black font-bold disabled:opacity-50">{loading ? "Traversing…" : "Ask →"}</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => { setQ(p); ask(p); }} className="mono text-[11px] px-3 py-1.5 rounded-full border border-line bg-black/40 hover:border-cyanx">{p}</button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5 mt-5">
          {/* left: answer + steps */}
          <div className="space-y-5">
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div className="mono text-xs text-cyanx">AGENT ANSWER · confidence {res ? `${Math.round(res.confidence * 100)}%` : "—"} {res ? `· ${res.ms}ms` : ""}</div>
                <div className="flex gap-1.5">{["scout", "archivist", "guardian", "oracle"].map((a) => <span key={a} className="mono text-[10px] px-2 py-1 rounded-full bg-white/5 border border-line">{a}</span>)}</div>
              </div>
              {!res ? <div className="text-slate-400 mt-4">Ask anything — try “investigate inc_2041”.</div> : (
                <div className="markdown-body mt-3" dangerouslySetInnerHTML={{ __html: renderMiniMd(res.answer) }} />
              )}
              {!!res?.actions?.length && (
                <div className="grid sm:grid-cols-3 gap-2 mt-4">
                  {res.actions.map((a: any, i: number) => (
                    <div key={i} className={`rounded-2xl p-3 border ${a.severity === "critical" ? "border-roseX/60 bg-roseX/10" : a.severity === "warn" ? "border-amberx/60 bg-amberx/10" : "border-cyanx/40 bg-cyanx/10"}`}>
                      <div className="font-bold text-sm">{a.label}</div><div className="text-xs text-slate-300 mt-1">{a.detail}</div>
                    </div>
                  ))}
                </div>
              )}
              {!!res?.citations?.length && (
                <div className="mt-4">
                  <div className="mono text-[11px] text-slate-400 mb-2">SOURCES (click to center graph)</div>
                  <div className="flex flex-wrap gap-2">
                    {res.citations.map((c: any) => (
                      <button key={c.id} onClick={() => loadGraph(tenant, c.id)} className="mono text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-line hover:border-limex text-left"><span className="text-limex">{c.id}</span> <span className="text-slate-300">{c.title?.slice(0, 40)}</span></button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="glass rounded-3xl p-6">
              <div className="mono text-xs text-limex mb-3">AGENT TIMELINE · every decision shows its Cypher</div>
              <div className="space-y-3">
                {res?.steps?.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-line bg-black/40 p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`mono text-[11px] px-2 py-1 rounded-full font-bold ${s.agent === "guardian" ? "bg-roseX/20 text-roseX" : s.agent === "oracle" ? "bg-neon/20 text-[#c9b8ff]" : s.agent === "archivist" ? "bg-amberx/20 text-amberx" : "bg-cyanx/20 text-cyanx"}`}>{s.agent}</span>
                      <span className="mono text-[11px] text-slate-300">{s.tool}</span>
                    </div>
                    <div className="text-sm text-slate-200 mt-2">{s.outputSummary}</div>
                    {s.cypher && <pre className="mono text-[11px] text-cyanx bg-black/60 border border-line rounded-xl p-2.5 mt-2 overflow-x-auto whitespace-pre-wrap">{s.cypher}</pre>}
                    {!!s.path?.length && <div className="mono text-[11px] text-limex mt-2">path: {s.path.join(" → ")}</div>}
                  </div>
                )) ?? <div className="text-slate-500 text-sm">Run a question to see Scout → Archivist → Guardian → Oracle.</div>}
              </div>
            </div>
          </div>

          {/* right: graph + panels */}
          <div className="space-y-5">
            <div className="glass rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="mono text-xs text-cyanx">LIVE GRAPH · {graph.nodes?.length ?? 0} nodes · {graph.edges?.length ?? 0} edges</div>
                <button onClick={() => loadGraph(tenant)} className="mono text-[11px] px-3 py-1.5 rounded-lg border border-line">reset view</button>
              </div>
              <GraphCanvas nodes={graph.nodes ?? []} edges={graph.edges ?? []} highlight={highlight} />
              <div className="mono text-[11px] text-slate-400 mt-3">stats: {graph.stats ? Object.entries(graph.stats.labelCounts ?? {}).map(([k, v]) => `${k}:${v}`).join(" · ") : "…"}</div>
            </div>

            <div className="glass rounded-3xl p-5">
              <div className="mono text-xs text-amberx mb-2">CYPHER PLAYGROUND {backend?.mode === "falkordb" ? "(LIVE FalkorDB)" : "(mirror — set FALKORDB_URL for live)"}</div>
              <textarea value={cypher} onChange={(e) => setCypher(e.target.value)} rows={3} className="w-full mono text-xs bg-black/60 border border-line rounded-xl p-3 outline-none focus:border-amberx" />
              <button onClick={runCypher} className="mt-2 px-5 py-2 rounded-xl bg-amberx text-black font-bold text-sm">Run Cypher →</button>
              {cypherOut && <pre className="mono text-[11px] bg-black/60 border border-line rounded-xl p-3 mt-3 overflow-auto max-h-56 whitespace-pre-wrap">{JSON.stringify(cypherOut, null, 2).slice(0, 4000)}</pre>}
              <div className="mono text-[11px] text-slate-500 mt-2">Try: MATCH (p:Person)-[:AUTHORED]-&gt;(pr:PR)-[:CHANGES]-&gt;(s:Service) RETURN p.name, pr.title LIMIT 5</div>
            </div>

            <div className="glass rounded-3xl p-5">
              <div className="mono text-xs text-[#c9b8ff] mb-2">SHARED MEMORY · per-tenant + handoffs</div>
              <div className="flex gap-2">
                <input value={memQ} onChange={(e) => setMemQ(e.target.value)} className="flex-1 mono text-xs bg-black/50 border border-line rounded-xl px-3 py-2 outline-none" />
                <button onClick={loadMem} className="mono text-xs px-4 py-2 rounded-xl bg-neon text-white font-bold">recall</button>
              </div>
              {mem ? (
                <div className="mt-3 space-y-2 max-h-64 overflow-auto scroll-thin">
                  {(mem.recall ?? []).map((r: any) => <div key={r.id} className="mono text-[11px] bg-black/40 border border-line rounded-xl p-2.5"><span className="text-limex">{r.id}</span> <span className="text-slate-300">{JSON.stringify(r.props).slice(0, 160)}</span></div>)}
                  <div className="mono text-[11px] text-slate-400">open tasks: {(mem.openTasks ?? []).map((t: any) => t.id).join(", ") || "none"} · sessions: {(mem.sessionHistory ?? []).length} episodes</div>
                </div>
              ) : <div className="mono text-[11px] text-slate-500 mt-2">Click recall — memory.reads are graph traversals.</div>}
            </div>
          </div>
        </div>

        {/* PROOF — graph is load-bearing */}
        <div className="glass rounded-3xl p-6 mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="mono text-xs text-limex">PROOF · is the graph load-bearing? (rules #3)</div>
            <button onClick={loadProof} disabled={proofLoading} className="mono text-[11px] px-4 py-2 rounded-xl bg-limex text-black font-bold disabled:opacity-50">
              {proofLoading ? "running ablation…" : "run ablation →"}
            </button>
          </div>
          {!proof && <p className="text-sm text-slate-400">Severe the relationships, keep every record, and see which answers survive. Anything that changes cannot come from a flat table.</p>}
          {proof && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`mono text-xs px-3 py-1.5 rounded-full font-bold ${proof.verdict?.startsWith("GRAPH") ? "bg-limex text-black" : "bg-roseX/20 text-roseX"}`}>{proof.verdict}</span>
                <span className="mono text-xs text-slate-300">{proof.loadBearing}</span>
              </div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full mono text-[11px]">
                  <thead><tr className="text-slate-400 border-b border-line">
                    <th className="text-left py-2 pr-3">capability</th><th className="text-left py-2 pr-3">with graph</th><th className="text-left py-2 pr-3">graph severed</th><th className="text-left py-2">load-bearing</th>
                  </tr></thead>
                  <tbody>
                    {proof.capabilities?.map((r: any) => (
                      <tr key={r.capability} className="border-b border-line/40">
                        <td className="py-1.5 pr-3 text-slate-200">{r.capability}</td>
                        <td className="py-1.5 pr-3 text-limex">{String(r.withGraph)}</td>
                        <td className="py-1.5 pr-3 text-roseX">{String(r.graphSevered)}</td>
                        <td className="py-1.5">{r.loadBearing ? "✓ yes" : "✗ no"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* MCP strip */}
        <div className="glass rounded-3xl p-6 mt-5">
          <div className="mono text-xs text-cyanx">MCP SERVER · agents pick tools dynamically · GET/POST /api/mcp · <a href="/api/proof" className="underline">graph proof bundle →</a></div>
          <div className="grid sm:grid-cols-4 gap-2 mt-3">
            {["graph.traverse", "graph.shortestPath", "graph.blastRadius", "graph.pageRank", "graph.whoKnows", "memory.recall", "memory.handoff", "brain.decisionLineage"].map((t) => (
              <code key={t} className="mono text-[11px] bg-black/50 border border-line rounded-xl px-3 py-2.5">{t}</code>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
