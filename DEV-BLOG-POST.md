---
title: "I Gave My AI Agents a Graph for a Brain — and They Started Reasoning Like Engineers"
published: false
tags: falkordb, graphs, aiagents, hackathon
canonical_url:
---

Agents forget. They hallucinate owners, invent runbooks, and can't show their work. For Graph Hacks 2026 I built **Meridian** — a 4-agent crew that shares one **FalkorDB graph** as memory, reasoning engine, and action log.

## The problem in one outage

19:02: checkout fails, payments p99 spikes. A normal agent says "maybe rollback?" Meridian traverses:

```
(Incident inc_2041)-[:AFFECTS]->(Service payments-api)
  <-[:DEPLOYED_TO]-(Deploy)<-[:DEPLOYED_AS]-(PR pr_882)
  <-[:AUTHORED]-(Person Marcus Webb)
```

...plus a second suspect (`pr_884` auth TTL change), blast radius over `DEPENDS_ON*`, PageRank centrality, and two prior episodes ("batch>48 needs canary", "auth changes need payments canary"). Then it *acts*: freeze deploys, rollback, page Ava Chen — written back as `Task` nodes.

Every hop is clickable. No path found = proof of safety, not an empty vector result.

## One graph, three jobs

- **Act (Track 01):** root-cause + `blastRadius` BFS + PageRank as MCP tools. `graph.shortestPath` between ticket `tk_5101` and `inc_2041` proves linkage.
- **Remember (Track 02):** Episodes/Facts/Runbooks/Tasks/Sessions are nodes. `memory.recall` is a traversal. One graph per tenant (`meridian_acme-robotics`, `meridian_globex`) = isolation without extra infra.
- **Know (Track 03):** "Who knows payments-api?" ranks via WORKED_ON + AUTHORED + KNOWS. Decisions carry rationale + constraint edges. Docs carry freshness.

## Why FalkorDB, not Postgres+vectors

Three traversals per agent step at interaction latency. Try expressing "who worked on a project using this system, weighted by PRs touching it" in SQL + 6 round trips — then do it in one Cypher. Multigraph isolation (thousands of tenant graphs, one instance) made per-customer memory trivial.

```cypher
MATCH p=(i:Incident)-[:AFFECTS]->(s)<-[:DEPLOYED_TO]-(d)
        <-[:DEPLOYED_AS]-(pr)<-[:AUTHORED]-(u)
RETURN pr.title, u.name
```

## Build notes (reproducible)

- Next.js 15 + `falkordb` npm (`FalkorDB.connect`, `selectGraph`, `graph.query`). `FALKORDB_URL` on = live; unset = deterministic in-memory mirror so the Vercel demo never dies.
- Seed: synthetic "Northwind Robotics" (~180 nodes/~320 edges). `POST /api/seed`.
- Eval: `npm run eval` — 8 checks across tracks, exit 1 on fail.
- MCP: `GET/POST /api/mcp` with 8 tools; timeline shows which fired + exact Cypher.

## What I'd do with a month

Vector index on Episodes for hybrid recall, FalkorDB change-data-capture → live incident edges, and Guild-style multi-agent gating for the "page human" action.

Repo + live console linked below. If your agents still wake up with amnesia every session — give them a graph. 🕸️
