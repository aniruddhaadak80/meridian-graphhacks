---
title: "I Gave My AI Agents a Graph for a Brain — and They Started Reasoning Like Engineers"
published: false
tags: falkordb, ai, opensource, hackathon
canonical_url:
cover_image:
---

Agents forget. They hallucinate owners, invent runbooks, and can't show their work. For **Graph Hacks 2026** (WeMakeDevs × FalkorDB) I built **Meridian** — a 4-agent crew that shares one **FalkorDB graph** as memory, reasoning engine, and action log. One build, all three tracks.

🔗 **Live:** https://meridian-graphhacks.vercel.app/console · **Repo:** https://github.com/aniruddhaadak80/meridian-graphhacks

![Meridian console](https://raw.githubusercontent.com/aniruddhaadak80/meridian-graphhacks/main/public/screenshots/console.png)

## The problem in one outage

19:02: checkout fails, payments p99 spikes. A normal agent says "maybe rollback?" Meridian traverses:

```
(Incident inc_2041)-[:AFFECTS]->(Service payments-api)
  <-[:DEPLOYED_TO]-(Deploy)<-[:DEPLOYED_AS]-(PR pr_882)
  <-[:AUTHORED]-(Person Priya Nair)
```

...plus a second suspect (`pr_884` auth TTL change), blast radius over `DEPENDS_ON*` (6 downstream services), PageRank centrality (auth-service is the load-bearing node), and two prior episodes ("batch>48 needs canary", "auth changes need payments canary"). Then it *acts*: freeze deploys, rollback, page Marcus Webb — written back as `Task` nodes.

Every hop is clickable. No path found = proof of safety, not an empty vector result.

![Agent flow](https://raw.githubusercontent.com/aniruddhaadak80/meridian-graphhacks/main/public/diagrams/agent-flow.svg)

## One graph, three jobs

- **Act (Track 01):** root-cause + `blastRadius` BFS + PageRank as MCP tools. `graph.shortestPath` between ticket `tk_5101` and `inc_2041` proves linkage in 1 hop.
- **Remember (Track 02):** Episodes/Facts/Runbooks/Tasks/Sessions are nodes. `memory.recall` is a traversal. One graph per tenant (`meridian_acme-robotics`, `meridian_globex`) = isolation without extra infra.
- **Know (Track 03):** "Who knows payments-api?" ranks via WORKED_ON + AUTHORED + KNOWS. Decisions carry rationale + constraint edges. Docs carry freshness scores.

![Data model](https://raw.githubusercontent.com/aniruddhaadak80/meridian-graphhacks/main/public/diagrams/datamodel.svg)

## Why FalkorDB, not Postgres+vectors

Three traversals per agent step at interaction latency. Try expressing "who worked on a project using this system, weighted by PRs touching it" in SQL + 6 round trips — then do it in one Cypher:

```cypher
MATCH path = (i:Incident {id: 'inc_2041'})-[:AFFECTS]->(s:Service)
  <-[:DEPLOYED_TO]-(d:Deploy)<-[:DEPLOYED_AS]-(pr:PR)<-[:AUTHORED]-(u:Person)
RETURN pr.title, u.name, d.at ORDER BY d.at DESC
```

Multigraph isolation (thousands of tenant graphs, one instance) made per-customer memory trivial. FalkorDB speaks the Redis protocol, so queries go through `GRAPH.QUERY` via the official `falkordb` npm client — no Bolt, no separate infra.

## Build notes (reproducible)

- Next.js 15 + `falkordb` npm (`FalkorDB.connect`, `selectGraph`, `graph.query`). `FALKORDB_URL` on = live; unset = deterministic in-memory mirror so the Vercel demo never dies.
- Seed: synthetic "Northwind Robotics" (87 nodes / 117 edges per tenant). `POST /api/seed`.
- Eval: `npm run eval` — 9 checks across all 3 tracks, exit 1 on fail.
- MCP: `GET/POST /api/mcp` with 8 tools; the Agent Timeline shows which fired + exact Cypher.
- Verified: `tsc --noEmit` clean, `next build` passes, live deploy green.

## What I'd do with a month

Vector index on Episodes for hybrid recall, FalkorDB change-data-capture → live incident edges, and multi-agent gating for the "page human" action.

If your agents still wake up with amnesia every session — give them a graph. 🕸️

---
*Built solo for Graph Hacks: Context for AI Agents (Oct 15–18, 2026). Drafted with AI coding assistance; every query, algorithm, and architecture decision verified by the author (`npm run eval`: 9/9). All data synthetic.*
