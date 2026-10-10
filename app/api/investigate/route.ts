import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { rootCauseChain, blastRadius, pageRank, whoKnows } from "@/lib/graph/algorithms";
import { tenantGraph, nodesByLabel } from "@/lib/graph/store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  await seedTenant(tenant);
  const incidentId = body.incidentId ?? body.incident ?? "inc_2041";
  const chain = rootCauseChain(tenant, incidentId);
  if (!chain) return NextResponse.json({ tenant, error: `unknown incident ${incidentId}`, known: nodesByLabel(tenant, "Incident").map((n) => n.id) }, { status: 404 });
  const svc: any = chain.affects[0];
  const br = svc ? blastRadius(tenant, svc.id) : null;
  const experts = svc ? whoKnows(tenant, svc.id) : null;
  const central = pageRank(tenant).slice(0, 5).map((x) => ({ id: x.service.id, name: (x.service.props as any).name, score: x.score }));
  return NextResponse.json({ tenant, incident: chain.incident, affects: chain.affects, chains: chain.chains, blastRadius: br, experts, central, cypher: chain.cypher });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  await seedTenant(tenant);
  return NextResponse.json({ tenant, incidents: nodesByLabel(tenant, "Incident"), hint: "POST { incidentId: 'inc_2041' }" });
}
