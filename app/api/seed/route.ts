import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { graphStats } from "@/lib/graph/store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? process.env.TENANT_DEFAULT ?? "acme-robotics";
  const res = await seedTenant(tenant);
  return NextResponse.json({ tenant, ...res, stats: graphStats(tenant) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  const res = await seedTenant(tenant);
  return NextResponse.json({ tenant, ...res, stats: graphStats(tenant) });
}
