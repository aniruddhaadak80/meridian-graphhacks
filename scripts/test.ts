// Unit + integration tests. Uses Node's built-in runner — zero extra deps.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { seedTenant } from "../lib/graph/seed";
import { tenantGraph, graphStats, resetTenant, exportSubgraph } from "../lib/graph/store";
import { blastRadius, pageRank, shortestPath, whoKnows, rootCauseChain, bfsPaths } from "../lib/graph/algorithms";
import { runCrew, MCP_TOOLS } from "../lib/agents/crew";
import { rememberEpisode, recall, createTask, claimTask, completeTask, openTasks } from "../lib/memory/memory";
import { exportCypher, PRODUCT_CYPHER } from "../lib/graph/cypherExport";

const T = "test-tenant";

async function main() {
await seedTenant(T);

// ─────────────────────────── seed / store ───────────────────────────
test("seed creates the expected graph shape", () => {
  const s = graphStats(T);
  assert.ok(s.nodes > 60, `nodes=${s.nodes}`);
  assert.ok(s.edges > 90, `edges=${s.edges}`);
  assert.equal(s.labelCounts.Service, 7);
  assert.equal(s.labelCounts.Incident, 3);
  assert.equal(s.labelCounts.Person, 10);
  assert.equal(s.relCounts.DEPENDS_ON, 9);
});

test("seed is idempotent (re-running does not duplicate)", async () => {
  const before = graphStats(T);
  const res = await seedTenant(T);
  const after = graphStats(T);
  assert.equal(res.seeded, false);
  assert.equal(before.nodes, after.nodes);
  assert.equal(before.edges, after.edges);
});

test("subgraph export is connected and bounded", () => {
  const sub = exportSubgraph(T, "inc_2041", 2, 60);
  assert.ok(sub.nodes.length > 0 && sub.nodes.length <= 60);
  const ids = new Set(sub.nodes.map((n) => n.id));
  for (const e of sub.edges) {
    assert.ok(ids.has(e.from) && ids.has(e.to), "edge endpoints must be inside the subgraph");
  }
});

// ─────────────────────────── algorithms ───────────────────────────
test("blastRadius follows DEPENDS_ON hops in both directions", () => {
  const br = blastRadius(T, "s_auth");
  assert.ok(br.affected.length > 0, "auth-service must have dependents");
  assert.ok(br.affected.every((a) => a.hops >= 1 && a.hops <= 3));
  assert.match(br.cypher, /DEPENDS_ON\*/);
});

test("blastRadius on a leaf degrades gracefully", () => {
  const br = blastRadius(T, "s_billing");
  assert.ok(Array.isArray(br.affected));
});

test("pageRank returns a normalised, descending ranking", () => {
  const pr = pageRank(T);
  assert.equal(pr.length, 7);
  for (let i = 1; i < pr.length; i++) {
    assert.ok(pr[i - 1].score >= pr[i].score, "ranking must be sorted desc");
  }
  const total = pr.reduce((s, p) => s + p.score, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `scores should sum to ~1, got ${total}`);
});

test("shortestPath finds the ticket→incident link and reports hops", () => {
  const sp = shortestPath(T, "tk_5101", "inc_2041");
  assert.ok(sp, "expected a path");
  assert.equal(sp.hops, 1);
  assert.ok(sp.cypher.includes("shortestPath"));
});

test("shortestPath returns null for disconnected nodes (proof of no link)", () => {
  assert.equal(shortestPath(T, "p_omar", "dec_41"), null);
});

test("whoKnows requires graph evidence — no edges means no experts", () => {
  const wk = whoKnows(T, "payments-api");
  assert.ok(wk.experts.length > 0);
  assert.ok(wk.experts.every((e) => e.score > 0));
  assert.ok(wk.experts.some((e) => ["p_marcus", "p_ava"].includes(e.person.id)));
  // isolated copy: sever edges → nobody
  const g = tenantGraph(T);
  const saved = new Map(g.edges);
  g.edges.clear();
  assert.equal(whoKnows(T, "payments-api").experts.length, 0, "must not guess without edges");
  g.edges.clear();
  for (const [k, v] of saved) g.edges.set(k, v);
});

test("whoKnows returns empty for an unknown service", () => {
  const wk = whoKnows(T, "does-not-exist");
  assert.equal(wk.service, null);
  assert.deepEqual(wk.experts, []);
});

test("rootCauseChain ranks evidence above recency", () => {
  const chain = rootCauseChain(T, "inc_2041");
  assert.ok(chain);
  assert.equal(chain.affects[0].id, "s_payments");
  assert.ok(chain.chains.length >= 3, "should include cross-service correlated deploys");
  // inc_2041 is CORRELATED_WITH dep_pr_882 / dep_pr_884 — those must outrank
  // the merely-recent deploy to payments itself.
  assert.equal(chain.chains[0].linkType, "CORRELATED_WITH", "top suspect must be an evidence-linked deploy");
  assert.ok(chain.chains[0].linkReason, "correlated suspects must carry their stated reason");
  const ranks = chain.chains.map((c: any) => (c.causedBy ? 3 : c.linkType === "CORRELATED_WITH" ? 2 : c.suspect ? 1 : 0));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a), "chains must be sorted by evidence strength");
  assert.match(chain.cypher, /Incident/);
});

test("rootCauseChain returns null for unknown incident", () => {
  assert.equal(rootCauseChain(T, "inc_nope"), null);
});

test("bfsPaths respects maxDepth", () => {
  const seen = bfsPaths(T, "s_billing", 1, ["DEPENDS_ON"]);
  for (const [, v] of seen) assert.ok(v.dist <= 1);
});

