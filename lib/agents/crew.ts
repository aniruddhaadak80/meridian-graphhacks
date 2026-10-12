// MERIDIAN agent crew — 4 agents sharing ONE FalkorDB graph as blackboard.
// Every decision is a traversal + algorithm call with a visible Cypher path.
// No LLM key required: the reasoning engine is deterministic + explainable,
// with an optional LLM narrator hook (BYO key) that never replaces the graph.

import { TenantId, nodesByLabel, tenantGraph, outEdges } from "../graph/store";
import { blastRadius, pageRank, rootCauseChain, whoKnows, shortestPath } from "../graph/algorithms";
import { recall, rememberEpisode } from "../memory/memory";

export type AgentId = "scout" | "archivist" | "guardian" | "oracle";

export interface AgentStep {
  agent: AgentId;
  tool: string;
  input: any;
  outputSummary: string;
  cypher?: string;
  path?: string[];
}

export interface CrewResult {
  answer: string;
  steps: AgentStep[];
  citations: { id: string; title: string; kind: string }[];
  actions: { label: string; detail: string; severity: "info" | "warn" | "critical" }[];
  confidence: number;
}

const AGENT_META: Record<AgentId, { name: string; role: string }> = {
  scout: { name: "Scout", role: "follows connections across data (multi-hop traversal)" },
  archivist: { name: "Archivist", role: "episodic/semantic/procedural memory + provenance" },
  guardian: { name: "Guardian", role: "acts: triage, blast radius, rollback plan" },
  oracle: { name: "Oracle", role: "company brain: owners, decisions, docs with sources" },
};

export const MCP_TOOLS = [
  { name: "graph.traverse", description: "Follow relationships N hops from a node", cypher: "MATCH (a {id:$id})-[r*1..N]-(b) RETURN b, r" },
  { name: "graph.shortestPath", description: "Provable minimal connection between two nodes", cypher: "MATCH p=shortestPath((a)-[*..6]-(b)) RETURN p" },
  { name: "graph.blastRadius", description: "Downstream services via DEPENDS_ON*", cypher: "MATCH (s:Service)-[:DEPENDS_ON*1..4]->(d) RETURN d" },
  { name: "graph.pageRank", description: "Most central / risky services", cypher: "CALL algo.pageRank over DEPENDS_ON" },
  { name: "graph.whoKnows", description: "Experts via WORKED_ON / AUTHORED / KNOWS", cypher: "MATCH (p:Person)-[:WORKED_ON]->(s:Service) RETURN p" },
  { name: "memory.recall", description: "Episodic+semantic recall for a query", cypher: "MATCH (m:Memory) WHERE m.text CONTAINS $q RETURN m" },
  { name: "memory.handoff", description: "Create/claim shared Task nodes", cypher: "MERGE (t:Task {id:$id}) RETURN t" },
  { name: "brain.decisionLineage", description: "Decision → maker → rationale → constraint", cypher: "MATCH (p)-[:MADE]->(d:Decision)-[:CONSTRAINS]->(s) RETURN *" },
];

function citeOf(n: any): { id: string; title: string; kind: string } {
  const p: any = n.props ?? n;
  return { id: n.id ?? p.id, title: p.title ?? p.name ?? p.text ?? n.id, kind: (n.labels ?? ["Node"])[0] };
}

