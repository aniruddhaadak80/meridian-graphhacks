# Demo Video Shot-List — MERIDIAN (2 min 30 s)

Submission requires a demo video. Record with Loom or OBS. Keep it **under 3 minutes**.
Two browser tabs open before you start: `/` (landing) and `/console`.

---

## 0:00–0:12 — Hook (landing, `meridian-graphhacks.vercel.app`)

**Say:** "Checkout is failing. Payments p99 is spiking. A normal agent says *maybe roll back?* — this one shows you exactly which deploy broke it, and why it's allowed to say that."

> Screen: hero + the three track cards. Scroll slowly. Don't linger.

---

## 0:12–0:35 — Ask the incident question (console)

Click the preset chip **"Investigate inc_2041 — payments p99 spike"**.

**Say:** "Four agents share one FalkorDB graph. Scout anchors the incident, Archivist recalls what we learned last time, Guardian runs the root-cause traversal and blast radius, Oracle finds who actually owns it."

> Let the answer render. Point at **Likely cause** and **Suspect ranking**.

---

## 0:35–0:58 — Show the proof, not the claim

Scroll to **Agent Timeline**.

**Say:** "Every step shows the tool, the input, and the Cypher it ran. Five hops: Incident → Service → Deploy → PR → Person. That's the path, not a summary of it."

> Hover/point at one Cypher block. Read the shape aloud: `MATCH p = (i:Incident)-[:AFFECTS]->(s)<-[:DEPLOYED_TO]-(d)<-[:DEPLOYED_AS]-(pr)<-[:AUTHORED]-(u)`.

---

## 0:58–1:15 — The graph does the work (ablation) ⭐ judges' favourite moment

Click **run ablation**.

**Say:** "Hackathon rules say: if the product still works without the graph, the graph is decoration. So we test it. We keep every record and cut every relationship — and watch the answers collapse. Eight of eight. A flat table cannot do this."

> Let the table fill in. This is your strongest 15 seconds — do not rush it.

---

## 1:15–1:32 — Company brain (chat)

Type: `Who knows payments-api?` then `why did we require hardware keys for oncall?`

**Say:** "Now the company-brain track. Who knows what, and why we made a decision — with the source node cited, not a confident guess."

> Show the citation chips under the answer.

---

## 1:32–1:48 — Memory persists across sessions (Track 02)

Click the **globex** tenant pill, then back to **acme-robotics**.

**Say:** "Memory is nodes, not a session buffer. One graph per tenant — Globex's incidents and episodes never leak into Acme's. Let me prove it."

Click **recall** in Shared Memory.

**Say:** "Recall is a traversal, not a similarity score. Zero evidence returns nothing, rather than the nearest thing that isn't related."

---

## 1:48–2:05 — Real FalkorDB, inspectable (Cypher panel)

Open the **Cypher Playground**, run:
```
MATCH (p:Person)-[:AUTHORED]->(pr:PR)-[:CHANGES]->(s:Service) RETURN p.name, pr.title, s.name LIMIT 5
```
**Say:** "Any query runs against FalkorDB directly. And the whole graph exports as real OpenCypher — index creation, one MERGE per node and edge — so you can load it into FalkorDB Browser and poke at it yourself."

---

## 2:05–2:20 — Remove-the-graph test, stated plainly

**Say:** "Unset `FALKORDB_URL` and it falls back to an in-memory mirror so the demo never dies — but the graph is still doing the reasoning, because the answers come from traversals over relationships. The mirror is a transport, not the logic."

> Do **not** claim this runs on a live FalkorDB instance unless you actually set one up. `/api/health` always states which backend is active.

---

## 2:20–2:30 — Close

**Say:** "MERIDIAN. Graph Hacks, all three tracks. Repo and live demo in the description. Happy to take questions."

> Card on screen: repo URL + live URL + "All 3 tracks".

---

## Recording checklist

- [ ] 1440×900 browser, 100% zoom, dark mode already (site is dark)
- [ ] Close Discord/WhatsApp notifications, no desktop notifications in frame
- [ ] Cursor movements deliberate — point at the Cypher block, don't jiggle
- [ ] Every claim on screen is backed by something visible in the UI
- [ ] Say the repo + live URL out loud in the last 10 seconds
- [ ] If asked "is this real FalkorDB?" → answer honestly: mirror in the cloud demo, one env var to point at a real instance; CI runs the real embedded engine on every push

## Backup plan if something breaks live

The site is stable (all endpoints 200), but have a 20-second fallback: open
`https://meridian-graphhacks.vercel.app/api/proof` — it renders the ablation verdict as JSON,
which still proves the graph is load-bearing even if the UI misbehaves.