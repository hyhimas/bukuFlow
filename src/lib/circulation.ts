import type { Loan, ReturnLoanItem, TransactionData, TransactionLoanItem } from "./types";

/**
 * ============================================================================
 * CATATAN IMPLEMENTASI SEMENTARA (TEMPORARY FRONTEND FINE CALCULATION):
 * ----------------------------------------------------------------------------
 * Logika perhitungan denda keterlambatan per eksemplar di modul ini merupakan
 * implementasi sementara di sisi frontend (FE), dikarenakan endpoint backend (BE)
 * belum menyediakan kalkulasi denda per eksemplar maupun penyimpanan denda
 * historis secara permanen pada dokumen transaksi.
 *
 * ATURAN BISNIS & KETENTUAN SINKRONISASI:
 * 1. Tarif denda WAJIB diambil dari konfigurasi Settings Company (dailyFineRate
 *    dari GET /company/config via getCompanySettingsApi), TIDAK BOLEH di-hardcode
 *    ke nilai tertentu (misal Rp1.000).
 * 2. Ketika tarif di Settings Company diubah dan disimpan, tabel dan detail
 *    transaksi harus segera menghitung ulang denda dengan tarif terbaru.
 * 3. Denda dihitung per eksemplar:
 *    - Jatuh tempo dihitung dari loan.dueAt.
 *    - Eksemplar yang sudah kembali dibekukan dendanya menggunakan returnedAt aktual.
 *    - Eksemplar yang masih dipinjam (BORROWED) dihitung hingga tanggal acuan saat ini.
 *    - Denda mulai dihitung 1 hari setelah jatuh tempo:
 *      compareDate <= dueDate -> 0 hari terlambat (Rp 0).
 *      compareDate > dueDate  -> (compareDate - dueDate) dalam hari * tarif.
 * 4. Pemisahan Status Transaksi & Denda:
 *    - COMPLETED: seluruh eksemplar telah dikembalikan (TIDAK BOLEH berstatus Terlambat
 *      hanya karena melewati jatuh tempo; statusnya harus Selesai, denda tampil terpisah).
 *    - OVERDUE: transaksi masih memiliki eksemplar yang dipinjam dan telah melewati jatuh tempo.
 *    - ACTIVE: transaksi masih berjalan dan belum melewati jatuh tempo.
 *    - Jika sebagian buku sudah kembali tetapi masih ada yang dipinjam, transaksi
 *      belum boleh berstatus COMPLETED.
 * 5. Penanganan Nilai Belum Tersedia:
 *    - Jika tarif denda null/undefined, fineAmount dan totalFine bernilai null ("Menunggu konfigurasi").
 *      Jangan diam-diam menggunakan tarif default yang dapat menghasilkan denda keliru.
 * 6. Dilarang mengirim nilai denda palsu/buatan ke BE jika kontrak API belum mendukungnya.
 * 7. Apabila BE telah merilis endpoint kalkulasi dan persistensi denda resmi,
 *    implementasi FE ini wajib diselaraskan dengan kontrak BE tersebut.
 * ============================================================================
 */

export interface ExemplarFineDetail {
  id: string;
  copyCode: string;
  bookTitle: string;
  status: "BORROWED" | "RETURNED";
  returnedAt?: string;
  daysOverdue: number;
  fineAmount: number | null;
}

export interface CirculationFineCalculation {
  totalFine: number | null;
  dailyRate: number | null;
  maxDaysOverdue: number;
  items: ExemplarFineDetail[];
  overallStatus: "ACTIVE" | "OVERDUE" | "COMPLETED";
}

/**
 * Menghitung hari keterlambatan antara tanggal jatuh tempo dan tanggal acuan (tanggal pengembalian atau hari ini).
 * Denda mulai dihitung 1 hari setelah jatuh tempo:
 * compareDate <= dueDate -> 0 hari terlambat
 * compareDate > dueDate  -> (compareDate - dueDate) dalam hari
 */
