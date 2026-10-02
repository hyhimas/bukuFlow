"use client";

import { useEffect, useState } from "react";
import BookBarcodeLabel from "./BookBarcodeLabel";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

export interface PrintableBookItem {
  bookTitle: string;
  bookCode: string;
  copyCode: string;
  category?: string;
}

interface BookBarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PrintableBookItem[];
  title?: string;
  companyName?: string;
}

export default function BookBarcodePrintModal({
  isOpen,
  onClose,
  items,
  title = "Cetak Label Barcode & QR Code",
  companyName = "SMA NEGERI 1 JAKARTA",
}: BookBarcodePrintModalProps) {
  const [format, setFormat] = useState<"barcode" | "qrcode" | "both">("both");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printArea = document.getElementById("printable-barcode-sheet");
    if (!printArea) {
      window.print();
      return;
    }

    // Create or reuse hidden isolated iframe
    let printFrame = document.getElementById("barcode-print-iframe") as HTMLIFrameElement | null;
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "barcode-print-iframe";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "none";
      printFrame.style.opacity = "0";
      printFrame.style.pointerEvents = "none";
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc || !printFrame.contentWindow) {
      window.print();
      return;
    }

    // Collect all styles from parent document (Tailwind CSS, fonts, etc.)
    const headStyles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("\n");

    // Write completely isolated print document with explicit styles
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          ${headStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 6mm !important;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .sheet-grid {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 6mm 4mm !important;
              width: 100% !important;
              padding: 4mm 2mm !important;
            }
            .break-inside-avoid {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              display: flex !important;
              justify-content: center !important;
              width: 100% !important;
            }
            .barcode-sticker-card {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              break-after: auto !important;
              page-break-after: auto !important;
              width: 100% !important;
              max-width: 95mm !important;
              margin: 0 auto !important;
              border: 1px solid #94a3b8 !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          <div class="sheet-grid">
            ${printArea.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    // Trigger printing once loaded
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.error("Iframe print fallback:", err);
        window.print();
      }
    }, 250);
  };

  return (
    <div
      className="barcode-print-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Global CSS for Print Output (Ctrl+P fallback) */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm !important;
          }
          header, nav, aside, footer, [data-sidebar], .print\\:hidden {
            display: none !important;
          }
          html, body {
            overflow: visible !important;
            height: auto !important;
            min-height: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .barcode-print-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
          }
          .barcode-print-container {
            position: static !important;
            display: block !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .barcode-print-body {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            max-height: none !important;
          }
          #printable-barcode-sheet {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6mm 4mm !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .barcode-sticker-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: auto !important;
            page-break-after: auto !important;
            width: 100% !important;
            max-width: 95mm !important;
            margin: 0 auto !important;
            border: 1px solid #334155 !important;
            border-radius: 6px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Container - hide from print */}
      <div
        className="barcode-print-container relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-print-modal-title"
      >
        {/* Header (No Print) */}
        <div className="border-b border-slate-200 bg-white print:hidden">
          {/* Top title & close bar */}
          <div className="flex items-center justify-between px-5 py-3.5 sm:py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <span className="text-xl">🏷️</span>
              </div>
              <div className="min-w-0">
                <h3
                  id="barcode-print-modal-title"
                  className="truncate text-base sm:text-lg font-bold text-slate-900"
                >
                  {title}
                </h3>
                <p className="truncate text-xs text-slate-500">
                  Total {items.length} label siap dicetak pada kertas stiker / HVS A4
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
              title="Tutup Modal"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </button>
          </div>

          {/* Controls toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs min-w-[180px]">
                <span className="font-semibold text-slate-600 shrink-0">Format:</span>
                <Dropdown
                  value={format}
                  size="sm"
                  onChange={(val) => setFormat(val as any)}
                  className="flex-1"
                  options={[
                    { value: "both", label: "Kombinasi (1D + QR)" },
                    { value: "barcode", label: "Barcode 1D Only" },
                    { value: "qrcode", label: "QR Code 2D Only" },
                  ]}
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs min-w-[150px]">
                <span className="font-semibold text-slate-600 shrink-0">Ukuran:</span>
                <Dropdown
                  value={size}
                  size="sm"
                  onChange={(val) => setSize(val as any)}
                  className="flex-1"
                  options={[
                    { value: "sm", label: "Kecil (Kompak)" },
                    { value: "md", label: "Sedang (Standar)" },
                    { value: "lg", label: "Besar (Jelas)" },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1 sm:flex-initial text-xs px-3.5 py-1.5 h-8"
              >
                Tutup
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={handlePrint}
                className="flex-1 sm:flex-initial text-xs px-4 py-1.5 h-8 font-bold shadow-xs"
              >
                🖨️ Cetak Sekarang
              </Button>
            </div>
          </div>
        </div>

        {/* Printable Area */}
        <div className="barcode-print-body flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 print:bg-white print:p-0 print:overflow-visible">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Tidak ada label untuk dicetak.
            </div>
          ) : (
            <div
              id="printable-barcode-sheet"
              className="mx-auto flex flex-wrap justify-center gap-3 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs print:m-0 print:p-0 print:border-0 print:shadow-none print:gap-2 print:justify-start"
            >
              {items.map((item, index) => (
                <div key={`${item.copyCode}-${index}`} className="break-inside-avoid">
                  <BookBarcodeLabel
                    companyName={companyName}
                    bookTitle={item.bookTitle}
                    bookCode={item.bookCode}
                    copyCode={item.copyCode}
                    category={item.category}
                    format={format}
                    size={size}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info (No Print) */}
        <div className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 print:hidden">
          <div className="flex items-start sm:items-center gap-2 text-slate-600">
            <span className="text-blue-600 font-bold shrink-0">💡 Tip:</span>
            <p className="text-xs leading-relaxed text-slate-600">
              Pilih opsi <span className="font-semibold text-slate-800">"None / Tidak Ada"</span> pada margin browser di jendela print untuk hasil cetak stiker yang rapi.
            </p>
          </div>
          <span className="text-slate-400 font-mono text-[11px] shrink-0 self-end sm:self-auto">
            {items.length} label ditampilkan
          </span>
        </div>
      </div>
    </div>
  );
}
