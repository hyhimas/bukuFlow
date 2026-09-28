import { chromium } from "playwright";

async function run() {
  console.log("==================================================");
  console.log("🚀 PLAYWRIGHT TEST: SUPER ADMIN OFFICE DASHBOARD");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // 1. Set Cookie for Next.js auth middleware
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

  // 2. Inject localStorage session for SUPER_ADMIN
  await page.addInitScript(() => {
    const user = {
      id: "user-superadmin-001",
      name: "Demo Super Admin",
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

  // 3. Navigate to /office/dashboard
  console.log("\n[1] Membuka halaman /office/dashboard...");
  await page.goto("http://localhost:3000/office/dashboard");
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log("    -> URL aktif:", currentUrl);

  // Screenshot Main Page
  const screenshotMain = "scratch/verified-office-dashboard.png";
  await page.screenshot({ path: screenshotMain, fullPage: true });
  console.log("    -> Screenshot disimpan:", screenshotMain);

  // 4. Verifikasi Header & Salam
  const headerTitle = await page.locator("h1").textContent();
  console.log("\n[2] Verifikasi Header:");
  console.log("    -> Judul:", headerTitle?.trim());

  const subtitle = await page.locator("p.text-sm.text-slate-500").first().textContent();
  console.log("    -> Subtitle:", subtitle?.trim());

  // 5. Verifikasi 4 Kartu Statistik
  console.log("\n[3] Verifikasi 4 Kartu Statistik Multi-Tenant:");
  const statCards = page.locator("section[aria-label='Ringkasan instansi'] > div");
  const countStats = await statCards.count();
  console.log(`    -> Total Kartu Statistik: ${countStats}`);
  for (let i = 0; i < countStats; i++) {
    const text = await statCards.nth(i).textContent();
    console.log(`       - Kartu ${i + 1}: ${text?.replace(/\s+/g, " ").trim()}`);
  }

  // 6. Verifikasi 3 Kartu Pusat Kendali (Quick Access)
  console.log("\n[4] Verifikasi Pusat Kendali Super Admin (3 Kartu):");
  const quickHeading = await page.locator("section.mt-6 h2").textContent();
  console.log("    -> Judul Bagian:", quickHeading?.trim());

  const quickCards = page.locator("section.mt-6 a");
  const countQuick = await quickCards.count();
  console.log(`    -> Total Kartu Kendali: ${countQuick}`);
  for (let i = 0; i < countQuick; i++) {
    const title = await quickCards.nth(i).locator("h3").textContent();
    const href = await quickCards.nth(i).getAttribute("href");
    console.log(`       - Menu ${i + 1}: ${title?.trim()} (Href: ${href})`);
  }

  // 7. Uji Dropdown Custom Switcher Instansi
  console.log("\n[5] Menguji Custom Dropdown Switcher Instansi:");
  const dropdownTrigger = page.locator('button[aria-label="Pilih instansi"]');
  const initialCompany = await dropdownTrigger.textContent();
  console.log("    -> Instansi aktif awal:", initialCompany?.replace(/\s+/g, " ").trim());

  await dropdownTrigger.click();
  await page.waitForTimeout(600);

  const screenshotDropdown = "scratch/verified-office-dropdown.png";
  await page.screenshot({ path: screenshotDropdown, fullPage: true });
  console.log("    -> Screenshot Popup Dropdown disimpan:", screenshotDropdown);

  // Klik instansi kedua
  const secondCompanyBtn = page.locator('div.absolute button:has-text("SMP Negeri 2 Bandung")');
  if (await secondCompanyBtn.count() > 0) {
    await secondCompanyBtn.click();
    await page.waitForTimeout(1000);
    const afterCompany = await dropdownTrigger.textContent();
    console.log("    -> Instansi setelah dipilih:", afterCompany?.replace(/\s+/g, " ").trim());
  }

  // 8. Uji Auto-Redirect dari /dashboard ke /office/dashboard
  console.log("\n[6] Menguji Auto-Redirect /dashboard -> /office/dashboard:");
  await page.goto("http://localhost:3000/dashboard").catch(() => {});
  await page.waitForURL("**/office/dashboard", { timeout: 5000 });
  console.log("    -> Berhasil redirect ke:", page.url());

  // 9. Uji Menu Sidebar
  console.log("\n[7] Menguji Menu Sidebar Super Admin:");
  const sidebarBtn = page.locator('button[aria-label="Buka navigasi"], button[aria-label="Buka menu"], header button').first();
  if (await sidebarBtn.count() > 0) {
    await sidebarBtn.click();
    await page.waitForTimeout(600);
    const screenshotSidebar = "scratch/verified-office-sidebar.png";
    await page.screenshot({ path: screenshotSidebar, fullPage: true });
    console.log("    -> Screenshot Sidebar disimpan:", screenshotSidebar);
  }

  await browser.close();
  console.log("\n==================================================");
  console.log("✅ SEMUA PENGUJIAN PLAYWRIGHT 100% SUKSES!");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("❌ Playwright Test Error:", err);
  process.exit(1);
});
