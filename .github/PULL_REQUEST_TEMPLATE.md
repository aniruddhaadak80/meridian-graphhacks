## What & why
<!-- One logical change. Link the issue: Fixes #123 -->

## How it touches the graph
<!-- New nodes/edges/algorithms, or an agent tool. The graph must stay load-bearing. -->

## How to test
```bash
npm run eval          # 9 checks must stay green
# or, for a new agent behavior:
curl -X POST localhost:3000/api/chat -H 'Content-Type: application/json' \
  -d '{"tenant":"acme-robotics","question":"..."}'
```

## Checklist
- [ ] Cypher shown for every new claim (Agent Timeline style)
- [ ] `npx tsc --noEmit --incremental false` clean
- [ ] Demo still works with **no** `FALKORDB_URL` (mirror mode)
- [ ] README updated (data model / Cypher list / screenshots if UI changed)
- [ ] No secrets, no private data