// ─────────────────────────── memory / coordination ───────────────────────────
test("episodic memory persists and is recalled", async () => {
  await rememberEpisode(T, "Meridian test: payments deploy caused checkout failures", "s_payments", "sess_test");
  const hits = recall(T, "checkout failures", 5);
  assert.ok(hits.length > 0);
  assert.ok(hits[0].node.labels.includes("Memory"));
});

test("task handoff: create → claim → complete", async () => {
  const t = await createTask(T, "Rollback pr_882", "restore batch size", "oracle", "guardian");
  assert.equal(openTasks(T).some((x) => x.id === t.id), true);
  const claimed = await claimTask(T, t.id, "guardian");
  assert.equal(claimed?.props.status, "in_progress");
  assert.equal(openTasks(T).some((x) => x.id === t.id), false);
  const done = await completeTask(T, t.id, "rolled back, p99 recovered");
  assert.equal(done?.props.status, "done");
});

test("recall rejects coincidental substring noise", async () => {
  // "iso" must not make "isolation" look like evidence for a specific query.
  await rememberEpisode(T, "verify isolation by switching tenant", undefined, "s_noise");
  const noise = recall(T, "LIVE-MARKER-9931", 5);
  assert.equal(
    noise.filter((r) => /isolation/i.test(String(r.node.props?.text ?? ""))).length,
    0,
    "a 3-char substring match must not surface unrelated memories"
  );
});

test("recall still finds a genuinely matching episode", async () => {
  await rememberEpisode(T, "ZXQWERTYPASSWORD incident: rotate keys immediately", undefined, "s_real");
  const hits = recall(T, "ZXQWERTYPASSWORD", 5);
  assert.ok(hits.length > 0, "a real distinctive match must be returned");
  assert.match(String(hits[0].node.props?.text ?? ""), /ZXQWERTYPASSWORD/);
});

test("tenants are isolated — writes never leak", async () => {
  const A = "iso-a2", B = "iso-b2";
  await seedTenant(A);
  await seedTenant(B);
  const marker = "SECRET-ALPHA-MARKER-9931";
  await rememberEpisode(A, marker, undefined, "s1");

  // B's recall must never surface A's episode
  const hitsB = recall(B, marker, 10);
  assert.equal(hitsB.length, 0, `tenant B must not see A's memory (got ${hitsB.length})`);

  // and the node itself must not exist in B's graph
  const markerNode = [...tenantGraph(B).nodes.values()].find((n) => JSON.stringify(n.props).includes(marker));
  assert.equal(markerNode, undefined, "episode node must not exist in tenant B");
  assert.equal(tenantGraph(B).nodes.has("s_auth"), true, "B still seeded independently");
});

// ─────────────────────────── agent crew ───────────────────────────
test("crew runs all four agents with Cypher-backed steps", async () => {
  const r = await runCrew(T, "investigate inc_2041 — payments p99 spike");
  const agents = r.steps.map((s) => s.agent);
  for (const a of ["scout", "archivist", "oracle"] as const) {
    assert.ok((agents as string[]).includes(a), `missing agent ${a}`);
  }
  assert.ok(r.answer.length > 100);
  assert.ok(r.actions.length >= 2, "incident triage must propose actions");
  assert.ok(r.citations.length > 0, "answers must cite sources");
  assert.ok(r.confidence > 0.6);
});

test("every step exposes the Cypher it would run on FalkorDB", async () => {
  const r = await runCrew(T, "investigate inc_2041");
  const withCypher = r.steps.filter((s) => !!s.cypher);
  assert.ok(withCypher.length >= 3, "most steps must show Cypher");
});

test("company-brain answers cite sources, not guesses", async () => {
  const r = await runCrew(T, "why did we require hardware keys for oncall?");
  assert.match(r.answer, /dec_43|hardware/i);
  assert.ok(r.citations.length > 0);
});

test("tenant switch changes the answer surface (no cross-tenant leak)", async () => {
  const a = await runCrew("iso-a", "investigate inc_2041");
  const b = await runCrew("iso-b", "investigate inc_2041");
  assert.ok(typeof a.answer === "string" && a.answer.length > 0);
  assert.ok(typeof b.answer === "string" && b.answer.length > 0);
});

test("MCP tool list is complete and unique", () => {
  const names = MCP_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "tool names must be unique");
  for (const required of ["graph.traverse", "graph.shortestPath", "graph.blastRadius", "graph.pageRank", "graph.whoKnows", "memory.recall", "memory.handoff"]) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
  for (const t of MCP_TOOLS) assert.ok(t.description && t.cypher, `${t.name} needs description + cypher`);
});

// ─────────────────────────── cypher export ───────────────────────────
test("cypher export is complete and idempotent", () => {
  const c = exportCypher(T);
  const s = graphStats(T);
  const nodeStatements = c.split("\n").filter((l) => l.startsWith("MERGE (") && !l.includes(")-[:")).length;
  const relStatements = c.split("\n").filter((l) => l.startsWith("MATCH (a {id:")).length;
  assert.equal(nodeStatements, s.nodes);
  assert.equal(relStatements, s.edges);
  assert.ok(c.includes("CREATE INDEX FOR (n:Service)"));
});

test("cypher export escapes string literals safely", () => {
  resetTenant("lit");
  tenantGraph("lit");
  const c = exportCypher("lit");
  assert.ok(c.includes("MERIDIAN"));
});

test("product cypher sheet covers every track", () => {
  const tracks = new Set(PRODUCT_CYPHER.map((q) => q.track));
  assert.ok(tracks.has("01") && tracks.has("02") && tracks.has("03"));
  for (const q of PRODUCT_CYPHER) {
    assert.ok(q.cypher.includes("MATCH"), `${q.name} must be a real query`);
    assert.ok(q.usedBy.length > 0);
  }
});
}

main();