const { chromium } = require('playwright');

const mockBooks = [
  {
    id: "book-001",
    code: "BK-001",
    title: "Laskar Pelangi",
    isbn: "978-979-3062-79-2",
    author: "Andrea Hirata",
    category: "Novel",
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
  }
];

const mockCopies = [
  { id: "copy-001", bookId: "book-001", code: "BK-001-C01", barcode: "BK-001-C01", status: "AVAILABLE" },
  { id: "copy-002", bookId: "book-001", code: "BK-001-C02", barcode: "BK-001-C02", status: "AVAILABLE" },
  { id: "copy-003", bookId: "book-001", code: "BK-001-C03", barcode: "BK-001-C03", status: "AVAILABLE" },
  { id: "copy-004", bookId: "book-001", code: "BK-001-C04", barcode: "BK-001-C04", status: "AVAILABLE" },
  { id: "copy-005", bookId: "book-001", code: "BK-001-C05", barcode: "BK-001-C05", status: "AVAILABLE" },
  { id: "copy-006", bookId: "book-002", code: "BK-002-C01", barcode: "BK-002-C01", status: "AVAILABLE" },
  { id: "copy-007", bookId: "book-002", code: "BK-002-C02", barcode: "BK-002-C02", status: "AVAILABLE" },
  { id: "copy-008", bookId: "book-002", code: "BK-002-C03", barcode: "BK-002-C03", status: "AVAILABLE" },
  { id: "copy-009", bookId: "book-002", code: "BK-002-C04", barcode: "BK-002-C04", status: "AVAILABLE" }
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
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

  await page.addInitScript(() => {
    const u = {
      id: "user-001",
      name: "Admin Perpustakaan",
      email: "admin@perpustakaan.com",
      role: "COMPANY_ADMIN",
      companyId: "company-001",
      status: "ACTIVE",
    };
    localStorage.setItem('access_token', 'mock-token-admin');
    localStorage.setItem('token_type', 'Bearer');
    localStorage.setItem('auth_user', JSON.stringify(u));
    localStorage.setItem('auth_login_at', new Date().toISOString());
    localStorage.setItem('auth_expires_at', new Date(Date.now() + 86400000).toISOString());
  });

  await page.goto('http://localhost:3000/master/books', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Open modal
  const printBtn = page.getByRole('button', { name: /Cetak Semua Barcode/i });
  await printBtn.click();
  await page.waitForSelector('#printable-barcode-sheet', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Screenshot modal preview on screen
  await page.screenshot({ path: 'scratch/screen-modal-preview.png' });

  // Emulate print media and take PDF and screenshot
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'scratch/print-emulated-screenshot.png', fullPage: true });
  await page.pdf({ path: 'scratch/output.pdf', format: 'A4', printBackground: true });

  await browser.close();
  console.log('PRINT PDF GENERATED!');
})();
