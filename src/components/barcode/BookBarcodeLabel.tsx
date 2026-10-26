"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export interface BookBarcodeLabelProps {
  type?: "book" | "member";
  companyName?: string;
  // Book specific
  bookTitle?: string;
  bookCode?: string;
  copyCode?: string;
  category?: string;
  // Member specific
  memberName?: string;
  memberNumber?: string;
  memberType?: string;
  // Options
  format?: "barcode" | "qrcode" | "both";
  size?: "sm" | "md" | "lg";
}

export default function BookBarcodeLabel({
  type = "book",
  companyName = "Perpustakaan",
  bookTitle = "Judul Buku",
  bookCode = "",
  copyCode = "",
  category = "Umum",
  memberName = "Nama Anggota",
  memberNumber = "",
  memberType = "Umum",
  format = "both",
  size = "md",
}: BookBarcodeLabelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const cleanCode = (
    type === "member"
      ? (memberNumber || "")
      : (copyCode || bookCode || "")
  ).trim();

  // Generate 1D Barcode (Code 128) synchronously via useMemo
  const barcodeDataUrl = useMemo(() => {
    if (!cleanCode || typeof window === "undefined" || (format !== "barcode" && format !== "both")) {
      return "";
    }
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, cleanCode, {
        format: "CODE128",
        width: size === "sm" ? 1.6 : size === "md" ? 2.0 : 2.5,
        height: size === "sm" ? 38 : size === "md" ? 48 : 58,
        displayValue: false,
        margin: 4,
        background: "#ffffff",
        lineColor: "#000000",
      });
      return canvas.toDataURL("image/png");
    } catch (err) {
      console.error("Failed to render barcode:", err);
      return "";
    }
  }, [cleanCode, format, size]);

  // Generate 2D QR Code as static PNG Data URL
  useEffect(() => {
    let isCurrent = true;
    if (!cleanCode) {
      return;
    }
    if (format === "qrcode" || format === "both") {
      void QRCode.toDataURL(cleanCode, {
        width: size === "sm" ? 64 : size === "md" ? 80 : 100,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
        .then((url) => {
          if (isCurrent) setQrDataUrl(url);
        })
        .catch((err) => {
          console.error("Failed to render QR:", err);
        });
    }
    return () => {
      isCurrent = false;
    };
  }, [cleanCode, format, size]);

  return (
    <div
      className={`barcode-sticker-card relative flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-2.5 sm:p-3 text-slate-900 shadow-xs print:border-slate-800 print:shadow-none ${
        size === "sm"
          ? "w-[240px] text-[10px]"
          : size === "lg"
          ? "w-[330px] text-xs"
          : "w-[275px] text-[11px]"
      }`}
      style={{
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* Header Instansi */}
      <div className="border-b border-slate-200 pb-1 text-center font-bold tracking-wider text-slate-800 uppercase">
        <p className="truncate text-[10px] sm:text-[11px] font-extrabold">{companyName}</p>
        <p className="text-[9px] font-medium text-slate-500">
          {type === "member" ? "KARTU ANGGOTA PERPUSTAKAAN" : "PERPUSTAKAAN DIGITAL"}
        </p>
      </div>

      {/* Meta Info */}
      {type === "member" ? (
        <div className="my-1.5 space-y-0.5 text-center">
          <p className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">{memberName}</p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono">
            <span>No: <strong className="text-slate-800 font-semibold">{cleanCode}</strong></span>
            <span className="text-slate-300 select-none" aria-hidden="true">&bull;</span>
            <span>Tipe: <strong className="text-slate-800 font-semibold">{memberType}</strong></span>
          </div>
        </div>
      ) : (
        <div className="my-1 space-y-0.5 text-center">
          <p className="font-bold text-slate-900 line-clamp-1">{bookTitle}</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Kategori: <span className="font-semibold text-slate-700">{category}</span>
          </p>
        </div>
      )}

      {/* Barcode & QR Display (Reliable image rendering across all print pages) */}
      <div className="my-1 flex items-center justify-center gap-2">
        {/* 1D Barcode */}
        {(format === "barcode" || format === "both") && barcodeDataUrl && (
          <div className="flex flex-col items-center">
            <img
              src={barcodeDataUrl}
              alt={`Barcode ${cleanCode}`}
              className="max-h-12 sm:max-h-14 object-contain"
            />
            <span className="mt-0.5 font-mono text-[10px] font-bold tracking-widest text-slate-900">
              {cleanCode}
            </span>
          </div>
        )}

        {/* 2D QR Code */}
        {(format === "qrcode" || (format === "both" && qrDataUrl)) && (
          <div className="shrink-0">
            <img
              src={qrDataUrl}
              alt={`QR ${cleanCode}`}
              className={`rounded border border-slate-100 ${
                size === "sm" ? "h-11 w-11" : size === "lg" ? "h-16 w-16" : "h-13 w-13"
              }`}
            />
          </div>
        )}
      </div>

      {/* Footer Label */}
      <div className="border-t border-slate-100 pt-1 text-center text-[9px] font-mono text-slate-500">
        BukuFlow Integrated Library System
      </div>
    </div>
  );
}
