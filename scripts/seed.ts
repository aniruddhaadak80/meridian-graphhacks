import { seedTenant } from "../lib/graph/seed";
import { graphStats } from "../lib/graph/store";

async function main() {
  const tenant = process.argv[2] ?? process.env.TENANT_DEFAULT ?? "acme-robotics";
  const res = await seedTenant(tenant);
  console.log(JSON.stringify({ tenant, ...res, stats: graphStats(tenant) }, null, 2));
}

main();
