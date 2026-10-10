// Screenshot harness: captures landing + console from the live deployment.
// Run: node scripts/shots.mjs [baseUrl]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const base = process.argv[2] || "https://meridian-graphhacks.vercel.app";
const outDir = "public/screenshots";
mkdirSync(outDir, { recursive: true });

const exe = join(homedir(), "AppData", "Local", "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe");
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: outDir + "/landing.png" });
console.log("saved", outDir + "/landing.png");

await page.goto(base + "/console", { waitUntil: "networkidle", timeout: 60000 });
// console auto-runs the incident investigation on mount; wait for the answer
try {
  await page.waitForSelector("text=inc_2041", { timeout: 30000 });
} catch {}
await page.waitForTimeout(4000);
await page.screenshot({ path: outDir + "/console.png", fullPage: false });
console.log("saved", outDir + "/console.png");

await browser.close();
console.log("done");
