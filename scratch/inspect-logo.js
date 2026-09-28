const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // 1. Inspect Login Page Logo
  const loginContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const loginPage = await loginContext.newPage();
  await loginPage.goto('http://localhost:3000/login');
  await loginPage.waitForTimeout(1000);

  const loginLogo = loginPage.locator('img[alt="BukuFlow Logo"]').first();
  const loginLogoBox = await loginLogo.boundingBox();
  console.log('Login Logo Bounding Box:', loginLogoBox);
  await loginPage.screenshot({ path: 'scratch/inspect-login-logo.png' });

  // 2. Inspect Header Logo (Desktop)
  const appDesktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await appDesktopContext.addCookies([{ name: 'bukuflow_session', value: 'true', domain: 'localhost', path: '/' }]);
  const appDesktopPage = await appDesktopContext.newPage();
  await appDesktopPage.goto('http://localhost:3000/dashboard');
  await appDesktopPage.evaluate(() => {
    localStorage.setItem('access_token', 'mock-admin-token');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify({ id: '1', name: 'Demo Admin', email: 'admin@bukuflow.com', role: 'COMPANY_ADMIN', companyId: 'company-001' }));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  });
  await appDesktopPage.reload();
  await appDesktopPage.waitForTimeout(1000);

  const headerLogoDesktop = appDesktopPage.locator('img[alt="BukuFlow Logo"]').first();
  const headerLogoDesktopBox = await headerLogoDesktop.boundingBox();
  console.log('Header Logo Desktop Bounding Box:', headerLogoDesktopBox);
  await appDesktopPage.screenshot({ path: 'scratch/inspect-header-desktop.png' });

  // 3. Inspect Header Logo (Mobile 375px)
  const appMobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await appMobileContext.addCookies([{ name: 'bukuflow_session', value: 'true', domain: 'localhost', path: '/' }]);
  const appMobilePage = await appMobileContext.newPage();
  await appMobilePage.goto('http://localhost:3000/dashboard');
  await appMobilePage.evaluate(() => {
    localStorage.setItem('access_token', 'mock-admin-token');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify({ id: '1', name: 'Demo Admin', email: 'admin@bukuflow.com', role: 'COMPANY_ADMIN', companyId: 'company-001' }));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  });
  await appMobilePage.reload();
  await appMobilePage.waitForTimeout(1000);

  const headerLogoMobile = appMobilePage.locator('img[alt="BukuFlow Logo"]').first();
  const headerLogoMobileBox = await headerLogoMobile.boundingBox();
  console.log('Header Logo Mobile Bounding Box:', headerLogoMobileBox);
  await appMobilePage.screenshot({ path: 'scratch/inspect-header-mobile.png' });

  await browser.close();
})();
