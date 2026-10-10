import { NextResponse } from "next/server";
import { backendStatus, graphStats, recentCypher } from "@/lib/graph/store";
import { seedTenant, SEED_VERSION } from "@/lib/graph/seed";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? process.env.TENANT_DEFAULT ?? "acme-robotics";
  await seedTenant(tenant);
  const backend = await backendStatus();
  const stats = graphStats(tenant);
  return NextResponse.json({
    ok: true,
    app: "meridian-graphhacks",
    seed: SEED_VERSION,
    tenant,
    backend,
    stats,
    cypherRecent: recentCypher(5),
    time: new Date().toISOString(),
  });
}
