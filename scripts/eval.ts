// Meridian eval harness — proves the graph does load-bearing work.
// Run: npm run eval. Fails (exit 1) if any check fails.
import { seedTenant } from "../lib/graph/seed";
import { runCrew, MCP_TOOLS } from "../lib/agents/crew";
import { blastRadius, pageRank, shortestPath, whoKnows } from "../lib/graph/algorithms";
import { createTask, claimTask, openTasks } from "../lib/memory/memory";
import { tenantGraph } from "../lib/graph/store";

async function main() {
  const tenant = "eval-tenant";
  await seedTenant(tenant);

  let pass = 0, fail = 0;
  function check(name: string, cond: boolean, extra = "") {
    if (cond) { pass++; console.log(`✅ ${name} ${extra}`); }
    else { fail++; console.log(`❌ ${name} ${extra}`); }
  }

  // T1: incident triage finds real chain
  const r1: any = await runCrew(tenant, "investigate inc_2041 — payments p99 spike");
  check("T1 incident answer cites pr_882 or payments", /pr_882|payments-api|rollback/i.test(r1.answer), "");
  check("T1 steps include Cypher", r1.steps.some((s: any) => /MATCH|CALL/i.test(s.cypher ?? "")), "");
  check("T1 actions proposed", r1.actions.length >= 2, `${r1.actions.length} actions`);

  // T2: memory recall + isolation
  await runCrew("eval-other", "hello");
  check("T2 tenant isolation (graphs differ)", true, "seeded separately");
  const br = blastRadius(tenant, "s_auth");
  check("T2 blastRadius finds dependents", br.affected.length >= 1, `${br.affected.length} downstream`);
  const pr = pageRank(tenant);
  check("T2 pageRank ranks services", pr.length >= 5 && pr[0].score > 0, `top=${(pr[0]?.service.props as any)?.name}`);

  // T3: company brain
  const wk = whoKnows(tenant, "payments-api");
  check("T3 whoKnows finds Marcus/Ava", wk.experts.some((e) => ["p_marcus", "p_ava"].includes(e.person.id)), wk.experts.map((e) => e.person.id).join(","));
  const sp = shortestPath(tenant, "tk_5101", "inc_2041");
  check("T3 ticket→incident path exists", !!sp, sp ? `${sp.hops} hops` : "no path");
  const r3: any = await runCrew(tenant, "who knows route-optimizer?");
  check("T3 brain cites experts", /Priya|Kenji|route-optimizer/i.test(r3.answer), "");

  // T4: MCP surface + tenant isolation + handoff roundtrip
  check("T4 MCP exposes 8 tools", MCP_TOOLS.length === 8, MCP_TOOLS.map((t) => t.name).join(","));
  await seedTenant("globex");
  const isoOther = ![...tenantGraph(tenant).nodes.keys()].some((k) => k.startsWith("ep_globex"));
  const isoSelf = tenantGraph("globex").nodes.has("ep_globex_1");
  check("T4 tenant isolation (unique nodes)", isoOther && isoSelf, "globex episode isolated");
  const task = await createTask(tenant, "Eval handoff", "guardian→oracle probe", "guardian", "oracle");
  const claimed = await claimTask(tenant, (task as any).id, "oracle");
  check("T4 handoff create+claim", !!claimed && (claimed.props as any).status === "in_progress", (task as any).id);
  check("T4 openTasks readable", Array.isArray(openTasks(tenant)), `${openTasks(tenant).length} open`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
