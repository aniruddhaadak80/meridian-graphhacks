// MERIDIAN · Vector-hybrid search over graph nodes.
// FalkorDB supports vector indexes (CALL db.idx.vector.create / SCAN VECTOR).
// This module implements deterministic cosine-similarity recall on node text,
// so agents can do semantic recall ("what did we learn about retries?") in
// addition to exact Cypher matches. Mirrors FalkorDB vector search behavior.

import { TenantId, tenantGraph } from "./store";

type Vec = number[];

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

function vecFromText(text: string, dims = 64): Vec {
  const v = new Array(dims).fill(0);
  const toks = tokenize(text);
  for (let i = 0; i < toks.length; i++) {
    let h = 0;
    const s = toks[i];
    for (let j = 0; j < s.length; j++) h = ((h << 5) - h + s.charCodeAt(j)) | 0;
    v[Math.abs(h) % dims] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dims; i++) v[i] /= norm;
  return v;
}

function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const docVecs = new Map<string, { id: string; text: string; labels: string[]; props: any; vec: Vec }>();

function indexDoc(tenant: TenantId, id: string, text: string, labels: string[], props: any) {
  docVecs.set(`${tenant}:${id}`, { id, text, labels, props, vec: vecFromText(text) });
}

export function buildVectorIndex(tenant: TenantId) {
  const g = tenantGraph(tenant);
  for (const n of g.nodes.values()) {
    const text = `${(n.props as any).name ?? ""} ${(n.props as any).title ?? ""} ${(n.props as any).text ?? ""} ${(n.props as any).rationale ?? ""}`.trim();
    if (text.length > 0) indexDoc(tenant, n.id, text, n.labels, n.props);
  }
  return { indexed: docVecs.size };
}

export function vectorSearch(tenant: TenantId, query: string, topK = 8, minScore = 0.25) {
  const qv = vecFromText(query);
  const results = [...docVecs.values()].filter((d) => d.id.startsWith(`${tenant}:`))
    .map((d) => ({ ...d, score: dot(qv, d.vec) }))
    .filter((d) => d.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return {
    query,
    topK,
    minScore,
    results: results.map((r) => ({ id: r.id, score: r.score, labels: r.labels, props: r.props, text: r.text })),
    cypher: `CALL db.idx.vector.queryNodes('vector', $k, $vector) YIELD node RETURN node, node.text LIMIT ${topK}`,
  };
}

// Hybrid search: vector score + keyword overlap, combined linearly
export function hybridSearch(tenant: TenantId, query: string, topK = 8) {
  const vecRes = vectorSearch(tenant, query, topK * 2, 0.15);
  const toks = tokenize(query);
  const g = tenantGraph(tenant);
  const hits = new Map<string, { id: string; labels: string[]; props: any; text: string; vScore: number; kScore: number }>();
  for (const r of vecRes.results) hits.set(r.id, { id: r.id, labels: r.labels, props: r.props, text: r.text, vScore: r.score, kScore: 0 });
  for (const n of g.nodes.values()) {
    const hay = `${(n.props as any).name ?? ""} ${(n.props as any).title ?? ""} ${(n.props as any).text ?? ""}`.toLowerCase();
    let k = 0;
    for (const t of toks) if (hay.includes(t)) k++;
    if (k > 0) {
      const cur = hits.get(n.id) ?? { id: n.id, labels: n.labels, props: n.props, text: n.props?.title ?? n.props?.name ?? "", vScore: 0, kScore: 0 };
      cur.kScore = Math.min(1, k / toks.length);
      hits.set(n.id, cur);
    }
  }
  const combined = [...hits.values()].map((h) => ({ ...h, score: 0.6 * h.vScore + 0.4 * h.kScore })).sort((a, b) => b.score - a.score).slice(0, topK);
  return { query, results: combined, cypher: `// hybrid = vector + fulltext (FalkorDB: SCAN VECTOR + full-text index)"` };
}
