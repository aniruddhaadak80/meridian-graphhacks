// Agent memory API — episodic / semantic / procedural, per-tenant isolated.
// Every write is a graph write (nodes + edges), every read is a traversal.
// This is Track 02's core: persistent, shared, handoff-capable memory.

import { TenantId, upsertNode, addEdge, nodesByLabel, outEdges, inEdges, tenantGraph, mirrorWrite } from "../graph/store";

export type MemoryKind = "episodic" | "semantic" | "procedural";

export async function rememberEpisode(tenant: TenantId, text: string, serviceId?: string, sessionId = "console") {
  const id = `ep_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
  upsertNode(tenant, ["Episode", "Memory"], { id, text, at: new Date().toISOString(), session: sessionId, kind: "episodic" }, ["id"]);
  if (serviceId) addEdge(tenant, id, serviceId, "OBSERVED_IN", {});
  const sess = upsertNode(tenant, ["Session"], { id: `sess_${sessionId}`, name: sessionId }, ["id"]);
  addEdge(tenant, id, sess.id, "IN_SESSION", {});
  await mirrorWrite(tenant, `MERGE (e:Episode:Memory {id: $id, text: $text, kind: 'episodic'})`, { id, text });
  return { id, kind: "episodic" as const };
}

export async function rememberFact(tenant: TenantId, text: string, aboutId?: string, source = "agent") {
  const id = `f_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
  upsertNode(tenant, ["Fact", "Memory"], { id, text, source, kind: "semantic" }, ["id"]);
  if (aboutId) addEdge(tenant, id, aboutId, "ABOUT", {});
  await mirrorWrite(tenant, `MERGE (f:Fact:Memory {id: $id, text: $text})`, { id, text });
  return { id, kind: "semantic" as const };
}

export function recall(tenant: TenantId, query: string, limit = 8) {
  const g = tenantGraph(tenant);
  const toks = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  // A query with a distinctive token (>=4 chars) must be matched on that token.
  // Without this, "isolation" scores as a hit for the token "iso", and recall
  // returns coincidental substring noise dressed up as evidence.
  const distinctive = toks.filter((t) => t.length >= 4);
  const mems = [...g.nodes.values()].filter((n) => n.labels.includes("Memory") || n.labels.includes("Episode") || n.labels.includes("Fact") || n.labels.includes("Decision") || n.labels.includes("Doc"));

  const scored = mems.map((m) => {
    const hay = JSON.stringify(m.props).toLowerCase();
    let score = 0;
    let matchedDistinctive = false;
    for (const t of toks) {
      if (!hay.includes(t)) continue;
      score += t.length > 5 ? 3 : 1;
      if (distinctive.includes(t)) matchedDistinctive = true;
    }
    return { node: m, score, matchedDistinctive };
  });

  const relevant = scored.filter((s) => s.score > 0 && (distinctive.length === 0 || s.matchedDistinctive));
  return relevant.sort((a, b) => b.score - a.score || String(a.node.id).localeCompare(String(b.node.id))).slice(0, limit);
}

export function sessionHistory(tenant: TenantId, sessionId: string, limit = 20) {
  const g = tenantGraph(tenant);
  const sessId = `sess_${sessionId}`;
  const eps = [...g.edges.values()]
    .filter((e) => e.type === "IN_SESSION" && e.to === sessId)
    .map((e) => g.nodes.get(e.from)!)
    .filter(Boolean)
    .slice(-limit);
  return eps;
}

// ---- multi-agent handoffs: Task nodes claimed via graph edges ----
export async function createTask(tenant: TenantId, title: string, detail: string, fromAgent: string, toAgent: string) {
  const id = `task_${Date.now().toString(36)}`;
  upsertNode(tenant, ["Task"], { id, title, detail, status: "open", from: fromAgent, to: toAgent, at: new Date().toISOString() }, ["id"]);
  addEdge(tenant, id, toAgent.startsWith("p_") || toAgent.startsWith("agent_") ? toAgent : toAgent, "ASSIGNED_TO", {});
  await mirrorWrite(tenant, `MERGE (t:Task {id: $id, title: $title, status: 'open'})`, { id, title });
  return { id, title, to: toAgent };
}

export function openTasks(tenant: TenantId) {
  return nodesByLabel(tenant, "Task").filter((t) => (t.props as any).status === "open");
}

export async function claimTask(tenant: TenantId, taskId: string, agent: string) {
  const g = tenantGraph(tenant);
  const t = g.nodes.get(taskId);
  if (!t) return null;
  t.props = { ...t.props, status: "in_progress", claimedBy: agent, claimedAt: new Date().toISOString() };
  addEdge(tenant, agent, taskId, "CLAIMED", { at: new Date().toISOString() });
  await mirrorWrite(tenant, `MATCH (t:Task {id: $id}) SET t.status='in_progress', t.claimedBy=$agent`, { id: taskId, agent });
  return t;
}

export async function completeTask(tenant: TenantId, taskId: string, outcome: string) {
  const g = tenantGraph(tenant);
  const t = g.nodes.get(taskId);
  if (!t) return null;
  t.props = { ...t.props, status: "done", outcome, doneAt: new Date().toISOString() };
  await rememberEpisode(tenant, `Task ${taskId} completed: ${outcome}`);
  return t;
}
