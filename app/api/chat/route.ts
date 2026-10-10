import { NextResponse } from "next/server";
import { runCrew } from "@/lib/agents/crew";
import { seedTenant } from "@/lib/graph/seed";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? process.env.TENANT_DEFAULT ?? "acme-robotics";
  const question = body.question ?? body.q ?? "investigate inc_2041";
  const sessionId = body.sessionId ?? "console";
  await seedTenant(tenant);
  const t0 = Date.now();
  const result = await runCrew(tenant, String(question), String(sessionId));
  return NextResponse.json({ tenant, sessionId, ms: Date.now() - t0, ...result });
}
