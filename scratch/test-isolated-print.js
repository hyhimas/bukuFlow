const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test standalone HTML print
  const stickersHtml = `
    <div class="barcode-sticker-card">
      <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-align: center; font-weight: bold; font-size: 11px;">
        SMA NEGERI 1 JAKARTA<br/><span style="font-size: 9px; color: #64748b;">PERPUSTAKAAN DIGITAL</span>
      </div>
      <div style="text-align: center; margin: 4px 0;">
        <p style="font-weight: bold; font-size: 11px;">Laskar Pelangi</p>
        <p style="font-size: 9px; color: #64748b;">Kategori: Novel</p>
      </div>
      <div style="text-align: center;">
        <p style="font-family: monospace; font-size: 12px; font-weight: bold;">BK-001-C01</p>
      </div>
    </div>
  `;

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #ffffff;
            color: #0f172a;
            padding: 0;
            margin: 0;
          }
          .sheet-container {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6mm 4mm;
            width: 100%;
          }
          .barcode-sticker-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            width: 100%;
            max-width: 95mm;
            margin: 0 auto;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 8px 10px;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          ${stickersHtml.repeat(12)}
        </div>
      </body>
    </html>
  `);

  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'scratch/test-isolated-print.png', fullPage: true });

  await browser.close();
  console.log('Isolated print screenshot created!');
})();
