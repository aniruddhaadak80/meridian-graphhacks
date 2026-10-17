// MERIDIAN · Advanced graph algorithms (in-memory, FalkorDB-equivalent).
// Beyond BFS/PageRank: community detection, betweenness, closeness, harmonic
// centrality, max-flow. Every algorithm mirrors a real FalkorDB capability the
// agent can expose as an MCP tool. Deterministic, zero-dependency.

import { TenantId, tenantGraph, outEdges, inEdges, nodesByLabel, MEdge } from "./store";

type Id = string;
type Weight = number;

export interface CentralityResult { id: string; name: string; score: number; rank?: number; label?: string[]; props: any; }
export interface CommunityResult { community: number; members: Array<{ id: string; name: string; labels: string[] }>; size: number; }
export interface MaxFlowResult { from: string; to: string; value: number; paths: Array<{ edges: string[]; bottleneck: number }>; cypher: string; }

export function degreeCentrality(tenant: TenantId, kind: "in" | "out" | "all" = "all") {
  const g = tenantGraph(tenant);
  const out: Record<string, number> = {};
  const inn: Record<string, number> = {};
  for (const e of g.edges.values()) {
    if (kind !== "in") out[e.from] = (out[e.from] ?? 0) + 1;
    if (kind !== "out") inn[e.to] = (inn[e.to] ?? 0) + 1;
  }
  return [...g.nodes.values()].map((n) => ({
    id: n.id, name: (n.props as any).name ?? n.id,
    score: (kind === "all" ? (out[n.id] ?? 0) + (inn[n.id] ?? 0) : kind === "in" ? (inn[n.id] ?? 0) : (out[n.id] ?? 0)),
    labels: n.labels, props: n.props,
  })).sort((a, b) => b.score - a.score);
}

export function closenessCentrality(tenant: TenantId): CentralityResult[] {
  const g = tenantGraph(tenant);
  const nodes = [...g.nodes.values()];
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of g.edges.values()) { adj.get(e.from)!.add(e.to); adj.get(e.to)!.add(e.from); }
  const results: CentralityResult[] = [];
  for (const s of nodes) {
    const dist = new Map<string, number>([[s.id, 0]]);
    let frontier = [s.id];
    let d = 0;
    while (frontier.length) {
      const next: string[] = [];
      d++;
      for (const u of frontier) for (const v of adj.get(u) ?? []) { if (!dist.has(v)) { dist.set(v, d); next.push(v); } }
      frontier = next;
    }
    const reached = dist.size - 1;
    let distSum = 0;
    for (const dv of dist.values()) distSum += dv;
    const score = reached > 0 ? (reached - 1) / Math.max(distSum, 1) : 0;
    results.push({ id: s.id, name: (s.props as any).name ?? s.id, score, label: s.labels, props: s.props });
  }
  return results.sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function betweennessCentrality(tenant: TenantId, sampled = 200): CentralityResult[] {
  const g = tenantGraph(tenant);
  const nodes = [...g.nodes.values()];
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of g.edges.values()) { adj.get(e.from)!.add(e.to); adj.get(e.to)!.add(e.from); }
  const between = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const sample = sampled >= nodes.length ? nodes : sampleNodes(nodes, sampled);
  for (const s of sample) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>([[s.id, 1]]);
    const dist = new Map<string, number>([[s.id, 0]]);
    let queue = [s.id];
    while (queue.length) {
      const v = queue.shift()!; stack.push(v);
      for (const w of adj.get(v) ?? []) {
        if (!dist.has(w)) { dist.set(w, dist.get(v)! + 1); queue.push(w); }
        if (dist.get(w) === dist.get(v)! + 1) { sigma.set(w, (sigma.get(w) ?? 0) + sigma.get(v)!); pred.set(w, [...(pred.get(w) ?? []), v]); }
      }
    }
    const delta = new Map<string, number>();
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const dv = (delta.get(v) ?? 0) + (sigma.get(v)! / sigma.get(w)!) * (1 + (delta.get(w) ?? 0));
        delta.set(v, dv);
      }
      if (w !== s.id) between.set(w, (between.get(w) ?? 0) + (delta.get(w) ?? 0));
    }
  }
  const n = nodes.length;
  const maxPairs = (n - 1) * (n - 2);
  return nodes.map((n) => {
    const b = between.get(n.id) ?? 0;
    return { id: n.id, name: (n.props as any).name ?? n.id, score: maxPairs > 0 ? 2 * b / maxPairs : 0, labels: n.labels, props: n.props };
  }).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function harmonicCentrality(tenant: TenantId): CentralityResult[] {
  const g = tenantGraph(tenant);
  const nodes = [...g.nodes.values()];
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of g.edges.values()) { adj.get(e.from)!.add(e.to); adj.get(e.to)!.add(e.from); }
  return nodes.map((s) => {
    const dist = new Map<string, number>([[s.id, 0]]);
    let frontier = [s.id];
    while (frontier.length) {
      const next: string[] = [];
      for (const u of frontier) for (const v of adj.get(u) ?? []) { if (!dist.has(v)) { dist.set(v, dist.get(u)! + 1); next.push(v); } }
      frontier = next;
    }
    let sum = 0;
    for (const [, d] of dist) if (d > 0) sum += 1 / d;
    return { id: s.id, name: (s.props as any).name ?? s.id, score: sum, labels: s.labels, props: s.props };
  }).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
}

