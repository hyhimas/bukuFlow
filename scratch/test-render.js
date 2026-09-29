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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "book-002",
    code: "BK-002",
    title: "Bumi Manusia",
    isbn: "978-979-97312-3-4",
    author: "Pramoedya Ananta Toer",
    category: "Sastra",
    totalCopies: 4,
    availableCopies: 0,
    status: "BORROWED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "book-003",
    code: "BK-003",
    title: "Filosofi Teras",
    isbn: "978-602-412-518-9",
    author: "Henry Manampiring",
    category: "Self Improvement",
    totalCopies: 3,
    availableCopies: 3,
    status: "AVAILABLE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const mockCopies = [
  { id: "copy-001", bookId: "book-001", code: "BK-001-C01", barcode: "BK-001-C01", status: "AVAILABLE", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "copy-002", bookId: "book-001", code: "BK-001-C02", barcode: "BK-001-C02", status: "AVAILABLE", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "copy-003", bookId: "book-001", code: "BK-001-C03", barcode: "BK-001-C03", status: "AVAILABLE", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "copy-004", bookId: "book-002", code: "BK-002-C01", barcode: "BK-002-C01", status: "BORROWED", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "copy-005", bookId: "book-003", code: "BK-003-C01", barcode: "BK-003-C01", status: "AVAILABLE", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

(async () => {
  const browser = await chromium.launch();
  
  const viewports = [
    { name: 'ipad-portrait', width: 768, height: 1024 },
    { name: 'ipad-air', width: 820, height: 1180 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 800 }
  ];

  const user = {
    id: "user-001",
    name: "Admin Perpustakaan",
    email: "admin@perpustakaan.com",
    role: "COMPANY_ADMIN",
    companyId: "company-001",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    await context.addCookies([
      { name: 'bukuflow_session', value: 'true', domain: 'localhost', path: '/' }
    ]);

    const page = await context.newPage();

    // Mock API routes
    await page.route('**/catalog/books/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/copies')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockCopies })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockBooks, total: mockBooks.length, page: 1, pageSize: 10, totalPages: 1 })
        });
      }
    });

    await page.route('**/catalog/books*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockBooks, total: mockBooks.length, page: 1, pageSize: 10, totalPages: 1 })
      });
    });

    await page.addInitScript((u) => {
      localStorage.setItem('access_token', 'mock-token-admin');
      localStorage.setItem('token_type', 'Bearer');
      localStorage.setItem('auth_user', JSON.stringify(u));
      localStorage.setItem('auth_login_at', new Date().toISOString());
      localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
    }, user);

    // 1. Visit /master/books
    await page.goto('http://localhost:3000/master/books', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `scratch/rendered-${vp.name}-master-books.png`, fullPage: false });

    // 2. Open Barcode Print Modal
    const printBtn = page.getByRole('button', { name: /Cetak Semua Barcode/i });
    if (await printBtn.isVisible()) {
      await printBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `scratch/rendered-${vp.name}-print-modal.png`, fullPage: false });
    }

    await context.close();
  }

  await browser.close();
  console.log('ALL RENDER SCREENSHOTS GENERATED CLEANLY!');
})();
