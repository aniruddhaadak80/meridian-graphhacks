// MERIDIAN · ReAct (Reason + Act) agent loop endpoint.
// POST /api/react { question, tenant } → iterative agent reasoning with Cypher proof

import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { runReAct } from "@/lib/agents/react";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  const question = body.question ?? body.q ?? "";
  await seedTenant(tenant);
  const result = runReAct(tenant, question);
  return NextResponse.json({ tenant, question, ...result });
}
