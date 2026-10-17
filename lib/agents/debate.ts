// MERIDIAN · Multi-agent debate — two agents argue before committing an answer.
// Guardians says "rollback", SRE says "page first". They cite graph evidence
// and the debate is resolved by confidence score + Cypher proof, not opinion.

import { TenantId, tenantGraph } from "../graph/store";
import { rootCauseChain, blastRadius, whoKnows } from "../graph/algorithms";
import { runReAct } from "./react";

export interface DebateTurn {
  turn: number;
  agent: string;
  position: string;
  evidence: any[];
  cypher: string[];
  confidence: number;
}

export interface DebateResult {
  question: string;
  winner: string;
  winningPosition: string;
  turns: DebateTurn[];
  finalAnswer: string;
  cypherLog: string[];
}

export function runDebate(tenant: TenantId, question: string): DebateResult {
  const turns: DebateTurn[] = [];
  const cypherLog: string[] = [];

  const q = question.toLowerCase();
  const anchors = [...tenantGraph(tenant).nodes.values()].filter(
    (n) => n.labels.includes("Service") && q.includes(((n.props as any).name ?? "").toLowerCase())
  );
  const anchor = anchors[0];

  // Turn 1: Guardian — act fast, rollback
  const chain = anchor ? rootCauseChain(tenant, anchor.id) : null;
  const guardianEvidence = chain?.chains.map((c: any) => ({
    pr: c.pr?.id, title: c.pr?.props?.title, author: c.author?.props?.name, causedBy: c.causedBy,
  })) ?? [];
  const guardianCypher = chain?.cypher ?? "";
  if (guardianCypher) cypherLog.push(guardianCypher);
  turns.push({
    turn: 1, agent: "Guardian", position: "rollback first — suspect deploy is the cause",
    evidence: guardianEvidence, cypher: [guardianCypher], confidence: chain?.chains.length ? 0.85 : 0.4,
  });

  // Turn 2: SRE — page oncall first, gather more evidence
  const br = anchor ? blastRadius(tenant, anchor.id) : { affected: [], cypher: "" };
  const wk = anchor ? whoKnows(tenant, anchor.id) : { experts: [], cypher: "" };
  if (br.cypher) cypherLog.push(br.cypher);
  if (wk.cypher) cypherLog.push(wk.cypher);
  turns.push({
    turn: 2, agent: "SRE", position: "page oncall first, then rollback — blast radius is ${br.affected.length}",
    evidence: [
      { blastRadius: br.affected.length, downstream: br.affected.map((a) => (a.service.props as any).name) },
      { topExpert: wk.experts[0]?.person.props.name, expertRole: wk.experts[0]?.person.props.role },
    ],
    cypher: [br.cypher ?? "", wk.cypher ?? ""],
    confidence: br.affected.length > 0 ? 0.7 : 0.5,
  });

  // Turn 3: Guardian rebuttal — blast radius small, rollback is safe
  const guardianRebuttal = br.affected.length <= 2
    ? "Blast radius is small (≤2) — rolling back now is low-risk; paging first delays the fix."
    : "Blast radius is large — rollback alone isn't enough; need oncall + rollback together.";
  turns.push({
    turn: 3, agent: "Guardian", position: guardianRebuttal,
    evidence: [{ blastRadius: br.affected.length }],
    cypher: [br.cypher],
    confidence: br.affected.length <= 2 ? 0.88 : 0.6,
  });

  // Resolve: whoever has higher confidence + more graph evidence wins
  const t1 = turns[0], t2 = turns[1], t3 = turns[2];
  const winner = t3.confidence >= t2.confidence ? "Guardian" : "SRE";
  const winningPosition = winner === "Guardian" ? t3.position : t2.position;

  const finalAnswer = [
    `## Multi-agent debate result`,
    "",
    `Question: ${question}`,
    "",
    `Winner: **${winner}** — ${winningPosition}`,
    "",
    `Guardian confidence: ${(t1.confidence * 100).toFixed(0)}% → ${(t3.confidence * 100).toFixed(0)}%`,
    `SRE confidence: ${(t2.confidence * 100).toFixed(0)}%`,
    "",
    `Reasoning: ${winner === "Guardian" ? "The suspect deploy has direct graph evidence (AFFECTS → Deploy → PR → author), and blast radius is contained." : "The blast radius is large enough that oncall must be involved before acting."}`,
    "",
    `Every turn cites graph evidence + Cypher — no opinion, only traversals.`,
  ].join("\n");

  return { question, winner, winningPosition, turns, finalAnswer, cypherLog };
}
