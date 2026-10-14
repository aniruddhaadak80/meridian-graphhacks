# Submission — Graph Hacks: Context for AI Agents

**Project:** MERIDIAN — Living Company Brain
**Team:** solo (Aniruddha Adak) + AI coding assistant (disclosed per Rules — graph model, queries and architecture verified by the author)
**Tracks:** All three — 01 Agents That Act on Connected Data · 02 Agent Memory & Coordination · 03 Company Brain (primary: 01)
**Repo:** `https://github.com/aniruddhaadak80/meridian-graphhacks` (public, MIT)
**Live:** `https://meridian-graphhacks.vercel.app/console` (+ `/` landing)
**Video:** `<paste Loom link>` — shot-list in [`DEMO-VIDEO-SCRIPT.md`](./DEMO-VIDEO-SCRIPT.md)
**FalkorDB:** primary graph DB — official `falkordb` npm client, RESP/OpenCypher, one graph per tenant (`meridian_<tenant>`). Real engine paths: `FALKORDB_EMBEDDED=1` (zero-config, linux/mac), Docker, or any cloud `FALKORDB_URL`. CI runs the live embedded engine on every push.

---

## Copy-paste for the submission form

**One-liner**
> A 4-agent crew that reasons, remembers and acts on one FalkorDB graph — every answer ships with the Cypher path that produced it.

**Description (paste this)**
> **MERIDIAN** is a living company brain for AI agents, built on FalkorDB.
>
> Four agents — Scout, Archivist, Guardian, Oracle — share one graph as a blackboard. Ask *"investigate inc_2041"* and Guardian traverses `Incident —AFFECTS→ Service ←DEPLOYED_TO— Deploy ←DEPLOYED_AS— PR ←AUTHORED— Person`, ranks correlated suspects across services, runs blast-radius BFS and PageRank centrality, then acts: freeze deploys, propose the rollback, page the owner. Every claim cites node ids and shows the Cypher it ran.
>
> **Track 01 — Agents that act:** 5-hop root cause, cross-service correlation, BFS blast radius, PageRank + shortestPath as MCP tools, actions written back as graph nodes.
> **Track 02 — Memory & coordination:** episodic / semantic / procedural memory as nodes; recall is a traversal that returns *nothing* when there is no evidence; sessions and task handoffs (`ASSIGNED_TO` / `CLAIMED`) persist per tenant.
> **Track 03 — Company brain:** owners and experts ranked by graph evidence, decisions traced to maker + rationale + constraint, docs with freshness.
>
> **The graph is load-bearing — we prove it, not assert it.** `npm run ablation` keeps every record and severs every relationship: **8/8 capabilities collapse** (root cause, blast radius, PageRank, experts, path finding, actions, citations). A flat table cannot reproduce any of them. The same proof runs live at `/api/proof` and in the console UI.
>
> **Inspect it yourself:** the whole graph exports as valid idempotent OpenCypher (`/api/cypher?mode=full` or `npm run cypher`) — `CREATE INDEX` plus one `MERGE` per node and edge — so you can load it into FalkorDB Browser and query it directly.
>
> Verified: 24 unit/integration tests, 13 track checks, 8/8 ablation, live Cypher job in CI. Synthetic data only.

---

## Why the graph does real work (rules #3)

Keep every **record**, cut every **relationship**:

| Capability | With graph | Graph severed |
|---|---|---|
| Root-cause chain found | true | false |
| Blast-radius services | 6 | 0 |
| PageRank top service | auth-service | none |
| Experts found (graph evidence) | 2 | 0 |
| Ticket→incident path | 1 hop | none |
| Actions proposed | 3 | 0 |
| Citations (sources) | 10 | 2 |

Reproduce: `npm run ablation` · live: [`/api/proof`](https://meridian-graphhacks.vercel.app/api/proof)

## Key Cypher / algorithms
README § "Cypher the product depends on" (7 queries) · `lib/graph/algorithms.ts` · Agent Timeline in the UI · `GET /api/mcp` (8 tools) · `GET /api/cypher`.

## How to run (judges)

```bash
npm install && npm run dev          # → /console  (no DB needed, mirror serves)

# real FalkorDB, any of:
FALKORDB_EMBEDDED=1 npm run dev      # zero-config embedded (linux/mac)
docker compose up -d falkordb && FALKORDB_URL=redis://localhost:6379 npm run dev

npm run verify        # typecheck + 24 tests + 13 eval + 8/8 ablation
npm run live:seed     # push the graph into a real FalkorDB instance
npm run live:check    # run all 7 product queries against the engine, print ms + results
```

## Checklist (per Rules)
- [x] Public repo + README (setup, data model, Cypher/algos, tracks)
- [ ] Demo video (<3 min) — script ready, needs recording
- [x] Live deployment (Vercel) + complete local setup
- [x] Synthetic data only (fictional "Northwind Robotics")
- [x] Original work during the hackathon (Oct 2026)
- [x] Track named: all three / primary 01
- [x] AI-assistant use disclosed