// Runs the product's real Cypher against a live FalkorDB and prints results +
// timing. This is the evidence that agents traverse the engine, not a mirror.
//
//   npm run live:seed        # after docker compose up -d falkordb
//   npm run live:check

import { seedTenant } from "../lib/graph/seed";
import { backendStatus, runCypher, closeFalkorDb, graphStats } from "../lib/graph/store";
import { PRODUCT_CYPHER } from "../lib/graph/cypherExport";

const tenant = (process.argv[2] ?? "acme-robotics").replace(/[^a-zA-Z0-9_-]/g, "_");

async function main() {
  await seedTenant(tenant);
  const status = await backendStatus();
  if (status.mode !== "falkordb") {
    console.log("No live FalkorDB — run `npm run live:seed` with a running instance first.");
    console.log("Mirror stats:", graphStats(tenant));
    process.exit(0);
  }
  console.log(`Live backend: ${status.mode} (${status.transport}) ${status.url}\n`);

  const run = async (name: string, cypher: string, params: Record<string, any> = {}) => {
    const t0 = performance.now();
    const r: any = await runCypher(tenant, cypher, params);
    const ms = (performance.now() - t0).toFixed(2);
    const head = JSON.stringify(r.data ?? r).slice(0, 150);
    console.log(`${name.padEnd(22)} ${ms.padStart(7)}ms  ${head}`);
  };

  await run("nodeCount", "MATCH (n) RETURN count(n) AS c");
  await run("rootCause5Hop", PRODUCT_CYPHER[0].cypher, { incident: "inc_2041" });
  await run("blastRadius", PRODUCT_CYPHER[1].cypher, { service: "s_auth" });
  await run("whoKnows", PRODUCT_CYPHER[2].cypher, { service: "payments-api" });
  await run("memoryRecall", PRODUCT_CYPHER[3].cypher, { q: "payments" });
  await run("decisionLineage", PRODUCT_CYPHER[5].cypher, {});
  await run("proofOfNoPath", PRODUCT_CYPHER[6].cypher, { from: "p_omar", to: "dec_41" });
  console.log("\n✓ All product queries executed against the live engine.");
  await closeFalkorDb();
}

main().catch(async (e) => { console.error(e); await closeFalkorDb(); process.exit(1); });