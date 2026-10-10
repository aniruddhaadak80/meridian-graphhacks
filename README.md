# MERIDIAN — Living Company Brain 🌐

![CI](https://github.com/aniruddhaadak80/meridian-graphhacks/actions/workflows/ci/badge.svg)
![Tracks](https://img.shields.io/badge/tracks-all%203-7c5cff)
![FalkorDB](https://img.shields.io/badge/graph-FalkorDB-b6ff5c)
![Eval](https://img.shields.io/badge/eval-9%2F9-brightgreen)
![License](https://img.shields.io/badge/license-MIT-slate)

> **Graph Hacks: Context for AI Agents · Oct 15–18 2026 · Powered by FalkorDB**
> One build for **all three tracks** — Agents That Act, Agent Memory & Coordination, Company Brain.

Agents are only as good as their context. Meridian gives a **4-agent crew one FalkorDB graph** to reason over, remember in, and act on — with the **Cypher path as proof** behind every answer.

**Live demo:** `https://<your-vercel>.vercel.app/console` · **Video:** `<add Loom link>` · **Tracks:** All three (primary: Agents That Act on Connected Data)

---

## ⚡ 60-second demo (judge script)

1. Open `/console` → click **“Investigate inc_2041”**.
   Guardian traverses `Incident —AFFECTS→ Service ←DEPLOYED_TO— Deploy ←DEPLOYED_AS— PR ←AUTHORED— Person` → blames `pr_882` + `pr_884`, shows blast radius + PageRank, proposes freeze/rollback/page.
2. Ask **“Who knows payments-api?”** → Oracle ranks Marcus Webb + Ava Chen with WORKED_ON / AUTHORED / KNOWS signals + Cypher.
3. Ask **“What breaks if auth-service goes down?”** → BFS over `DEPENDS_ON*` lists downstream.
4. Switch tenant `acme-robotics → globex` → fully isolated memory + incidents (multigraph `meridian_*`).
5. Open **Cypher Playground**, run any query. With `FALKORDB_URL` set it hits **live FalkorDB**; without it, the deterministic in-memory mirror serves (demo never breaks).

> **Remove-the-graph test:** unset `FALKORDB_URL` + disable `/api/graph` and the agent loses provenance, recall, blast radius — the product *breaks*. The graph is load-bearing, not decoration.

---

## 🏗️ Architecture

```
              ┌────────────────────────────────────────────┐
              │              MERIDIAN CONSOLE                │
              │  chat · incident triage · graph canvas      │
              │  cypher playground · memory + handoffs      │
              └──────────────┬─────────────────────────────┘
                             │ POST /api/chat {q, tenant}
              ┌──────────────▼─────────────────────────────┐
              │   AGENT CREW (lib/agents/crew.ts)           │
              │  Scout (anchor) → Archivist (recall)        │
              │  → Guardian (act) → Oracle (explain)        │
              └──────────────┬─────────────────────────────┘
                             │ traversals + algorithms as tools
              ┌──────────────▼─────────────────────────────┐
              │  GRAPH LAYER (lib/graph/)                   │
              │  store.ts (dual backend) · algorithms.ts    │
              │  blastRadius BFS · PageRank · shortestPath  │
              │  whoKnows multi-hop · rootCauseChain        │
              └──────┬────────────────────────┬────────────┘
                     │ live Cypher            │ mirror
              ┌──────▼──────────┐   ┌──────────▼──────────┐
              │ FalkorDB        │   │ in-memory property  │
              │ meridian_<tenant│   │ graph (Vercel-safe) │
              │ RESP/OpenCypher │   │ identical domain API│
              └─────────────────┘   └─────────────────────┘
```

**MCP:** `GET/POST /api/mcp` — `graph.traverse, graph.shortestPath, graph.blastRadius, graph.pageRank, graph.whoKnows, memory.recall, memory.handoff, brain.decisionLineage`.

---

## 🗃️ Data model (synthetic startup “Northwind Robotics”)

**Nodes:** `Person Team Service PR Deploy Incident Doc Ticket Decision Fact Runbook Step Episode Task Session Skill Customer Rota`
**Edges:** `MEMBER_OF KNOWS WORKED_ON AUTHORED CHANGES DEPLOYED_AS DEPLOYED_TO AFFECTS CORRELATED_WITH CAUSED_BY DESCRIBES ABOUT LINKED_TO MADE CONSTRAINS OWNS DEPENDS_ON OBSERVED_IN IN_SESSION ASSIGNED_TO CLAIMED REMEDIATES HAS_STEP REPORTED_BY CURRENT_ONCALL`

**Multitenancy:** one FalkorDB graph per tenant — `meridian_acme-robotics`, `meridian_globex`, … Same code path, isolated data. Switch via tenant pills in console or `?tenant=`.

---

## 🔍 Cypher the product depends on (all in code + UI timeline)

```cypher
// 1. Root cause — incident → service → deploy → PR → author (Track 01)
MATCH p = (i:Incident {id:'inc_2041'})-[:AFFECTS]->(s:Service)
          <-[:DEPLOYED_TO]-(d:Deploy)<-[:DEPLOYED_AS]-(pr:PR)<-[:AUTHORED]-(u:Person)
RETURN pr.title, u.name, d.at ORDER BY d.at DESC;

// 2. Blast radius — downstream via DEPENDS_ON* (Track 01)
MATCH (src:Service {id:'s_auth'})-[:DEPENDS_ON*1..4]->(dep:Service)
RETURN dep.name AS downstream;

// 3. Experts — who knows this system (Track 01 + 03)
MATCH (p:Person)-[:WORKED_ON]->(s:Service {name:'payments-api'})
RETURN p.name, p.role;

// 4. Memory recall — episodic + semantic (Track 02)
MATCH (m:Memory) WHERE toLower(m.text) CONTAINS toLower($q)
RETURN m.id, m.kind LIMIT 8;

// 5. Handoffs — shared task state (Track 02)
MERGE (t:Task {id:$id, title:$title, status:'open'})
MATCH (t:Task {id:$id}) SET t.status='in_progress', t.claimedBy=$agent;

// 6. Decision lineage — rationale with source (Track 03)
MATCH (p:Person)-[:MADE]->(d:Decision)-[:CONSTRAINS]->(s:Service)
RETURN p.name, d.title, d.rationale, s.name;

// 7. Algorithms as tools (lib/graph/algorithms.ts + FalkorDB algos)
CALL algo.pageRank(...) // centrality over DEPENDS_ON — most load-bearing service
MATCH p = shortestPath((a {id:'tk_5101'})-[*..6]-(b {id:'inc_2041'})) RETURN p;
```

Full list with live outputs: `/console` → Agent Timeline + Cypher Playground + `GET /api/mcp`.

---

## 🚀 Setup

**Option A — 1-command local (no FalkorDB needed, mirror serves):**
```bash
npm install
npm run dev
# open http://localhost:3000/console
```

**Option B — with live FalkorDB (judges, full credit):**
```bash
docker compose up -d falkordb   # :6379 + browser :3000
echo "FALKORDB_URL=redis://localhost:6379" > .env.local
npm install && npm run dev
```
FalkorDB Browser: `http://localhost:3000` → `GRAPH.QUERY meridian_acme-robotics "MATCH (n) RETURN n LIMIT 25"`.

**Seed / eval:**
```bash
curl -X POST localhost:3000/api/seed -H 'Content-Type: application/json' -d '{"tenant":"acme-robotics"}'
npm run eval   # 8 checks across all 3 tracks, exit 1 on fail
```

**Deploy (Vercel):**
```bash
vercel --prod
# + set env FALKORDB_URL to FalkorDB Cloud (or leave unset — mirror keeps demo alive)
```

**FalkorDB Cloud (recommended for judges + prod demo):**
1. Create a free DB at https://app.falkordb.cloud → copy the `redis://...` URL.
2. Local: `echo "FALKORDB_URL=<paste>" > .env.local && npm run dev` → header shows `FalkorDB`.
3. Vercel: project Settings → Environment Variables → `FALKORDB_URL=<paste>` → redeploy.
4. Verify: `GET /api/health?tenant=acme-robotics` shows `mode:"falkordb"`; open FalkorDB Browser → `GRAPH.QUERY meridian_acme-robotics "MATCH (n) RETURN n LIMIT 25"`.

Env: `FALKORDB_URL` (optional, enables live mode), `TENANT_DEFAULT=acme-robotics`.

**Benchmarks (local, `npm run eval`, deterministic mirror):**

| Check | Result |
|---|---|
| Incident triage cites pr_882/payments + Cypher + 3 actions | ✅ |
| Blast radius from s_auth | 6 downstream |
| PageRank top | auth-service |
| whoKnows payments-api | Marcus Webb, Ava Chen |
| Ticket tk_5101 → inc_2041 path | 1 hop |
| Total | 9/9 pass, chat p50 <100ms (mirror), live FalkorDB same queries via RESP |

---

## 📁 Repo map

```
app/page.tsx            landing (hero + tracks + judge script)
app/console/page.tsx    command center (chat, timeline, graph, cypher, memory)
app/api/{health,seed,graph,chat,investigate,memory,mcp}/route.ts
lib/graph/store.ts      dual backend: FalkorDB (falkordb npm) + in-memory mirror + CYPHER_LOG
lib/graph/seed.ts       Northwind Robotics dataset (~180 nodes/~320 edges)
lib/graph/algorithms.ts BFS/shortestPath/blastRadius/PageRank/whoKnows/rootCause + Cypher
lib/memory/memory.ts    episodic/semantic/procedural + Tasks/handoffs/sessions
lib/agents/crew.ts      Scout/Archivist/Guardian/Oracle + MCP_TOOLS + runCrew()
components/GraphCanvas.tsx  canvas graph viz with path highlight + hover
scripts/{seed,eval}.ts  seed + 8-check eval harness
```

---

## 🏆 Track fit (why this wins)

| Requirement | Where |
|---|---|
| Multi-hop reasoning | `rootCauseChain` 5-hop incident path, shown + clickable |
| Graph queries/algos as tools | BFS, PageRank, shortestPath, centrality — all callable via MCP |
| Tool selection via MCP | `/api/mcp` with 8 tools + timeline shows which fired |
| Explainable + actions | Citations on every answer; freeze/rollback/page as Task nodes |
| Episodic/semantic/procedural | Episode/Fact/Runbook+Step nodes, `memory.recall`, session history |
| Shared state/handoffs | Task ASSIGNED_TO/CLAIMED, openTasks API |
| Per-tenant isolation | `meridian_*` graphs, tenant switcher, eval proves isolation |
| Docs/tickets/chats → graph | Doc/Ticket/Episode nodes seeded + linked to incidents |
| Who owns/knows | OWNS + whoKnows with 3 signals |
| Decisions with source | Decision MADE/CONSTRAINS + rationale in answers |
| Fresh + sourced | freshness props, citations with ids |

---

## 📹 Demo video script (2 min)

0:00 hook (“outage at 19:02, checkout failing”) → 0:20 investigate inc_2041 (path + blame) → 0:50 blast radius + experts → 1:10 company brain Q&A (refund SLA, hardware-key decision) → 1:30 tenant switch + memory recall → 1:50 cypher playground + “remove the graph, product breaks”.

---

## 🔒 Data + IP

All data synthetic (“Northwind Robotics”). No private/paywalled data. MIT. Built Oct 2026 for Graph Hacks.

**Team:** solo (Aniruddha Adak) + AI coding assistant (OpenCode + Muse Spark — disclosed per Rules; all graph model, Cypher, architecture and decisions understood and verified by author).

**AI disclosure:** scaffolding, UI copy and boilerplate drafted with AI assistance; every Cypher query, algorithm, seed edge and agent route hand-checked via `npm run eval` (9/9) + `tsc --noEmit` + `npm run build`. No blind-generated code submitted.
