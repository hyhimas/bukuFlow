const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    {
      name: 'bukuflow_session',
      value: 'true',
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/test-api');
  
  await page.evaluate(() => {
    localStorage.setItem('access_token', 'mock-super-token');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'usr-001',
      name: 'Super Admin User',
      email: 'superadmin@bukuflow.id',
      role: 'SUPER_ADMIN',
      companyId: 'company-001'
    }));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  });

  await page.reload();
  await page.waitForTimeout(1000);

  // Click on 'Test via Helper' button
  const helperBtn = page.locator('text=Test via Helper (getOfficeDashboardApi)');
  await helperBtn.click();
  await page.waitForTimeout(800);

  const section16 = page.locator('section:has-text("16. GET /office/dashboard")');
  await section16.scrollIntoViewIfNeeded();
  await section16.screenshot({ path: 'scratch/verified-test-api-section16-full.png' });
  console.log('Saved scratch/verified-test-api-section16-full.png');

  await browser.close();
})();
