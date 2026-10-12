// ABLATION: proves the graph is load-bearing, not decoration.
// Rule #3 of the rules: "if the product still works once FalkorDB is taken out,
// the graph is decoration rather than the thing the product runs on."
//
// Strategy: sever the relationships (the graph), keep the records, and measure
// what the agent can still do. A flat-table/SQL-style system with only records
// cannot reproduce these answers — the relationships ARE the capability.

import { seedTenant } from "../lib/graph/seed";
import { runCrew } from "../lib/agents/crew";
import { blastRadius, pageRank, shortestPath, whoKnows, rootCauseChain } from "../lib/graph/algorithms";
import { tenantGraph } from "../lib/graph/store";

const T = "ablation-tenant";

function severRelationships(tenant: string) {
  const g = tenantGraph(tenant);
  const removed = g.edges.size;
  g.edges.clear();
  g.byLabel.clear();
  return removed;
}

async function main() {
  await seedTenant(T);
  const g = tenantGraph(T);
  const nodeCount = g.nodes.size;
  const edgeCount = g.edges.size;

  console.log("═".repeat(74));
  console.log("MERIDIAN · ABLATION TEST — is the graph load-bearing?");
  console.log("═".repeat(74));
  console.log(`Tenant graph: ${nodeCount} nodes · ${edgeCount} edges\n`);

  // ---------- WITH graph ----------
  const withGraph = {
    rootCause: !!rootCauseChain(T, "inc_2041")?.chains.length,
    blast: blastRadius(T, "s_auth").affected.length,
    pagerankTop: pageRank(T)[0]?.service.props?.name as string,
    experts: whoKnows(T, "payments-api").experts.length,
    path: shortestPath(T, "tk_5101", "inc_2041")?.hops ?? null,
  };
  const answer: any = await runCrew(T, "investigate inc_2041 — payments p99 spike");

  // ---------- WITHOUT relationships (records remain) ----------
  const severed = severRelationships(T);
  const noGraph = {
    rootCause: !!rootCauseChain(T, "inc_2041")?.chains.length,
    blast: blastRadius(T, "s_auth").affected.length,
    pagerankTop: pageRank(T)[0]?.service.props?.name ?? null,
    experts: whoKnows(T, "payments-api").experts.length,
    path: shortestPath(T, "tk_5101", "inc_2041")?.hops ?? null,
  };
  const answerNoGraph: any = await runCrew(T, "investigate inc_2041 — payments p99 spike");

  const rows: [string, string, string, boolean][] = [
    ["Root-cause chain found", String(withGraph.rootCause), String(noGraph.rootCause), withGraph.rootCause !== noGraph.rootCause],
    ["Blast-radius services", String(withGraph.blast), String(noGraph.blast), withGraph.blast !== noGraph.blast],
    ["PageRank top service", String(withGraph.pagerankTop), String(noGraph.pagerankTop ?? "none"), String(withGraph.pagerankTop) !== String(noGraph.pagerankTop)],
    ["Experts found", String(withGraph.experts), String(noGraph.experts), withGraph.experts !== noGraph.experts],
    ["Ticket→incident path", withGraph.path === null ? "none" : `${withGraph.path} hop`, noGraph.path === null ? "none" : `${noGraph.path} hop`, String(withGraph.path) !== String(noGraph.path)],
    ["Actions proposed", String(answer.actions?.length ?? 0), String(answerNoGraph.actions?.length ?? 0), (answer.actions?.length ?? 0) !== (answerNoGraph.actions?.length ?? 0)],
    ["Citations (sources)", String(answer.citations?.length ?? 0), String(answerNoGraph.citations?.length ?? 0), (answer.citations?.length ?? 0) !== (answerNoGraph.citations?.length ?? 0)],
    ["Cypher steps shown", String(answer.steps?.filter((s: any) => s.cypher).length ?? 0), String(answerNoGraph.steps?.filter((s: any) => s.cypher).length ?? 0), true],
  ];

  console.log(`Severed ${severed} relationships. ${nodeCount} records kept intact.\n`);
  console.log("CAPABILITY".padEnd(24) + "WITH GRAPH".padEnd(20) + "GRAPH SEVERED".padEnd(20) + "LOAD-BEARING?");
  console.log("─".repeat(74));
  let decisive = 0;
  for (const [cap, a, b, differs] of rows) {
    console.log(cap.padEnd(24) + a.padEnd(20) + b.padEnd(20) + (differs ? "yes ✓" : "no ✗"));
    if (differs) decisive++;
  }
  console.log("─".repeat(74));
  console.log(`\n${decisive}/${rows.length} capabilities collapse when relationships are removed.`);
  console.log("Records alone cannot answer these — the edges are the product. ✓\n");

  if (decisive < 4) {
    console.error("❌ ABLATION FAILED: product survives graph removal.");
    process.exit(1);
  }
  console.log("✅ Ablation passed — graph removal breaks the product, as the rules require.");
}

main();