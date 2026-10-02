import { chromium } from "playwright";

async function run() {
  console.log("==================================================");
  console.log("🚀 TESTING SUPER ADMIN MODULES WITH PLAYWRIGHT");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
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

  await page.addInitScript(() => {
    const user = {
      id: "user-superadmin-001",
      name: "Super Admin",
      email: "superadmin@bukuflow.id",
      username: "superadmin",
      role: "SUPER_ADMIN",
      companyId: "company-001",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const loginAt = new Date().toISOString();

    localStorage.setItem("access_token", "mock-super-admin-jwt-token");
    localStorage.setItem("token_type", "Bearer");
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("auth_login_at", loginAt);
    localStorage.setItem("auth_expires_at", expiresAt);
  });

  // 1. Test /office/dashboard
  console.log("[1] Testing /office/dashboard...");
  await page.goto("http://localhost:3000/office/dashboard");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/audit/office-dashboard.png", fullPage: true });

  // 2. Test /office/companies
  console.log("[2] Testing /office/companies...");
  await page.goto("http://localhost:3000/office/companies");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/audit/office-companies.png", fullPage: true });

  // 3. Test /office/users
  console.log("[3] Testing /office/users...");
  await page.goto("http://localhost:3000/office/users");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/audit/office-users.png", fullPage: true });

  console.log("✅ All screenshots captured successfully!");
  await browser.close();
}

run().catch((e) => console.error(e));
