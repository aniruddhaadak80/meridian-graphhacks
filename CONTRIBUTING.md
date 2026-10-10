# Contributing to Meridian

Thanks for looking — PRs welcome, especially from hackathon participants.

## The one rule
**The graph must stay load-bearing.** If your change works the same with FalkorDB removed, it belongs in a different project. Every answer should be traceable to nodes, edges, and Cypher.

## Setup

```bash
npm install
npm run dev                  # mirror mode — no FalkorDB needed
# live mode:
docker compose up -d falkordb
echo "FALKORDB_URL=redis://localhost:6379" > .env.local
npm run dev
```

## Before opening a PR

```bash
npx tsc --noEmit --incremental false   # typecheck
npm run eval                         # 9 checks across all 3 tracks
npm run build                        # production build
```

## Conventions

| Area | Convention |
|---|---|
| Graph writes | Go through `lib/graph/store.ts` (`upsertNode` / `addEdge` / `mirrorWrite`) so the Cypher log stays complete |
| Agent tools | Add to `MCP_TOOLS` in `lib/agents/crew.ts` **and** `GET /api/mcp` — both the definition and the handler |
| Answers | Cite node ids; if no path is found, say so explicitly ("no path = proof of safety") |
| Cypher | Parameterize (`$q`), never string-interpolate user input |
| Data | Synthetic only. No private, paywalled, or personal data |
| Commits | Conventional prefixes, e.g. `feat(track02): procedural memory decay` |

## Adding a tool (recipe)

1. Implement the traversal/algorithm in `lib/graph/algorithms.ts`, returning `{ ..., cypher }` alongside results.
2. Register it in `MCP_TOOLS` with a description and the Cypher-equivalent.
3. Handle it in `POST /api/mcp`.
4. Emit an `AgentStep` from `runCrew` when it fires — judges love seeing the timeline.
5. Add an eval check in `scripts/eval.ts`.

## Hackathon context

Built for **Graph Hacks: Context for AI Agents** (Oct 15–18 2026). Synthetic "Northwind Robotics" dataset. MIT licensed.