export function calculateOverdueDays(dueAtStr?: string, compareDateStr?: string): number {
  if (!dueAtStr || !compareDateStr) return 0;
  const dueDate = new Date(`${dueAtStr.slice(0, 10)}T00:00:00`);
  const compareDate = new Date(`${compareDateStr.slice(0, 10)}T00:00:00`);
  if (isNaN(dueDate.getTime()) || isNaN(compareDate.getTime())) return 0;
  if (compareDate <= dueDate) return 0;
  const diffTime = compareDate.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Menghitung denda per eksemplar dan menentukan status transaksi secara konsisten
 * untuk dipakai bersama oleh tabel dan detail transaksi:
 * - ACTIVE: transaksi masih berjalan dan belum melewati jatuh tempo
 * - OVERDUE: masih ada eksemplar yang belum dikembalikan dan sudah melewati jatuh tempo
 * - COMPLETED: seluruh eksemplar dalam transaksi telah dikembalikan (selalu berstatus Selesai)
 */
export function calculateTransactionCirculation(
  loan: Pick<Loan, "dueAt"> & Partial<Pick<Loan, "status" | "returnedAt">>,
  items: Array<{
    loanItem: { id: string; status: "BORROWED" | "RETURNED"; returnedAt?: string; fineAmount?: number };
    book: { title: string };
    bookCopy: { code: string };
  }>,
  dailyRate: number | null,
  referenceDateStr?: string
): CirculationFineCalculation {
  const today = referenceDateStr
    ? new Date(`${referenceDateStr.slice(0, 10)}T00:00:00`)
    : new Date();
  if (!referenceDateStr) {
    today.setHours(0, 0, 0, 0);
  }
  const todayStr =
    referenceDateStr ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const dueStr = loan.dueAt ? loan.dueAt.slice(0, 10) : "";
  const dueDate = dueStr ? new Date(`${dueStr}T00:00:00`) : new Date(NaN);
  const isPastDue = !isNaN(dueDate.getTime()) && today > dueDate;

  const itemDetails: ExemplarFineDetail[] = items.map((it) => {
    const isReturned = it.loanItem.status === "RETURNED" || Boolean(it.loanItem.returnedAt);
    const itemReferenceDateStr = isReturned
      ? it.loanItem.returnedAt
        ? it.loanItem.returnedAt.slice(0, 10)
        : todayStr
      : todayStr;

    const days = calculateOverdueDays(dueStr, itemReferenceDateStr);
    const hasSettledServerFine =
      isReturned && typeof it.loanItem.fineAmount === "number";
    const serverFine =
      hasSettledServerFine
        ? it.loanItem.fineAmount!
        : typeof it.loanItem.fineAmount === "number" && it.loanItem.fineAmount > 0
        ? it.loanItem.fineAmount
        : null;
    const fine =
      serverFine !== null
        ? serverFine
        : dailyRate !== null
        ? days * dailyRate
        : null;

    return {
      id: it.loanItem.id,
      copyCode: it.bookCopy?.code || "-",
      bookTitle: it.book?.title || "-",
      status: isReturned ? "RETURNED" : "BORROWED",
      returnedAt: it.loanItem.returnedAt,
      daysOverdue: days,
      fineAmount: fine,
    };
  });

  const hasBorrowed = itemDetails.some((it) => it.status === "BORROWED");
  const isCompleted =
    items.length > 0
      ? !hasBorrowed
      : loan.status === "COMPLETED" || Boolean(loan.returnedAt);

  let overallStatus: "ACTIVE" | "OVERDUE" | "COMPLETED";
  if (isCompleted) {
    overallStatus = "COMPLETED";
  } else if (isPastDue) {
    overallStatus = "OVERDUE";
  } else {
    overallStatus = "ACTIVE";
  }

  const maxDays = itemDetails.reduce((max, it) => Math.max(max, it.daysOverdue), 0);
  const canCalculateTotal =
    dailyRate !== null ||
    itemDetails.some((it) => typeof it.fineAmount === "number");
  const totalFine = canCalculateTotal
    ? itemDetails.reduce((sum, it) => sum + (it.fineAmount || 0), 0)
    : null;

  return {
    totalFine,
    dailyRate,
    maxDaysOverdue: maxDays,
    items: itemDetails,
    overallStatus,
  };
}

