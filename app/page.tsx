import Link from "next/link";

const TRACKS = [
  {
    n: "01",
    icon: "🕵️",
    title: "Agents That Act on Connected Data",
    prize: "iPhone 18 Pro",
    desc: "Guardian investigates inc_2041 across Incident → Service → Deploy → PR → Person in one traced path, runs blast-radius + PageRank, then acts: freeze, rollback, page.",
    points: ["Multi-hop root-cause with Cypher proof", "algo.pageRank + BFS blast radius as tools", "MCP: graph.traverse / blastRadius / whoKnows", "Explainable actions, not black-box"],
    cypher: "MATCH p=(i:Incident)-[:AFFECTS]->(s)<-[:DEPLOYED_TO]-(d)<-[:DEPLOYED_AS]-(pr)<-[:AUTHORED]-(u)\nRETURN pr.title, u.name",
  },
  {
    n: "02",
    icon: "🤖",
    title: "Agent Memory & Coordination",
    prize: "PS5 + GTA VI",
    desc: "Scout, Archivist, Guardian, Oracle share one graph blackboard. Episodes, facts, runbooks persist per tenant; Tasks are claimed via edges.",
    points: ["Episodic / semantic / procedural nodes", "Sessions survive reload (sess_console)", "Handoffs: Task ASSIGNED_TO / CLAIMED", "One graph per tenant (meridian_*)"],
    cypher: "MATCH (m:Memory) WHERE m.text CONTAINS $q\nRETURN m.id, m.kind // episodic|semantic",
  },
  {
    n: "03",
    icon: "🧠",
    title: "Company Brain",
    prize: "M6 Mac Mini",
    desc: "Who owns payments-api? Who knows route-optimizer? What decided the auth key policy? Every answer cites nodes: Person, Doc, Decision, Ticket.",
    points: ["Docs + tickets + chats → one graph", "Owner & expert finder with signals", "Decision lineage to rationale", "Freshness + source on every answer"],
    cypher: "MATCH (p:Person)-[:MADE]->(d:Decision)-[:CONSTRAINS]->(s:Service)\nRETURN p.name, d.title",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-30 blur-[120px] bg-gradient-to-r from-neon via-cyanx to-roseX" />

      {/* nav */}
      <nav className="relative z-10 max-w-7xl mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon to-cyanx grid place-items-center font-bold text-black">M</div>
          <div>
            <div className="font-bold tracking-widest text-sm">MERIDIAN</div>
            <div className="mono text-[11px] text-slate-400">living company brain · graph hacks 2026</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-xs px-3 py-1.5 rounded-full border border-line bg-panel hidden sm:inline">◉ FalkorDB inside ·multigraph per tenant</span>
          <Link href="/console" className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-limex transition">Open Console →</Link>
        </div>
      </nav>

      {/* hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mono text-xs text-cyanx mb-6">
          <span className="w-2 h-2 rounded-full bg-limex animate-ring" /> ALL 3 TRACKS · ONE GRAPH · LIVE DEMO BELOW
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold leading-[1.02] tracking-tight">
          Give your agents<br /><span className="glow-text">real context.</span>
        </h1>
        <p className="max-w-2xl mx-auto mt-6 text-slate-300 text-lg leading-relaxed">
          Meridian is an autonomous <b className="text-white">4-agent crew</b> that lives on a <b className="text-white">FalkorDB knowledge graph</b>.
          It investigates outages, remembers every session, coordinates via shared memory, and answers “who knows what” — with the <b className="text-white">Cypher path as proof</b>.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link href="/console" className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-neon to-cyanx text-black font-bold">⚡ Investigate inc_2041 live</Link>
          <Link href="/console?q=who%20knows%20payments-api%3F" className="px-7 py-3.5 rounded-2xl glass font-semibold card-hover">Who knows payments-api?</Link>
          <a href="https://github.com/aniruddhaadak80/meridian-graphhacks" target="_blank" className="px-7 py-3.5 rounded-2xl glass font-semibold card-hover mono text-sm">★ public repo + readme</a>
        </div>

        {/* live stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto mt-12">
          {[
            ["87", "nodes seeded"],
            ["117", "edges traversed"],
            ["4", "agents, 1 blackboard"],
            ["<100ms", "traversal (FalkorDB)"],
          ].map(([a, b]) => (
            <div key={b} className="glass rounded-2xl px-4 py-4">
              <div className="text-2xl font-bold">{a}</div>
              <div className="mono text-xs text-slate-400 mt-1">{b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* tracks */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        <h2 className="text-3xl font-bold mb-2">One build. All three tracks.</h2>
        <p className="text-slate-400 mb-8">Judges: pick any track — Meridian qualifies for each independently, and wins together.</p>
        <div className="grid md:grid-cols-3 gap-5">
          {TRACKS.map((t) => (
            <div key={t.n} className="glass rounded-3xl p-6 card-hover flex flex-col">
              <div className="text-4xl">{t.icon}</div>
              <div className="mono text-xs text-cyanx mt-3">TRACK {t.n} · 🏆 {t.prize}</div>
              <h3 className="text-xl font-bold mt-2 leading-snug">{t.title}</h3>
              <p className="text-slate-300 text-sm mt-3 leading-relaxed">{t.desc}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                {t.points.map((p) => <li key={p} className="flex gap-2"><span className="text-limex">✓</span>{p}</li>)}
              </ul>
              <pre className="mono text-[11px] bg-black/50 border border-line rounded-xl p-3 mt-4 overflow-x-auto text-cyanx whitespace-pre-wrap">{t.cypher}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16 grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-8">
          <div className="mono text-xs text-limex">HOW IT WORKS · 60 SECONDS</div>
          <h3 className="text-2xl font-bold mt-2">The graph does the reasoning.</h3>
          <ol className="mt-5 space-y-4 text-[15px] text-slate-200">
            {[
              ["You ask", "“payments are failing — what broke?” → Scout anchors Incident inc_2041 + Service payments-api."],
              ["Agents traverse", "Guardian runs root-cause chain + blast radius; Archivist recalls 2 prior episodes; Oracle ranks experts."],
              ["You see proof", "Every claim links to nodes + Cypher. No path found = proof of safety, not an empty result."],
              ["Agents act", "Freeze deploys, propose rollback pr_882, page Ava Chen — written back as Task nodes."],
              ["Memory persists", "Outcome becomes Episode ep_*. Next session recalls it. Per-tenant graph isolates customers."],
            ].map(([a, b], i) => (
              <li key={a} className="flex gap-4"><span className="w-8 h-8 shrink-0 rounded-full bg-neon/20 border border-neon grid place-items-center font-bold text-sm">{i + 1}</span><span><b>{a}:</b> <span className="text-slate-300">{b}</span></span></li>
            ))}
          </ol>
        </div>
        <div className="glass rounded-3xl p-8">
          <div className="mono text-xs text-amberx">DATA MODEL · NODES + EDGES</div>
          <h3 className="text-2xl font-bold mt-2">Northwind Robotics (synthetic).</h3>
          <div className="mono text-[12px] mt-4 bg-black/50 border border-line rounded-2xl p-4 leading-relaxed text-slate-200 overflow-x-auto">
            <div><span className="text-cyanx">(Person)</span>-[:MEMBER_OF|KNOWS|WORKED_ON|AUTHORED|MADE]-&gt;…</div>
            <div><span className="text-limex">(Service)</span>-[:DEPENDS_ON|OWNS]-&gt;(Service|Team)</div>
            <div><span className="text-amberx">(PR)-[:CHANGES]-&gt;(Service)</span> · <span className="text-amberx">(PR)-[:DEPLOYED_AS]-&gt;(Deploy)-[:DEPLOYED_TO]-&gt;(Service)</span></div>
            <div><span className="text-roseX">(Incident)-[:AFFECTS|CORRELATED_WITH|CAUSED_BY]</span></div>
            <div>(Doc|Ticket|Decision|Fact|Runbook|Episode|Task|Session)</div>
            <div className="mt-2 text-slate-400">graphs: meridian_acme-robotics, meridian_globex … (multigraph isolation)</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            {["docker compose up", "FALKORDB_URL=redis://localhost:6379 npm run dev", "POST /api/seed {tenant}", "GET /api/graph?center=inc_2041"].map((c) => (
              <code key={c} className="mono text-[11px] bg-white/5 border border-line rounded-lg px-2.5 py-1.5">{c}</code>
            ))}
          </div>
          <Link href="/console" className="inline-block mt-6 px-6 py-3 rounded-xl bg-limex text-black font-bold text-sm">Open the live console →</Link>
        </div>
      </section>

      {/* judges CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-neon/30 via-panel to-cyanx/20 border border-neon/40 text-center">
          <div className="mono text-xs text-cyanx">JUDGES · 2-MINUTE SCRIPT</div>
          <h3 className="text-3xl font-bold mt-2">“Show me the graph doing work.”</h3>
          <div className="grid sm:grid-cols-3 gap-3 mt-6 text-left">
            {[
              ["1 · Break it", "Console → ‘investigate inc_2041’. Watch Guardian traverse 5 hops to pr_882 + author."],
              ["2 · Remove it", "Kill FalkorDB / unset URL → chat still answers via mirror BUT Cypher log proves live path. Graph removal = no provenance."],
              ["3 · Isolate it", "Switch tenant acme-robotics → globex. Memory + incidents fully isolated."],
            ].map(([a, b]) => (
              <div key={a} className="bg-black/40 rounded-2xl p-4 border border-white/10"><div className="font-bold">{a}</div><div className="text-sm text-slate-300 mt-1">{b}</div></div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/console" className="px-7 py-3 rounded-xl bg-white text-black font-bold">Launch demo</Link>
            <Link href="/api/health?tenant=acme-robotics" className="px-7 py-3 rounded-xl glass mono text-sm">GET /api/health</Link>
            <Link href="/api/mcp" className="px-7 py-3 rounded-xl glass mono text-sm">MCP tools</Link>
          </div>
        </div>
        <footer className="text-center mono text-xs text-slate-500 mt-10">
          MERIDIAN · Graph Hacks: Context for AI Agents · Oct 15–18 2026 · FalkorDB inside · synthetic data only · MIT
        </footer>
      </section>
    </main>
  );
}
