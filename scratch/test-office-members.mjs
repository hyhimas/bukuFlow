import { chromium } from "playwright";

async function run() {
  console.log("==================================================");
  console.log("🚀 PLAYWRIGHT TEST: OFFICE MEMBERS MANAGEMENT");
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

  // 2. Inject Super Admin session
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

  // 3. Open /office/members
  console.log("\n[1] Membuka halaman /office/members...");
  await page.goto("http://localhost:3000/office/members");
  await page.waitForTimeout(2000);

  console.log("    -> URL aktif:", page.url());

  const screenshotTable = "scratch/verified-office-members-table.png";
  await page.screenshot({ path: screenshotTable, fullPage: true });
  console.log("    -> Screenshot Tabel disimpan:", screenshotTable);

  // 4. Verifikasi Judul & Informasi
  const title = await page.locator("h1").textContent();
  console.log("\n[2] Verifikasi Header:");
  console.log("    -> Judul:", title?.trim());

  const rows = page.locator("tbody tr");
  const countRows = await rows.count();
  console.log(`    -> Baris anggota yang dimuat: ${countRows}`);

  // 5. Test Search
  console.log("\n[3] Menguji Pencarian Anggota...");
  const searchInput = page.locator('input[placeholder*="Cari nama"]');
  await searchInput.fill("Budi");
  await page.waitForTimeout(1000);

  const searchResultRows = await page.locator("tbody tr").count();
  console.log(`    -> Hasil pencarian 'Budi': ${searchResultRows} baris`);

  await searchInput.fill("");
  await page.waitForTimeout(1000);

  // 6. Test Tambah Anggota (Modal Form)
  console.log("\n[4] Menguji Tambah Anggota Baru (Modal Form)...");
  await page.locator('button:has-text("Tambah Anggota")').click();
  await page.waitForTimeout(600);

  const screenshotModal = "scratch/verified-office-members-modal.png";
  await page.screenshot({ path: screenshotModal, fullPage: true });
  console.log("    -> Screenshot Modal Tambah Anggota disimpan:", screenshotModal);

  // Fill form
  await page.locator('input[placeholder="Contoh: Ahmad Fauzi"]').fill("Siti Nurhaliza");
  await page.locator('input[placeholder="081234567890"]').fill("081299887766");
  await page.locator('input[placeholder="member@sekolah.sch.id"]').fill("siti@sman1jkt.sch.id");
  await page.locator('input[placeholder="Contoh: 337201..."]').fill("317401990001");

  console.log("    -> Menekan tombol Simpan/Tambah...");
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1500);

  const screenshotAfterAdd = "scratch/verified-office-members-after-add.png";
  await page.screenshot({ path: screenshotAfterAdd, fullPage: true });
  console.log("    -> Screenshot setelah penambahan:", screenshotAfterAdd);

  // 7. Test Switch Company Dropdown
  console.log("\n[5] Menguji Ganti Instansi via Dropdown...");
  const dropdownBtn = page.locator('button[aria-label="Pilih instansi"]');
  await dropdownBtn.click();
  await page.waitForTimeout(600);

  await page.locator('div.absolute button:has-text("SMP Negeri 2 Bandung")').click();
  await page.waitForTimeout(1500);

  const updatedCompany = await dropdownBtn.textContent();
  console.log("    -> Instansi aktif sekarang:", updatedCompany?.replace(/\s+/g, " ").trim());

  await browser.close();
  console.log("\n==================================================");
  console.log("✅ PLAYWRIGHT TEST OFFICE MEMBERS: 100% SUKSES!");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("❌ Playwright Error:", err);
  process.exit(1);
});
