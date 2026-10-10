import { NextResponse } from "next/server";
import { exportSubgraph, graphStats, runCypher } from "@/lib/graph/store";
import { seedTenant } from "@/lib/graph/seed";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  await seedTenant(tenant);
  const center = searchParams.get("center") ?? undefined;
  const depth = Number(searchParams.get("depth") ?? 2);
  const sub = exportSubgraph(tenant, center, depth, 220);
  return NextResponse.json({ tenant, stats: graphStats(tenant), ...sub });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  await seedTenant(tenant);
  if (body.cypher) {
    const res = await runCypher(tenant, body.cypher, body.params ?? {});
    return NextResponse.json({ tenant, ...res });
  }
  const sub = exportSubgraph(tenant, body.center, body.depth ?? 2, 220);
  return NextResponse.json({ tenant, stats: graphStats(tenant), ...sub });
}
