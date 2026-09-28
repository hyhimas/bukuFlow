const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 }
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }
    });

    await context.addCookies([
      { name: 'bukuflow_session', value: 'true', domain: 'localhost', path: '/' }
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
    await page.waitForTimeout(600);

    // 1. View Mode
    await page.screenshot({ path: `scratch/verified-profile-${vp.name}-view.png` });
    console.log(`Saved ${vp.name} View Mode`);

    // 2. Edit Mode
    await page.click('text=Ubah Data');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `scratch/verified-profile-${vp.name}-edit.png` });
    console.log(`Saved ${vp.name} Edit Mode`);

    // 3. Password Mode
    await page.click('text=Batal');
    await page.waitForTimeout(300);
    await page.click('text=Ubah Password');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `scratch/verified-profile-${vp.name}-password.png` });
    console.log(`Saved ${vp.name} Password Mode`);

    await context.close();
  }

  await browser.close();
  console.log('All responsive tests completed!');
})();
