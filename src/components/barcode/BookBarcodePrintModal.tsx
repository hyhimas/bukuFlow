"use client";

import { useEffect, useState } from "react";
import BookBarcodeLabel from "./BookBarcodeLabel";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Modal from "@/components/ui/Modal";

export interface PrintableBookItem {
  type?: "book" | "member";
  bookTitle?: string;
  bookCode?: string;
  copyCode?: string;
  category?: string;
  memberName?: string;
  memberNumber?: string;
  memberType?: string;
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
  companyName = "Perpustakaan",
}: BookBarcodePrintModalProps) {
  const [format, setFormat] = useState<"barcode" | "qrcode" | "both">("both");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [deselectedIndices, setDeselectedIndices] = useState<Set<number>>(new Set());

  const gridCols = size === "sm" ? 3 : size === "lg" ? 1 : 2;
  const isAllSelected = deselectedIndices.size === 0;
  const selectedCount = Math.max(0, items.length - deselectedIndices.size);

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

    // Clone and strip unselected / hidden items before printing
    const printClone = printArea.cloneNode(true) as HTMLElement;
    printClone.querySelectorAll(".print-hidden, .print\\:hidden").forEach((el) => el.remove());
    printClone.querySelectorAll("[data-unselected='true']").forEach((el) => el.remove());

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
              grid-template-columns: repeat(${gridCols}, minmax(0, 1fr)) !important;
              gap: ${size === "sm" ? "4mm 3mm" : size === "lg" ? "8mm 6mm" : "6mm 4mm"} !important;
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
              max-width: ${size === "sm" ? "70mm" : size === "lg" ? "140mm" : "95mm"} !important;
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
            ${printClone.innerHTML}
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
        console.error("Iframe print error:", err);
        window.print();
      }
    }, 250);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      raw
      size="full"
      className="barcode-print-container relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200"
      ariaLabelledBy="barcode-print-modal-title"
    >
      {/* Global CSS for Print Output (Ctrl+P / window.print) */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm !important;
          }
          header, nav, aside, footer, [data-sidebar], .print\:hidden {
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
            grid-template-columns: repeat(${gridCols}, minmax(0, 1fr)) !important;
            gap: ${size === "sm" ? "4mm 3mm" : size === "lg" ? "8mm 6mm" : "6mm 4mm"} !important;
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
            max-width: ${size === "sm" ? "70mm" : size === "lg" ? "140mm" : "95mm"} !important;
            margin: 0 auto !important;
            border: 1px solid #334155 !important;
            border-radius: 6px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Container contents */}
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden">
        {/* Header (No Print) */}
        <div className="border-b border-slate-200 bg-white print:hidden">
          {/* Top title & close bar */}
          <div className="flex items-start justify-between gap-2.5 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 mt-0.5 sm:mt-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="sm:h-5 sm:w-5"
                  aria-hidden="true"
                >
                  <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="barcode-print-modal-title"
                  className="text-sm sm:text-base md:text-lg font-bold text-slate-900 leading-snug break-words"
                >
                  {title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed break-words">
                  {selectedCount} dari {items.length} label dipilih untuk dicetak pada kertas stiker / HVS A4
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 mt-0.5 sm:mt-0"
              title="Tutup Modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Select all checkbox */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={isAllSelected && items.length > 0}
                  onChange={() => {
                    if (isAllSelected) {
                      setDeselectedIndices(new Set(items.map((_, i) => i)));
                    } else {
                      setDeselectedIndices(new Set());
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Pilih Semua ({selectedCount}/{items.length})</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs min-w-[170px]">
                <span className="font-semibold text-slate-600 shrink-0">Format:</span>
                <Dropdown
                  value={format}
                  size="sm"
                  onChange={(val) => setFormat(val as "barcode" | "qrcode" | "both")}
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
                  onChange={(val) => setSize(val as "sm" | "md" | "lg")}
                  className="flex-1"
                  options={[
                    { value: "sm", label: "Kecil (3 Kolom)" },
                    { value: "md", label: "Sedang (2 Kolom)" },
                    { value: "lg", label: "Besar (1 Kolom)" },
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
                disabled={selectedCount === 0}
                className="flex-1 sm:flex-initial text-xs px-4 py-1.5 h-8 font-bold shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                <span>Cetak ({selectedCount})</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Printable Area */}
        <div className="barcode-print-body flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 print:bg-white print:p-0 print:overflow-visible">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Tidak ada label untuk dicetak.
            </div>
          ) : (
            <div
              id="printable-barcode-sheet"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gap: size === "sm" ? "12px" : size === "lg" ? "20px" : "16px",
              }}
              className="mx-auto w-full max-w-5xl justify-center bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs print:m-0 print:p-0 print:border-0 print:shadow-none print:gap-2 print:justify-start"
            >
              {items.map((item, index) => {
                const isSelected = !deselectedIndices.has(index);
                return (
                  <div
                    key={`${item.copyCode || item.memberNumber || index}-${index}`}
                    data-unselected={!isSelected ? "true" : undefined}
                    className={`break-inside-avoid relative flex justify-center transition-all ${
                      !isSelected ? "print:hidden opacity-35 grayscale" : "opacity-100"
                    }`}
                  >
                    <label
                      className="print:hidden absolute top-2 right-2 z-10 flex items-center justify-center h-6 w-6 rounded-md bg-white/95 border border-slate-300 shadow-2xs hover:bg-slate-100 cursor-pointer"
                      title={isSelected ? "Batal pilih item ini" : "Pilih item ini untuk dicetak"}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const next = new Set(deselectedIndices);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          setDeselectedIndices(next);
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>

                    <BookBarcodeLabel
                      type={item.type || "book"}
                      companyName={companyName}
                      bookTitle={item.bookTitle}
                      bookCode={item.bookCode}
                      copyCode={item.copyCode}
                      category={item.category}
                      memberName={item.memberName}
                      memberNumber={item.memberNumber}
                      memberType={item.memberType}
                      format={format}
                      size={size}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info (No Print) */}
        <div className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 print:hidden">
          <div className="flex items-start sm:items-center gap-2 text-slate-600">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-600 shrink-0 mt-0.5 sm:mt-0"
              aria-hidden="true"
            >
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              <path d="M9 16a5 5 0 1 1 6 0 3.5 3.5 0 0 0-1 3 2 2 0 0 1-4 0 3.5 3.5 0 0 0-1-3" />
              <line x1="9" y1="22" x2="15" y2="22" />
            </svg>
            <p className="text-xs leading-relaxed text-slate-600">
              Pilih opsi <span className="font-semibold text-slate-800">&quot;None / Tidak Ada&quot;</span> pada margin browser di jendela print untuk hasil cetak stiker yang rapi.
            </p>
          </div>
          <span className="text-slate-500 font-mono text-xs shrink-0 self-end sm:self-auto font-medium">
            {selectedCount} dari {items.length} label terpilih
          </span>
        </div>
      </div>
    </Modal>
  );
}
