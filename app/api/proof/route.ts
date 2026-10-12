import { NextResponse } from "next/server";
import { backendStatus, graphStats, recentCypher, tenantGraph } from "@/lib/graph/store";
import { seedTenant, SEED_VERSION } from "@/lib/graph/seed";
import { blastRadius, pageRank, shortestPath, whoKnows } from "@/lib/graph/algorithms";
import { MCP_TOOLS } from "@/lib/agents/crew";

// GET /api/proof — the "graph does real work" evidence bundle for judges.
// One fetch shows: backend mode, graph stats, recent Cypher, algorithm
// outputs, tenant isolation, and how to run the remove-the-graph test.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? process.env.TENANT_DEFAULT ?? "acme-robotics";
  await seedTenant(tenant);
  await seedTenant("globex");
  const backend = await backendStatus();
  const stats = graphStats(tenant);
  const other = graphStats("globex");
  const br = blastRadius(tenant, "s_auth");
  const pr = pageRank(tenant).slice(0, 3).map((x) => ({ id: x.service.id, score: x.score }));
  const wk = whoKnows(tenant, "payments-api");
  const sp = shortestPath(tenant, "tk_5101", "inc_2041");
  const isolation = ![...tenantGraph(tenant).nodes.keys()].some(
    (k) => k.startsWith("ep_globex") || k.startsWith("f_globex")
  ) && tenantGraph("globex").nodes.has("ep_globex_1");
  return NextResponse.json({
    app: "meridian-graphhacks",
    seed: SEED_VERSION,
    tenant,
    backend,
    stats,
    tenantIsolation: {
      [tenant]: { nodes: stats.nodes, edges: stats.edges },
      globex: { nodes: other.nodes, edges: other.edges },
      isolated: isolation,
    },
    algorithms: {
      blastRadiusFromAuth: br.affected.length,
      pageRankTop3: pr,
      whoKnowsPayments: wk.experts.map((e) => e.person.id),
      ticketToIncidentHops: sp?.hops ?? null,
    },
    mcpTools: MCP_TOOLS.map((t) => t.name),
    cypherRecent: recentCypher(10),
    removeTest: [
      "1. Unset FALKORDB_URL and restart → /api/health shows mode=memory, Cypher log keeps recording the exact queries the live DB would run.",
      "2. Disable /api/graph + /api/chat traversals → answers lose provenance, recall, blast radius. No graph = no product.",
      "3. Set FALKORDB_URL=redis://localhost:6379 (docker compose up -d falkordb) → mode=falkordb, seed mirrors to meridian_<tenant>, Browser shows the real graph.",
    ],
    tracks: ["01-agents-that-act", "02-agent-memory-coordination", "03-company-brain"],
    time: new Date().toISOString(),
  });
}