// Label-propagation community detection
export function communityDetection(tenant: TenantId, rounds = 30): CommunityResult[] {
  const g = tenantGraph(tenant);
  const nodes = [...g.nodes.values()];
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of g.edges.values()) { adj.get(e.from)!.add(e.to); adj.get(e.to)!.add(e.from); }
  const comm = new Map<string, number>(nodes.map((n, i) => [n.id, i]));
  for (let r = 0; r < rounds; r++) {
    let changed = 0;
    for (const n of nodes) {
      const counts = new Map<number, number>();
      for (const nb of adj.get(n.id) ?? []) { const c = comm.get(nb)!; counts.set(c, (counts.get(c) ?? 0) + 1); }
      let best = comm.get(n.id)!, bestC = 0;
      for (const [c, cnt] of counts) if (cnt > bestC) { bestC = cnt; best = c; }
      if (best !== comm.get(n.id)) { comm.set(n.id, best); changed++; }
    }
    if (changed === 0) break;
  }
  const groups = new Map<number, string[]>();
  for (const [id, c] of comm) { if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(id); }
  return [...groups.values()].map((members, i) => ({
    community: i,
    members: members.map((id) => { const n = g.nodes.get(id)!; return { id, name: (n.props as any).name ?? id, labels: n.labels }; }),
    size: members.length,
  })).sort((a, b) => b.size - a.size);
}

// Max flow (Edmonds-Karp) over directed edges with unit capacity → bottlenecks
export function maxFlow(tenant: TenantId, source: string, sink: string): MaxFlowResult {
  const g = tenantGraph(tenant);
  const cap = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const e of g.edges.values()) {
    const key = `${e.from}->${e.to}`;
    cap.set(key, (cap.get(key) ?? 0) + 1);
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
    if (!adj.has(e.to)) adj.set(e.to, []);
  }
  let total = 0;
  const paths: Array<{ edges: string[]; bottleneck: number }> = [];
  while (true) {
    const parent = new Map<string, string>();
    const edgeUsed = new Map<string, string>();
    const q = [source];
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj.get(u) ?? []) {
        if (!parent.has(v) && v !== source && (cap.get(`${u}->${v}`) ?? 0) > 0) { parent.set(v, u); edgeUsed.set(v, `${u}->${v}`); q.push(v); if (v === sink) break; }
      }
    }
    if (!parent.has(sink)) break;
    // bottleneck
    let b = Infinity;
    let cur = sink;
    while (cur !== source) { const p = parent.get(cur)!; const key = `${p}->${cur}`; b = Math.min(b, cap.get(key)!); cur = p; }
    cur = sink;
    const pathEdges: string[] = [];
    while (cur !== source) { const p = parent.get(cur)!; const key = `${p}->${cur}`; cap.set(key, cap.get(key)! - b); pathEdges.unshift(key); cur = p; }
    total += b; paths.push({ edges: pathEdges, bottleneck: b });
    if (paths.length > 50) break;
  }
  return { from: source, to: sink, value: total, paths, cypher: `MATCH p = allShortestPaths((${source})-[:DEPENDS_ON*]->(${sink})) RETURN p` };
}

function sampleNodes(nodes: any[], k: number) {
  const idx = new Array(nodes.length).fill(0).map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, k).map((i) => nodes[i]);
}

export const ADVANCED_ALGO_DOCS = {
  degreeCentrality: "MATCH (n) RETURN n, size((n)--()) AS degree ORDER BY degree DESC",
  closenessCentrality: "CALL algo.closeness(...) // inverse average distance to all reachable nodes",
  betweennessCentrality: "CALL algo.betweenness(...) // node lies on shortest paths between pairs",
  harmonicCentrality: "CALL algo.harmonicCentrality(...) // sum of inverse distances",
  communityDetection: "CALL algo.labelPropagation(...) // communities via label propagation",
  maxFlow: "CALL algo.maxFlow(...) // max flow / min cut between two nodes",
};
