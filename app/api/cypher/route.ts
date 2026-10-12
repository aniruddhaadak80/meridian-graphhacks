import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { graphStats, runCypher } from "@/lib/graph/store";
import { exportCypher, PRODUCT_CYPHER } from "@/lib/graph/cypherExport";

export const dynamic = "force-dynamic";

// GET  /api/cypher                     → the product's query reference sheet
// GET  /api/cypher?tenant=x&mode=full  → executable bundle that rebuilds the graph in FalkorDB
// POST /api/cypher { cypher, params }  → run a query against live FalkorDB
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  const mode = searchParams.get("mode") ?? "reference";

  await seedTenant(tenant);

  if (mode === "full") {
    return new NextResponse(exportCypher(tenant), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="meridian-${tenant}.cypher"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    tenant,
    graph: `meridian_${tenant.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    stats: graphStats(tenant),
    loadInstructions: [
      `curl -s "${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/cypher?tenant=${tenant}&mode=full" -o bundle.cypher`,
      `redis-cli -h localhost -p 6379 GRAPH.QUERY meridian_${tenant} "$(cat bundle.cypher)"`,
      "or paste the bundle into FalkorDB Browser at http://localhost:3000",
    ],
    queries: PRODUCT_CYPHER,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  const cypher = body.cypher;
  if (!cypher || typeof cypher !== "string") {
    return NextResponse.json({ error: "cypher string required" }, { status: 400 });
  }
  await seedTenant(tenant);
  const res = await runCypher(tenant, cypher, body.params ?? {});
  return NextResponse.json({ tenant, ...res });
}