// Dumps the tenant graph as an executable Cypher bundle.
// Usage: npm run cypher [tenant] [-- out/bundle.cypher]
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seedTenant } from "../lib/graph/seed";
import { exportCypher } from "../lib/graph/cypherExport";
import { graphStats } from "../lib/graph/store";

async function main() {
  const args = process.argv.slice(2);
  const flagIdx = args.indexOf("--");
  const positional = flagIdx >= 0 ? args.slice(0, flagIdx) : args;
  const tenant = positional[0] ?? "acme-robotics";
  const out = flagIdx >= 0 ? args[flagIdx + 1] : null;

  await seedTenant(tenant);
  const cypher = exportCypher(tenant);
  const s = graphStats(tenant);

  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, cypher, "utf8");
    console.log(`wrote ${out} — ${s.nodes} nodes, ${s.edges} edges`);
    console.log(`load with: redis-cli GRAPH.QUERY meridian_${tenant} "$(cat ${out})"`);
  } else {
    process.stdout.write(cypher + "\n");
  }
}

main();