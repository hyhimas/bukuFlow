import * as XLSX from "xlsx";

export type ExportPeriod =
  | "ALL"
  | "7_DAYS"
  | "1_MONTH"
  | "1_YEAR"
  | "CUSTOM";

export interface ExportDateRange {
  startDate: string;
  endDate: string;
}

export function getExportDateRange(
  period: ExportPeriod,
  customStartDate = "",
  customEndDate = "",
): ExportDateRange {
  const today = new Date();

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const endDate = formatDate(today);

  if (period === "ALL") {
    return {
      startDate: "",
      endDate: "",
    };
  }

  if (period === "CUSTOM") {
    return {
      startDate: customStartDate,
      endDate: customEndDate,
    };
  }

  const start = new Date(today);

  if (period === "7_DAYS") {
    start.setDate(start.getDate() - 7);
  }

  if (period === "1_MONTH") {
    start.setMonth(start.getMonth() - 1);
  }

  if (period === "1_YEAR") {
    start.setFullYear(start.getFullYear() - 1);
  }

  return {
    startDate: formatDate(start),
    endDate,
  };
}

export function filterByExportDate<T>(
  data: T[],
  getDate: (item: T) => string,
  period: ExportPeriod,
  customStartDate = "",
  customEndDate = "",
) {
  const { startDate, endDate } = getExportDateRange(
    period,
    customStartDate,
    customEndDate,
  );

  if (period === "ALL") {
    return data;
  }

  return data.filter((item) => {
    const date = getDate(item);

    if (!date) {
      return false;
    }

    if (startDate !== "" && date < startDate) {
      return false;
    }

    if (endDate !== "" && date > endDate) {
      return false;
    }

    return true;
  });
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName = "Data",
) {
  if (data.length === 0) {
    throw new Error("Tidak ada data untuk diekspor.");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    sheetName,
  );

  const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      XLSX.writeFile(workbook, cleanFilename);
    } catch {
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", cleanFilename);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);
    }
  } else {
    XLSX.writeFile(workbook, cleanFilename);
  }
}