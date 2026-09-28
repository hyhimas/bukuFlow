const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });

  await context.addCookies([
    {
      name: 'bukuflow_session',
      value: 'true',
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/dashboard');
  
  await page.evaluate(() => {
    localStorage.setItem('access_token', 'mock-admin-token');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify({
      id: '6ab348a77dfa3261ea67d2f0',
      name: 'Demo Admin',
      email: 'admin@bukuflow.com',
      role: 'COMPANY_ADMIN',
      companyId: '6ab348a67dfa3261ea67d2ed'
    }));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  });

  await page.reload();
  await page.waitForTimeout(1000);

  // 1. Capture clean mobile header
  await page.screenshot({ path: 'scratch/verified-mobile-header-clean.png' });
  console.log('Saved clean mobile header screenshot');

  // 2. Open sidebar on mobile
  await page.click('button[aria-label="Buka menu navigasi"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/verified-mobile-sidebar-open.png' });
  console.log('Saved mobile sidebar screenshot');

  await browser.close();
})();
