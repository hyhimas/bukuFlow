const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
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
  
  await page.goto('http://localhost:3000/profile');
  
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

  // 1. Capture View Mode
  await page.screenshot({ path: 'scratch/verified-profile-view-mode.png', fullPage: true });
  console.log('Saved View Mode screenshot');

  // 2. Click Ubah Data Karyawan
  await page.click('text=Ubah Data Karyawan');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/verified-profile-edit-mode.png', fullPage: true });
  console.log('Saved Edit Profile Mode screenshot');

  // 3. Cancel and Click Ubah Password
  await page.click('text=Batal');
  await page.waitForTimeout(300);
  await page.click('text=Ubah Password');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/verified-profile-password-mode.png', fullPage: true });
  console.log('Saved Change Password Mode screenshot');

  await browser.close();
})();
