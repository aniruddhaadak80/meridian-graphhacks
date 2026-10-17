// MERIDIAN · Advanced MCP route — exposes all advanced graph capabilities.
// GET  /api/advanced-mcp   → tool catalog
// POST /api/advanced-mcp   → { tool, args, tenant } → result
// POST /api/advanced/search → { q, tenant, mode: 'vector'|'hybrid' } → results

import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { degreeCentrality, closenessCentrality, betweennessCentrality, harmonicCentrality, communityDetection, maxFlow, ADVANCED_ALGO_DOCS } from "@/lib/graph/algorithms-advanced";
import { buildVectorIndex, vectorSearch, hybridSearch } from "@/lib/graph/vector-search";
import { blastRadius, pageRank, shortestPath, whoKnows, rootCauseChain } from "@/lib/graph/algorithms";
import { runReAct } from "@/lib/agents/react";
import { runDebate } from "@/lib/agents/debate";
import { backendStatus, graphStats } from "@/lib/graph/store";

export const dynamic = "force-dynamic";

const ADVANCED_TOOLS = [
  { name: "graph.degreeCentrality", description: "Most connected nodes by edge count", cypher: ADVANCED_ALGO_DOCS.degreeCentrality },
  { name: "graph.closenessCentrality", description: "Nodes closest to everyone else", cypher: ADVANCED_ALGO_DOCS.closenessCentrality },
  { name: "graph.betweennessCentrality", description: "Bridges / brokers between parts of graph", cypher: ADVANCED_ALGO_DOCS.betweennessCentrality },
  { name: "graph.harmonicCentrality", description: "Inverse-distance centrality", cypher: ADVANCED_ALGO_DOCS.harmonicCentrality },
  { name: "graph.communityDetection", description: "Label-propagation communities", cypher: ADVANCED_ALGO_DOCS.communityDetection },
  { name: "graph.maxFlow", description: "Max flow / min cut between two nodes", cypher: ADVANCED_ALGO_DOCS.maxFlow },
  { name: "graph.blastRadius", description: "Downstream impact via DEPENDS_ON*", cypher: "MATCH (s:Service)-[:DEPENDS_ON*1..4]->(d) RETURN d" },
  { name: "graph.pageRank", description: "Centrality / risk over DEPENDS_ON", cypher: "CALL algo.pageRank(...) " },
  { name: "graph.whoKnows", description: "Expert finder via WORKED_ON/AUTHORED/KNOWS", cypher: "MATCH (p:Person)-[:WORKED_ON]->(s:Service) RETURN p" },
  { name: "graph.shortestPath", description: "Minimal connection between two nodes", cypher: "MATCH p=shortestPath((a)-[*..6]-(b)) RETURN p" },
  { name: "graph.rootCauseChain", description: "Incident → deploy → PR → author", cypher: "MATCH p=(i:Incident)-[:AFFECTS]->(s)<-[:DEPLOYED_TO]-(d)<-[:DEPLOYED_AS]-(pr)<-[:AUTHORED]-(u) RETURN p" },
  { name: "memory.vectorSearch", description: "Semantic recall over graph text (vector)", cypher: "CALL db.idx.vector.queryNodes('vector', $k, $vector)" },
  { name: "memory.hybridSearch", description: "Vector + keyword combined recall", cypher: "// SCAN VECTOR + full-text index (FalkorDB)" },
  { name: "agent.reactLoop", description: "ReAct: reason → act → observe → answer", cypher: "MATCH (n) RETURN n LIMIT 5 (tools decide)" },
  { name: "agent.debate", description: "Multi-agent debate: evidence wins, not opinion", cypher: "MATCH (n:Incident)-[:AFFECTS]->(s:Service) RETURN n, s" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  const q = searchParams.get("q") ?? "";
  const mode = searchParams.get("mode") ?? "hybrid";
  await seedTenant(tenant);
  if (q) {
    buildVectorIndex(tenant);
    const res = mode === "vector" ? vectorSearch(tenant, q, 10, 0.2) : hybridSearch(tenant, q, 10);
    return NextResponse.json({ tenant, mode, q, ...res });
  }
  return NextResponse.json({
    name: "meridian-advanced-mcp",
    version: "2.0.0",
    tools: ADVANCED_TOOLS,
    algoDocs: ADVANCED_ALGO_DOCS,
    usage: "POST /api/advanced-mcp { tool, args, tenant } · GET /api/advanced-mcp?q=...&mode=hybrid|vector",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  await seedTenant(tenant);
  const tool = body.tool as string;
  const args = body.args ?? {};
  try {
    // --- graph algorithms ---
    if (tool === "graph.degreeCentrality") {
      const kind = args.kind ?? "all";
      return NextResponse.json({ tenant, tool, results: degreeCentrality(tenant, kind), cypher: ADVANCED_ALGO_DOCS.degreeCentrality });
    }
    if (tool === "graph.closenessCentrality") return NextResponse.json({ tenant, tool, results: closenessCentrality(tenant), cypher: ADVANCED_ALGO_DOCS.closenessCentrality });
    if (tool === "graph.betweennessCentrality") return NextResponse.json({ tenant, tool, results: betweennessCentrality(tenant), cypher: ADVANCED_ALGO_DOCS.betweennessCentrality });
    if (tool === "graph.harmonicCentrality") return NextResponse.json({ tenant, tool, results: harmonicCentrality(tenant), cypher: ADVANCED_ALGO_DOCS.harmonicCentrality });
    if (tool === "graph.communityDetection") return NextResponse.json({ tenant, tool, results: communityDetection(tenant), cypher: ADVANCED_ALGO_DOCS.communityDetection });
    if (tool === "graph.maxFlow") return NextResponse.json({ tenant, tool, result: maxFlow(tenant, args.from, args.sink), cypher: ADVANCED_ALGO_DOCS.maxFlow });
    if (tool === "graph.blastRadius") return NextResponse.json({ tenant, tool, result: blastRadius(tenant, args.serviceId, args.depth ?? 3), cypher: ADVANCED_TOOLS[6].cypher });
    if (tool === "graph.pageRank") return NextResponse.json({ tenant, tool, results: pageRank(tenant).map((x) => ({ id: x.service.id, name: (x.service.props as any).name, score: x.score })), cypher: ADVANCED_TOOLS[7].cypher });
    if (tool === "graph.whoKnows") return NextResponse.json({ tenant, tool, result: whoKnows(tenant, args.service), cypher: ADVANCED_TOOLS[8].cypher });
    if (tool === "graph.shortestPath") return NextResponse.json({ tenant, tool, result: shortestPath(tenant, args.from, args.to), cypher: ADVANCED_TOOLS[9].cypher });
    if (tool === "graph.rootCauseChain") return NextResponse.json({ tenant, tool, result: rootCauseChain(tenant, args.incidentId), cypher: ADVANCED_TOOLS[10].cypher });
    // --- vector / hybrid search ---
    if (tool === "memory.vectorSearch") {
      buildVectorIndex(tenant);
      return NextResponse.json({ tenant, tool, ...vectorSearch(tenant, args.q ?? "", args.topK ?? 8, args.minScore ?? 0.25) });
    }
    if (tool === "memory.hybridSearch") {
      buildVectorIndex(tenant);
      return NextResponse.json({ tenant, tool, ...hybridSearch(tenant, args.q ?? "", args.topK ?? 8) });
    }
    if (tool === "agent.reactLoop") {
      const res = runReAct(tenant, args.question ?? args.q ?? "");
      return NextResponse.json({ tenant, tool, ...res });
    }
    if (tool === "agent.debate") {
      const res = runDebate(tenant, args.question ?? args.q ?? "");
      return NextResponse.json({ tenant, tool, ...res });
    }
    return NextResponse.json({ error: `unknown tool ${tool}`, tools: ADVANCED_TOOLS.map((t) => t.name) }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}


