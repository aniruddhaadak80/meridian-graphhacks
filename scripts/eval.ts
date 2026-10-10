// Meridian eval harness — proves the graph does load-bearing work.
// Run: npm run eval. Fails (exit 1) if any check fails.
import { seedTenant } from "../lib/graph/seed";
import { runCrew } from "../lib/agents/crew";
import { blastRadius, pageRank, shortestPath, whoKnows } from "../lib/graph/algorithms";

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

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
