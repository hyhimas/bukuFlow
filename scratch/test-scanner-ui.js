const { chromium } = require('playwright');

const user = {
  id: "user-001",
  companyId: "company-001",
  name: "Admin Surakarta",
  email: "admin@bukuflow.id",
  username: "admin",
  role: "COMPANY_ADMIN",
  status: "ACTIVE",
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies([
    { name: 'bukuflow_session', value: 'true', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();

  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'mock-token-admin');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify(u));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  }, user);

  await page.goto('http://localhost:3000/loans/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Click on Budi Santoso member
  const memberBtn = page.locator('button:has-text("Budi Santoso")').first();
  await memberBtn.click();
  await page.waitForTimeout(600);

  // Click Scan Kamera
  const scanBtn = page.locator('button:has-text("Scan Kamera")');
  await scanBtn.click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'scratch/scanner-modal-ui.png' });
  await browser.close();
  console.log('SUCCESSFULLY SAVED SCANNER UI SCREENSHOT!');
})();
