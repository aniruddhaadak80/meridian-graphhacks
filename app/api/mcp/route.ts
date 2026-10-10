import { NextResponse } from "next/server";
import { MCP_TOOLS } from "@/lib/agents/crew";
import { seedTenant } from "@/lib/graph/seed";
import { blastRadius, pageRank, shortestPath, whoKnows, bfsPaths } from "@/lib/graph/algorithms";
import { recall, createTask, claimTask, openTasks } from "@/lib/memory/memory";
import { tenantGraph, nodesByLabel } from "@/lib/graph/store";

export async function GET() {
  return NextResponse.json({
    name: "meridian-mcp",
    version: "1.0.0",
    transport: "https + json-rpc-ish POST",
    tools: MCP_TOOLS,
    usage: "POST /api/mcp { tool, args, tenant }",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "acme-robotics";
  await seedTenant(tenant);
  const tool = body.tool as string;
  const args = body.args ?? {};
  try {
    if (tool === "graph.blastRadius") return NextResponse.json(blastRadius(tenant, args.serviceId, args.depth ?? 3));
    if (tool === "graph.pageRank") return NextResponse.json(pageRank(tenant).map((x) => ({ id: x.service.id, name: (x.service.props as any).name, score: x.score })));
    if (tool === "graph.whoKnows") return NextResponse.json(whoKnows(tenant, args.service));
    if (tool === "graph.shortestPath") return NextResponse.json(shortestPath(tenant, args.from, args.to) ?? { found: false });
    if (tool === "graph.traverse") {
      const seen = bfsPaths(tenant, args.nodeId ?? args.id, args.depth ?? 2, args.relTypes);
      const g = tenantGraph(tenant);
      return NextResponse.json({
        origin: args.nodeId ?? args.id,
        reached: [...seen.entries()].slice(0, 50).map(([id, v]) => ({ id, dist: v.dist, node: g.nodes.get(id)?.props ?? null })),
        cypher: `MATCH (a {id:$id})-[r*1..${args.depth ?? 2}]-(b) RETURN b, r`,
      });
    }
    if (tool === "brain.decisionLineage") {
      const decs = nodesByLabel(tenant, "Decision");
      const g = tenantGraph(tenant);
      const out = decs.map((d) => {
        const maker = [...g.edges.values()].find((e) => e.type === "MADE" && e.to === d.id);
        const constr = [...g.edges.values()].find((e) => e.type === "CONSTRAINS" && e.from === d.id);
        return { decision: d, maker: maker ? g.nodes.get(maker.from) : null, constrains: constr ? g.nodes.get(constr.to) : null };
      });
      return NextResponse.json({ lineage: out, cypher: `MATCH (p:Person)-[:MADE]->(d:Decision)-[:CONSTRAINS]->(s:Service) RETURN p.name, d.title, d.rationale, s.name` });
    }
    if (tool === "memory.recall") return NextResponse.json(recall(tenant, args.q ?? "", 8).map((r) => ({ id: r.node.id, props: r.node.props })));
    if (tool === "memory.handoff") {
      if (args.op === "claim") return NextResponse.json(await claimTask(tenant, args.taskId, args.agent ?? "guardian"));
      if (args.op === "list") return NextResponse.json({ openTasks: openTasks(tenant) });
      return NextResponse.json(await createTask(tenant, args.title ?? "Handoff", args.detail ?? "", args.from ?? "oracle", args.to ?? "guardian"));
    }
    return NextResponse.json({ error: `unknown tool ${tool}`, tools: MCP_TOOLS.map((t) => t.name) }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
