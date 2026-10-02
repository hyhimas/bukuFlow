import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const auditDir = path.resolve("scratch/audit");
if (!fs.existsSync(auditDir)) {
  fs.mkdirSync(auditDir, { recursive: true });
}

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const pagesToTest = [
  { route: "/dashboard", name: "dashboard" },
  { route: "/loans/new", name: "loans-new" },
  { route: "/returns", name: "returns" },
  { route: "/transactions", name: "transactions" },
  { route: "/master/books", name: "master-books" },
  { route: "/master/members", name: "master-members" },
];

async function runAudit() {
  console.log("==================================================");
  console.log("🔍 COMPREHENSIVE UI/UX & RESPONSIVE AUDIT");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });

  const auditLog = [];

  for (const vp of viewports) {
    console.log(`\n📱 TESTING VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });

    await context.addCookies([
      {
        name: "bukuflow_session",
        value: "true",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();

    // Inject Admin session
    await page.addInitScript(() => {
      const user = {
        id: "user-admin-001",
        name: "Demo Admin",
        email: "admin@bukuflow.id",
        username: "admin",
        role: "COMPANY_ADMIN",
        companyId: "company-001",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const loginAt = new Date().toISOString();

      localStorage.setItem("access_token", "mock-admin-jwt-token");
      localStorage.setItem("token_type", "Bearer");
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("auth_login_at", loginAt);
      localStorage.setItem("auth_expires_at", expiresAt);
    });

    for (const p of pagesToTest) {
      const url = `http://localhost:3000${p.route}`;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(1000);

        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        // Screenshot
        const filename = `${p.name}-${vp.name}.png`;
        const filepath = path.join(auditDir, filename);
        await page.screenshot({ path: filepath, fullPage: true });

        console.log(`  ✓ ${p.route.padEnd(20)} -> Screenshot: ${filename} (Overflow: ${overflow ? "⚠️ YES" : "NO"})`);

        auditLog.push({
          page: p.name,
          route: p.route,
          viewport: vp.name,
          dimensions: `${vp.width}x${vp.height}`,
          horizontalOverflow: overflow,
          screenshot: filepath,
        });
      } catch (err) {
        console.error(`  ✗ Error auditing ${p.route} on ${vp.name}:`, err.message);
      }
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(auditDir, "audit-results.json"),
    JSON.stringify(auditLog, null, 2)
  );
  console.log("\n==================================================");
  console.log("✅ AUDIT COMPLETED. Results saved in scratch/audit/");
  console.log("==================================================");
}

runAudit();
