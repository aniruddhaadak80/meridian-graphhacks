import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { recall, rememberEpisode, rememberFact, openTasks, createTask, claimTask, completeTask, sessionHistory } from "@/lib/memory/memory";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  await seedTenant(tenant);
  const q = searchParams.get("q") ?? "";
  const sessionId = searchParams.get("sessionId") ?? "console";
  return NextResponse.json({
    tenant,
    recall: q ? recall(tenant, q, 8).map((r) => ({ id: r.node.id, score: r.score, props: r.node.props })) : [],
    openTasks: openTasks(tenant),
    sessionHistory: sessionHistory(tenant, sessionId),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  await seedTenant(tenant);
  const op = body.op ?? "recall";
  if (op === "remember-episode") return NextResponse.json(await rememberEpisode(tenant, body.text, body.serviceId, body.sessionId));
  if (op === "remember-fact") return NextResponse.json(await rememberFact(tenant, body.text, body.aboutId));
  if (op === "create-task") return NextResponse.json(await createTask(tenant, body.title, body.detail ?? "", body.from ?? "oracle", body.to ?? "guardian"));
  if (op === "claim-task") return NextResponse.json(await claimTask(tenant, body.taskId, body.agent ?? "guardian"));
  if (op === "complete-task") return NextResponse.json(await completeTask(tenant, body.taskId, body.outcome ?? "done"));
  return NextResponse.json({ recall: recall(tenant, body.q ?? body.query ?? "", 8).map((r) => ({ id: r.node.id, score: r.score, props: r.node.props })) });
}
