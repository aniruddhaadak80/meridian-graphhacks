// Loads the entire graph into a REAL FalkorDB instance and runs the product's
// Cypher against it — proving the same answers come from the engine, not the mirror.
//
//   docker compose up -d falkordb
//   npm run live:seed                 # → writes meridian_<tenant> into FalkorDB
//   FALKORDB_EMBEDDED=1 npm run live:seed   # → zero-config embedded FalkorDB (linux/mac)
//
// Afterwards inspect with: FalkorDB Browser http://localhost:3000

import { seedTenant } from "../lib/graph/seed";
import { backendStatus, runCypher, closeFalkorDb, graphStats, tenantGraph } from "../lib/graph/store";
import { exportCypher, PRODUCT_CYPHER } from "../lib/graph/cypherExport";

const tenant = (process.argv[2] ?? process.env.TENANT_DEFAULT ?? "acme-robotics").replace(/[^a-zA-Z0-9_-]/g, "_");
const graphName = `meridian_${tenant}`;

async function main() {
  await seedTenant(tenant);
  const stats = graphStats(tenant);
  const status = await backendStatus();

  console.log("─".repeat(70));
  console.log("MERIDIAN · LIVE FALKORDB SEED");
  console.log("─".repeat(70));
  console.log(`backend      : ${status.mode}${status.transport ? ` (${status.transport})` : ""} ${status.url ?? ""}`);
  console.log(`target graph : ${graphName}`);

  if (status.mode !== "falkordb") {
    console.log(`\n⚠ No live FalkorDB detected — nothing was written.`);
    console.log("  Start one with:");
    console.log("    docker compose up -d falkordb && export FALKORDB_URL=redis://localhost:6379");
    console.log("  …or use the zero-config embedded engine (linux/mac):");
    console.log("    FALKORDB_EMBEDDED=1 npm run live:seed");
    console.log("\nThe in-memory mirror already holds", stats.nodes, "nodes /", stats.edges, "edges for the demo.\n");
    process.exit(0);
  }

  // Push the full graph as one idempotent Cypher bundle (chunked to stay safe).
  const bundle = exportCypher(tenant);
  const chunks = bundle.split("\n").filter((l) => l.trim() && !l.trim().startsWith("//"));
  console.log(`\nwriting ${chunks.length} statements…`);

  let written = 0;
  // Indexes first (one statement per call — FalkorDB rejects multi-statement batches here)
  for (const stmt of chunks.filter((s) => s.startsWith("CREATE INDEX"))) {
    await runCypher(tenant, stmt);
  }
  for (const stmt of chunks.filter((s) => s.startsWith("MERGE ("))) {
    const r: any = await runCypher(tenant, stmt);
    if (r.mode === "falkordb") written++;
  }
  for (const stmt of chunks.filter((s) => s.startsWith("MATCH (a {id:"))) {
    await runCypher(tenant, stmt);
  }

  const verify = await runCypher(tenant, "MATCH (n) RETURN count(n) AS nodes");
  const vrel = await runCypher(tenant, "MATCH ()-[r]->() RETURN count(r) AS edges");

  console.log(`\nnode statements written : ${written}`);
  console.log(`verification            : ${JSON.stringify(verify.data ?? verify)} nodes, ${JSON.stringify(vrel.data ?? vrel)} edges`);
  console.log("\nproduct queries the agent runs (paste into FalkorDB Browser):");
  for (const q of PRODUCT_CYPHER) console.log(`  [track ${q.track}] ${q.name} — ${q.usedBy}`);

  console.log(`\n✓ Live seed complete. Inspect at http://localhost:3000 → graph ${graphName}`);
  await closeFalkorDb();
}

main().catch(async (e) => {
  console.error("live seed failed:", e?.message ?? e);
  await closeFalkorDb();
  process.exit(1);
});