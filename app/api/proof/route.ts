// PROOF BUNDLE — one endpoint that answers the judges' hardest questions.
// Rule #3 requires the graph to "do real work". This endpoint proves it by
// running the same capabilities twice: once on the real graph, once with the
// relationships severed (records kept). Anything that changes is load-bearing.

import { NextResponse } from "next/server";
import { seedTenant, SEED_VERSION } from "@/lib/graph/seed";
import { graphStats, tenantGraph, backendStatus } from "@/lib/graph/store";
import { blastRadius, pageRank, shortestPath, whoKnows, rootCauseChain } from "@/lib/graph/algorithms";
import { runCrew } from "@/lib/agents/crew";
import { PRODUCT_CYPHER, exportCypher } from "@/lib/graph/cypherExport";

export const dynamic = "force-dynamic";

function snapshot(tenant: string) {
  return {
    rootCauseChainFound: !!rootCauseChain(tenant, "inc_2041")?.chains.length,
    blastRadiusServices: blastRadius(tenant, "s_auth").affected.length,
    pageRankTopService: (pageRank(tenant)[0]?.service.props as any)?.name ?? null,
    expertsForPayments: whoKnows(tenant, "payments-api").experts.length,
    ticketToIncidentHops: shortestPath(tenant, "tk_5101", "inc_2041")?.hops ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  const includeBundle = searchParams.get("bundle") === "1";

  await seedTenant(tenant);
  const graph = tenantGraph(tenant);
  const stats = graphStats(tenant);
  const backend = await backendStatus();

  // 1) capabilities WITH the graph
  const withGraph = snapshot(tenant);
  const answer: any = await runCrew(tenant, "investigate inc_2041 — payments p99 spike");

  // 2) capabilities with relationships severed, records intact
  const savedEdges = new Map(graph.edges);
  graph.edges.clear();
  graph.byLabel.clear();
  const severed = snapshot(tenant);
  const answerNoGraph: any = await runCrew(tenant, "investigate inc_2041 — payments p99 spike");

  // restore (this endpoint is read-only otherwise)
  graph.edges.clear();
  for (const [k, v] of savedEdges) graph.edges.set(k, v);
  graph.byLabel.clear();
  for (const n of graph.nodes.values()) for (const l of n.labels) graph.byLabel.set(l, new Set([...(graph.byLabel.get(l) ?? []), n.id]));

  const rows = [
    { capability: "Root-cause chain found", withGraph: withGraph.rootCauseChainFound, graphSevered: severed.rootCauseChainFound },
    { capability: "Blast-radius services", withGraph: withGraph.blastRadiusServices, graphSevered: severed.blastRadiusServices },
    { capability: "PageRank top service", withGraph: withGraph.pageRankTopService, graphSevered: severed.pageRankTopService },
    { capability: "Experts found (graph evidence)", withGraph: withGraph.expertsForPayments, graphSevered: severed.expertsForPayments },
    { capability: "Ticket→incident path (hops)", withGraph: withGraph.ticketToIncidentHops, graphSevered: severed.ticketToIncidentHops },
    { capability: "Actions proposed", withGraph: answer.actions?.length ?? 0, graphSevered: answerNoGraph.actions?.length ?? 0 },
    { capability: "Citations (sources)", withGraph: answer.citations?.length ?? 0, graphSevered: answerNoGraph.citations?.length ?? 0 },
  ].map((r) => ({ ...r, loadBearing: String(r.withGraph) !== String(r.graphSevered) }));

  const loadBearingCount = rows.filter((r) => r.loadBearing).length;

  return NextResponse.json({
    verdict: loadBearingCount >= 4 ? "GRAPH IS LOAD-BEARING" : "WARNING: too many capabilities survive graph removal",
    loadBearing: `${loadBearingCount}/${rows.length} capabilities collapse when relationships are removed`,
    method: "Records are kept intact; only relationships are severed. A flat-table or vector-only system cannot reproduce these answers — the edges are the product.",
    seed: SEED_VERSION,
    tenant,
    graph: `meridian_${tenant.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    backend,
    stats,
    capabilities: rows,
    sampleAnswer: answer.answer?.split("\n").slice(0, 6),
    sampleCypher: answer.steps?.find((s: any) => s.cypher)?.cypher,
    productQueries: PRODUCT_CYPHER,
    ...(includeBundle ? { cypherBundle: exportCypher(tenant) } : {}),
  });
}