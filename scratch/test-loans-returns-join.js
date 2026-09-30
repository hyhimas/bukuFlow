const { chromium } = require('playwright');

const mockBooks = [
  {
    id: "book-001",
    code: "BK-001",
    title: "Laskar Pelangi",
    isbn: "978-979-3062-79-2",
    author: "Andrea Hirata",
    category: "Fiksi",
    totalCopies: 5,
    availableCopies: 3,
    status: "AVAILABLE",
  }
];

const mockCopies = [
  { id: "copy-001", bookId: "book-001", code: "BK-001-C01", barcode: "BK-001-C01", status: "BORROWED" },
  { id: "copy-002", bookId: "book-001", code: "BK-001-C02", barcode: "BK-001-C02", status: "AVAILABLE" }
];

const mockMembers = [
  {
    id: "member-001",
    code: "MBR-001",
    memberNumber: "MBR-001",
    name: "Budi Santoso",
    email: "budi@example.com",
    phone: "081234567890",
    identityNumber: "3372010101010001",
    status: "ACTIVE",
  }
];

const rawLoans = [
  {
    id: "loan-101",
    company_id: "company-001",
    loan_number: "TRX-2026-001",
    member_id: "member-001",
    copy_ids: ["copy-001"],
    borrowed_at: "2026-09-25T08:00:00.000Z",
    due_at: "2026-10-02T23:59:59.000Z",
    status: "ACTIVE",
    created_at: "2026-09-25T08:00:00.000Z",
    updated_at: "2026-09-25T08:00:00.000Z",
  }
];

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
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  await context.addCookies([
    { name: 'bukuflow_session', value: 'true', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();

  // Mock API routes
  await page.route('https://api.office.teknologikartu.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/loan/returns/active') || url.includes('/returns/active')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: rawLoans }) });
    } else if (url.includes('/loan') || url.includes('/loans')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: rawLoans }) });
    } else if (url.includes('/catalog/books') || url.includes('/books')) {
      if (url.includes('/copies')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mockCopies }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mockBooks, items: mockBooks, total: 1 }) });
      }
    } else if (url.includes('/member')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mockMembers, items: mockMembers, total: 1 }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
  });

  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'mock-token-admin');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify(u));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  }, user);

  // 1. Check /loans and click detail
  await page.goto('http://localhost:3000/loans', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('button:has-text("TRX-2026-001")').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/joined-loans-detail.png' });

  // 2. Check /returns and click detail
  await page.goto('http://localhost:3000/returns', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('button:has-text("TRX-2026-001")').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/joined-returns-detail.png' });

  await browser.close();
  console.log('BOTH DETAIL SCREENSHOTS SAVED!');
})();