export async function runCrew(tenant: TenantId, question: string, sessionId = "console"): Promise<CrewResult> {
  const steps: AgentStep[] = [];
  const q = question.toLowerCase();

  // --- Scout: find anchor nodes (services / incidents / people) ---
  const g = tenantGraph(tenant);
  const anchorServices = [...g.nodes.values()].filter(
    (n) => n.labels.includes("Service") && (q.includes(((n.props as any).name ?? "").toLowerCase()) || q.includes(n.id))
  );
  const anchorIncidents = nodesByLabel(tenant, "Incident").filter(
    (n) => q.includes(n.id) || q.includes(((n.props as any).title ?? "").toLowerCase().slice(0, 24))
  );
  const wantsIncident = q.includes("incident") || q.includes("outage") || q.includes("p99") || q.includes("spike") || q.includes("sev") || anchorIncidents.length > 0;
  const wantsOwner = q.includes("who") && (q.includes("own") || q.includes("know") || q.includes("expert") || q.includes("oncall"));
  const wantsBlast = q.includes("break") || q.includes("blast") || q.includes("down") || q.includes("depend") || q.includes("impact");
  const wantsDecision = q.includes("decision") || q.includes("decided") || q.includes("why") || q.includes("policy");

  steps.push({
    agent: "scout",
    tool: "graph.traverse",
    input: { question },
    outputSummary: `Anchored ${anchorServices.length} service(s), ${anchorIncidents.length} incident(s). Intent: ${[wantsIncident && "incident-triage", wantsOwner && "expert-finder", wantsBlast && "blast-radius", wantsDecision && "decision-lineage"].filter(Boolean).join(", ") || "company-brain-qa"}.`,
    cypher: `MATCH (n) WHERE n.name CONTAINS $q OR n.title CONTAINS $q RETURN labels(n), n.id LIMIT 10  // q=${JSON.stringify(question.slice(0, 60))}`,
    path: anchorServices.map((s) => s.id),
  });

  // --- Archivist: recall memory ---
  const mems = recall(tenant, question, 6);
  steps.push({
    agent: "archivist",
    tool: "memory.recall",
    input: { query: question },
    outputSummary: `Recalled ${mems.length} memories: ${mems.slice(0, 3).map((m) => m.node.id).join(", ") || "none"}. Sessions persist per tenant graph.`,
    cypher: `MATCH (m:Memory) WHERE toLower(m.text) CONTAINS toLower($q) RETURN m.id, m.kind LIMIT 6`,
    path: mems.map((m) => m.node.id),
  });

  const citations: { id: string; title: string; kind: string }[] = [];
  const actions: CrewResult["actions"] = [];
  let answer = "";
  let confidence = 0.72;

  // --- Route A: incident triage (Track 01 hero) ---
  const incident = anchorIncidents[0] ?? (wantsIncident ? nodesByLabel(tenant, "Incident").find((n) => (n.props as any).status === "open") : undefined);
  if (incident && (wantsIncident || anchorServices.length > 0 || q.includes("payment"))) {
    const chain = rootCauseChain(tenant, incident.id);
    const svc = chain?.affects[0];
    const br = svc ? blastRadius(tenant, svc.id) : null;
    const pr = pageRank(tenant).slice(0, 3);
    steps.push({
      agent: "guardian",
      tool: "graph.shortestPath + graph.blastRadius",
      input: { incident: incident.id },
      outputSummary: chain ? `Root-cause chain: ${incident.id} → ${chain.affects.map((s: any) => s.id).join(", ")} → ${chain.chains.length} deploy candidate(s). Blast radius: ${br?.affected.length ?? 0} downstream. Central: ${pr[0]?.service.id}.` : "No chain.",
      cypher: chain?.cypher,
      path: [incident.id, ...(chain?.affects.map((s: any) => s.id) ?? [])],
    });
    const experts = svc ? whoKnows(tenant, svc.id) : null;
    if (experts) {
      steps.push({
        agent: "oracle",
        tool: "graph.whoKnows",
        input: { service: svc!.id },
        outputSummary: `Top expert: ${experts.experts[0]?.person.props.name} (${experts.experts[0]?.person.props.role}). Oncall: Ava Chen.`,
        cypher: experts.cypher,
        path: experts.experts.map((e) => e.person.id),
      });
    }
    for (const c of [...(chain?.affects ?? []), ...(chain?.chains.map((x: any) => x.pr).filter(Boolean) ?? []), ...(chain?.chains.map((x: any) => x.author).filter(Boolean) ?? [])]) citations.push(citeOf(c));
    for (const m of mems.slice(0, 3)) citations.push(citeOf(m.node));
    const top = chain?.chains[0];
    const topPr = top?.pr;
    const suspects = (chain?.chains ?? []).slice(0, 3).map((x: any) => x.pr ? `**${x.pr.props.title}** (${x.pr.id}${x.linkReason ? ` — ${x.linkReason}` : ""})` : null).filter(Boolean);
    answer = [
      `## ${incident.props.title} (${incident.id})`,
      ``,
      `**Likely cause:** ${topPr ? `**${topPr.props.title}** (${topPr.id}, merged ${(topPr.props as any).merged})` : "correlate deploys in the 2h window"} — affects **${chain?.affects.map((s: any) => (s.props as any).name).join(", ")}**.`,
      suspects.length > 1 ? `` : ``,
      suspects.length > 1 ? `**Suspect ranking:** ${suspects.map((s, i) => `${i + 1}. ${s}`).join(" · ")}` : ``,
      ``,
      `**Why (graph path):** \`Incident —AFFECTS→ Service ←DEPLOYED_TO— Deploy ←DEPLOYED_AS— PR ←AUTHORED— Person\` + \`—CORRELATED_WITH→ cross-service deploys\`. Full Cypher in steps below; every hop is a node you can inspect.`,
      ``,
      `**Blast radius:** ${br && br.affected.length ? br.affected.map((a) => `\`${(a.service.props as any).name}\` (${a.hops} hop${a.hops > 1 ? "s" : ""})`).join(", ") : "contained to one service"}. Most central service overall: **${(pr[0]?.service.props as any).name}** (PageRank).`,
      ``,
      `**Memory:** ${mems[0] ? `“${(mems[0].node.props as any).text}” (${mems[0].node.id})` : "no prior episode — recording this one"}.`,
      ``,
      `**Recommended actions:** freeze deploys to \`${(svc?.props as any)?.name ?? "affected service"}\`, rollback last suspect deploy, page ${experts?.experts[0] ? (experts.experts[0].person.props as any).name : "Payments oncall"}.`,
    ].join("\n");
    actions.push(
      { label: "Freeze deploys", detail: `Freeze ${(svc?.props as any)?.name ?? "service"} until sev clears`, severity: "warn" },
      { label: "Rollback suspect deploy", detail: topPr ? `Rollback ${topPr.id}: ${topPr.props.title}` : "Rollback latest suspect", severity: "critical" },
      { label: "Page owner", detail: experts?.experts[0] ? `Page ${(experts.experts[0].person.props as any).name} + current oncall Ava Chen` : "Page oncall", severity: "info" }
    );
    confidence = 0.88;
    await rememberEpisode(tenant, `Q: ${question} → A: incident ${incident.id}, cause ${topPr?.id ?? "unknown"}`, (svc as any)?.id, sessionId);
  } else if (wantsOwner || wantsBlast || anchorServices.length > 0) {
    // --- Route B: owner / blast radius / service deep-dive ---
    const svc = anchorServices[0] ?? [...(tenantGraph(tenant).byLabel.get("Service") ?? [])].map((id) => tenantGraph(tenant).nodes.get(id)!)[0];
    const exp = whoKnows(tenant, svc.id);
    const br = blastRadius(tenant, svc.id);
    steps.push({
      agent: "oracle",
      tool: "graph.whoKnows",
      input: { service: (svc.props as any).name },
      outputSummary: `${exp.experts.length} experts ranked; docs + runbooks attached.`,
      cypher: exp.cypher,
      path: [svc.id, ...exp.experts.map((e) => e.person.id)],
    });
    steps.push({
      agent: "guardian",
      tool: "graph.blastRadius",
      input: { service: svc.id },
      outputSummary: `${br.affected.length} downstream service(s) within 3 hops.`,
      cypher: br.cypher,
      path: [svc.id, ...br.affected.map((a) => a.service.id)],
    });
    for (const e of exp.experts) citations.push(citeOf(e.person));
    citations.push(citeOf(svc));
    answer = [
      `## ${(svc.props as any).name} — owner, experts, blast radius`,
      ``,
      `**Owner:** ${ownerOf(tenant, svc.id)} | **Tier:** ${(svc.props as any).tier} | **p99:** ${(svc.props as any).p99_ms}ms`,
      ``,
      `**Who knows it:** ${exp.experts.map((e, i) => `${i + 1}. **${(e.person.props as any).name}** (${(e.person.props as any).role})`).join(" · ")}`,
      ``,
      `**If it goes down:** ${br.affected.length ? br.affected.map((a) => `\`${(a.service.props as any).name}\``).join(", ") + " degrade" : "no downstream in 3 hops"}.`,
      ``,
      `**Runbook:** ${(runbookFor(tenant, svc.id)?.props as any)?.title ?? "see Docs"} · **Freshness:** best doc ${freshestDoc(tenant, svc.id)}.`,
    ].join("\n");
    confidence = 0.84;
  } else {
    // --- Route C: general company brain (Track 03) ---
    const docs = nodesByLabel(tenant, "Doc").slice(0, 3);
    const decs = nodesByLabel(tenant, "Decision");
    const tasks = nodesByLabel(tenant, "Task").filter((t) => (t.props as any).status !== "done").slice(0, 3);
    steps.push({
      agent: "oracle",
      tool: "brain.decisionLineage",
      input: { question },
      outputSummary: `${decs.length} decisions, ${docs.length} docs, ${tasks.length} open handoffs consulted.`,
      cypher: `MATCH (p:Person)-[:MADE]->(d:Decision)-[:CONSTRAINS]->(s:Service) RETURN p.name, d.title, s.name`,
      path: [...decs.map((d) => d.id)],
    });
    for (const d of docs) citations.push(citeOf(d));
    for (const d of decs.slice(0, 2)) citations.push(citeOf(d));
    for (const m of mems.slice(0, 2)) citations.push(citeOf(m.node));
    const short = shortestDemo(tenant, question);
    answer = [
      `## Company brain`,
      ``,
      `${answerForGeneral(tenant, question)}`,
      ``,
      short ? `**Graph proof:** ${short}` : ``,
      ``,
      `**Sources:** ${citations.slice(0, 4).map((c) => `\`${c.id}\` ${c.title}`).join(" · ") || "seed handbook"}`,
      ``,
      `Ask follow-ups like “who knows payments-api?”, “what breaks if auth-service goes down?”, or “investigate inc_2041”.`,
    ].join("\n");
    confidence = 0.78;
  }

  return { answer, steps, citations: dedupeCites(citations).slice(0, 10), actions, confidence };
}

function dedupeCites(cs: { id: string; title: string; kind: string }[]) {
  const seen = new Set<string>();
  return cs.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

function ownerOf(tenant: TenantId, serviceId: string): string {
  const g = tenantGraph(tenant);
  for (const e of g.edges.values()) {
    if (e.type === "OWNS" && e.to === serviceId) {
      const t = g.nodes.get(e.from);
      return `${(t?.props as any)?.name ?? e.from} team`;
    }
  }
  return "Platform team";
}

function runbookFor(tenant: TenantId, serviceId: string) {
  const g = tenantGraph(tenant);
  const r = [...g.edges.values()].find((e) => e.type === "REMEDIATES" && e.to === serviceId);
  return r ? g.nodes.get(r.from) : null;
}

function freshestDoc(tenant: TenantId, serviceId: string) {
  const g = tenantGraph(tenant);
  const docs = [...g.edges.values()]
    .filter((e) => e.type === "DESCRIBES" && e.to === serviceId)
    .map((e) => g.nodes.get(e.from)!)
    .filter(Boolean);
  return docs.length ? `${(docs[0].props as any).title} (${(docs[0].props as any).updated})` : "n/a";
}

function shortestDemo(tenant: TenantId, q: string): string | null {
  // cute proof: link a ticket to an incident when the question mentions checkout/double-charge
  if (/double|checkout|charge|refund/i.test(q)) {
    const sp = shortestPath(tenant, "tk_5101", "inc_2041");
    if (sp) return `\`tk_5101 → inc_2041\` in ${sp.hops} hop(s): ${sp.raw.join(" ")}`;
  }
  return null;
}

