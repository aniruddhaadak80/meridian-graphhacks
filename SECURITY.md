# Security Policy

Meridian uses **synthetic data only** — the seeded "Northwind Robotics" graph contains no real people, customers, or credentials.

## Reporting a vulnerability

Email **aniruddhaadak80@gmail.com** (or open a private security advisory on GitHub). Please do not open public issues for security problems.

What to include: affected endpoint/agent, backend mode (live FalkorDB or mirror), and reproduction steps.

## Out of scope

- Anything requiring data to be replayed that is not synthetic
- FalkorDB server CVOs — report those upstream to [FalkorDB](https://github.com/FalkorDB/falkordb)

## Operational notes for live deployments

- Set `FALKORDB_URL` via your host's secret store (Vercel/Railway env, never a committed `.env`)
- Run FalkorDB behind auth if it is internet-reachable; per-tenant graphs isolate data but not the instance
- Cypher is always parameterized in app code — keep it that way in PRs
