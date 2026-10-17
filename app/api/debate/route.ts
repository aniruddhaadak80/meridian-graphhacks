// MERIDIAN · Multi-agent debate endpoint.
// POST /api/debate { question, tenant } → two agents argue, evidence wins

import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { runDebate } from "@/lib/agents/debate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  const question = body.question ?? body.q ?? "";
  await seedTenant(tenant);
  const result = runDebate(tenant, question);
  return NextResponse.json({ tenant, ...result });
}