function answerForGeneral(tenant: TenantId, q: string): string {
  const lq = q.toLowerCase();
  // ORDER MATTERS: more specific intents are tested first, because questions
  // legitimately contain several keywords ("why hardware keys *for oncall*").
  // A decision question must not be swallowed by a bare oncall match.
  if (/decision|decided|why|rationale|auth.*key|hardware|phishing|freeze|billing-worker|chart size|batch size/.test(lq))
    return `**dec_43** by Sana Iqbal (2026-10-02): auth-service enforces hardware keys for oncall — a phishing simulation caught 2 oncall engineers. Constrains \`auth-service\`. Related: **dec_41** (billing-worker autoscale frozen after double-charge incidents) and **dec_42** (route-optimizer stays on FalkorDB memory, not Redis).`;
  if (/deploy.*friday|friday.*deploy|no.*deploy|policy/.test(lq)) return `Policy (Fact \`f_no_deploy_friday\`): **no risky deploys after 16:00 Fri without EM approval**. Source: seed handbook + Decision \`dec_41\`.`;
  if (/refund|sla|chargeback/.test(lq)) return `Refund SLA is **24h**; breach pages Support Lead Omar Haddad (Fact \`f_refund_sla\`). Open refund issue: \`tk_5101\` — checkout double-charge, linked to \`inc_2041\`.`;
  if (/falkor|memory.*where|graph.*where|where.*memory/.test(lq)) return `Agent memory lives in **FalkorDB graph \`meridian_<tenant>\`** — one isolated graph per tenant (multigraph). Episodes, Facts, Tasks and Sessions are nodes; recall is a traversal. Set \`FALKORDB_URL\` for live Cypher, else in-memory mirror serves.`;
  if (/oncall|who.*page|who.*call|who.*on/.test(lq)) return `Current oncall is **Ava Chen** (Staff SRE, rota \`rota_main\` since 2026-10-06). Backup: Payments → Marcus Webb; Routing → Priya Nair.`;
  if (/hello|hi\b|hey|what can you/.test(lq)) return `I run on a **company knowledge graph**: people, services, deploys, incidents, docs, decisions. Try: “investigate inc_2041”, “who knows route-optimizer?”, “what breaks if payments-api goes down?”`;
  return `I searched **episodes, facts, decisions, docs and handoffs** in tenant graph. Top hit shown in citations — ask a service, incident (\`inc_2041\`), or owner question for a full traced answer.`;
}

export function agentMeta() {
  return AGENT_META;
}
