# Submission — Graph Hacks: Context for AI Agents

**Project:** MERIDIAN — Living Company Brain
**Team:** solo (Aniruddha Adak) + AI pair
**Tracks:** All three — 01 Agents That Act on Connected Data · 02 Agent Memory & Coordination · 03 Company Brain (primary: 01)
**Repo:** `<paste public GitHub URL>` (public, MIT)
**Live:** `https://meridian-graphhacks.vercel.app/console` (+ `/` landing)
**Video:** `<paste Loom/YouTube link, <3 min>`
**FalkorDB:** primary graph DB (`falkordb` npm, RESP/OpenCypher, `meridian_<tenant>` graphs). Live with `FALKORDB_URL`; in-memory mirror keeps Vercel demo alive.

## What it does (1 para)
4-agent crew (Scout/Archivist/Guardian/Oracle) shares one FalkorDB graph as blackboard. Ask “investigate inc_2041” → 5-hop root-cause to PR+author, blast radius, PageRank centrality, expert ranking, freeze/rollback/page actions — every claim cites nodes + Cypher. Memory (episodes/facts/runbooks/tasks) persists per tenant; company Q&A traces owners, decisions, docs with sources.

## Graph does real work (remove-test)
Kill FalkorDB/unset URL → chat loses provenance + recall + blast radius (mirror is best-effort demo only; `/api/graph` Cypher log proves live path). No graph = no product.

## Key Cypher / algos
See README § “Cypher the product depends on” (7 queries) + `lib/graph/algorithms.ts` + Agent Timeline in UI + `GET /api/mcp`.

## How to run (judges)
```
npm install && npm run dev  → /console
# live FalkorDB:
docker compose up -d falkordb
FALKORDB_URL=redis://localhost:6379 npm run dev
npm run eval  # 8 checks, all tracks
```

## Checklist (per Rules)
- [x] Public repo + README (setup, data model, Cypher/algos, track)
- [x] Demo video (<3 min, working project)
- [x] Live deploy (Vercel) + local setup
- [x] Synthetic data only
- [x] Original work during hackathon (Oct 2026)
- [x] Track named: All three / primary 01
