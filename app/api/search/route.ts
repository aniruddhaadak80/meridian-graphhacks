// MERIDIAN · Search endpoints — vector & hybrid over the graph text.
// GET  /api/search?q=...&tenant=...&mode=hybrid|vector

import { NextResponse } from "next/server";
import { seedTenant } from "@/lib/graph/seed";
import { buildVectorIndex, vectorSearch, hybridSearch } from "@/lib/graph/vector-search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") ?? "acme-robotics";
  await seedTenant(tenant);
  const q = searchParams.get("q") ?? "";
  const mode = searchParams.get("mode") ?? "hybrid";
  const topK = Number(searchParams.get("topK") ?? 8);
  buildVectorIndex(tenant);
  const res = mode === "vector" ? vectorSearch(tenant, q, topK, 0.2) : hybridSearch(tenant, q, topK);
  return NextResponse.json({ tenant, mode, q, ...res });
}
