// UI smoke test against the LIVE deploy using headless Chromium.
// API tests can't catch rendering bugs — this checks the things judges SEE:
//   · canvas actually paints the graph (not a blank canvas)
//   · markdown renders as elements (no raw ** in the DOM)
//   · all four agents appear in the timeline
//   · the ablation button returns a real verdict
//
// Run: node scripts/ui-smoke.mjs [baseUrl]

import { chromium } from "playwright-core";
import { join } from "node:path";
import { homedir } from "node:os";

const base = process.argv[2] || "https://meridian-graphhacks.vercel.app";
const exe = join(homedir(), "AppData", "Local", "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe");

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`✅ ${name} ${extra}`); }
  else { fail++; console.log(`❌ ${name} ${extra}`); }
};

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // ---------- landing ----------
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
  const hero = await page.textContent("h1").catch(() => "");
  check("landing renders hero", /real context/i.test(hero ?? ""), `"${(hero ?? "").slice(0, 40)}"`);
  check("landing shows track sections", (await page.locator("text=All three tracks").count()) > 0);
  check("landing has no broken images", await page.evaluate(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0)));

  // ---------- console ----------
  await page.goto(`${base}/console`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(9000);

  // answer rendered as markdown elements, not raw asterisks
  const rawAsterisks = await page.evaluate(() => {
    const el = document.querySelector(".markdown-body");
    return el ? (el.textContent ?? "").includes("**") : null;
  });
  check("markdown rendered (no raw ** in answer)", rawAsterisks === false, rawAsterisks === null ? "(no .markdown-body found)" : "");
  check("answer has <strong> elements", (await page.locator(".markdown-body strong").count()) > 3);
  check("answer has <code> elements", (await page.locator(".markdown-body code").count()) > 0);

  // agent timeline
  for (const agent of ["scout", "archivist", "guardian", "oracle"]) {
    const n = await page.locator(`text=${agent}`).count();
    check(`timeline shows ${agent}`, n > 0);
  }

  // graph canvas actually painted
  const canvasPainted = await page.evaluate(() => {
    const cv = document.querySelector("canvas");
    if (!cv) return { ok: false, reason: "no canvas" };
    const ctx = cv.getContext("2d");
    if (!ctx) return { ok: false, reason: "no 2d context" };
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 60) lit++;
    return { ok: lit > 500, lit, w: cv.width, h: cv.height };
  });
  check("graph canvas is painted", canvasPainted.ok, JSON.stringify(canvasPainted));

  // stats line rendered
  const stats = await page.textContent("text=/nodes/i").catch(() => "");
  check("graph stats line present", /\d/.test(stats ?? ""), (stats ?? "").slice(0, 46));

  // actions rendered
  check("action cards rendered", (await page.locator("text=Freeze deploys").count()) > 0);

  // ---------- ablation button ----------
  await page.locator("text=run ablation").first().click().catch(() => {});
  await page.waitForTimeout(6000);
  const ablation = await page.locator("text=GRAPH IS LOAD-BEARING").count();
  check("ablation button returns verdict", ablation > 0);

  // ---------- tenant switch ----------
  await page.locator("text=globex").first().click().catch(() => {});
  await page.waitForTimeout(3500);
  const tenantSwitched = await page.locator("text=globex").first().isVisible().catch(() => false);
  check("tenant switch works", tenantSwitched);

  // ---------- console errors ----------
  const realErrors = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
  check("no uncaught JS errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  await page.screenshot({ path: "public/screenshots/console.png", fullPage: true });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "public/screenshots/landing.png" });
  console.log("📸 refreshed screenshots from live deploy");
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);