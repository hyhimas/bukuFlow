"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LoadingState from "@/components/ui/LoadingState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useSubmitHotkey } from "@/hooks/useHotkeys";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canAccessCompanySettings } from "@/lib/authorization";
import {
  getCompanySettingsApi,
  updateCompanySettingsApi,
  getErrorMessage,
} from "@/lib/api";

export default function CompanySettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [companyId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getSession()?.user?.companyId || "";
  });
  const [isInitialConfig, setIsInitialConfig] = useState(false);

  // Form State - 3 Kebijakan Sirkulasi Backend (/bukuflow/company/config)
  const [defaultLoanDuration, setDefaultLoanDuration] = useState<number | string>("");
  const [maxActiveLoans, setMaxActiveLoans] = useState<number | string>("");
  const [dailyFineRate, setDailyFineRate] = useState<number | string>("");

  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (!canAccessCompanySettings(session.user.role)) {
      router.replace(session.user.role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard");
      return;
    }

    const currentCompId = session.user.companyId || "";

    if (!currentCompId && session?.user?.role !== "SUPER_ADMIN") {
      setErrorMessage("ID instansi tidak tersedia di sesi. Silakan login ulang.");
      setLoadError(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setLoadError(false);
      const settingsData = await getCompanySettingsApi(currentCompId);

      if (settingsData) {
        setDefaultLoanDuration(settingsData.defaultLoanDuration);
        setMaxActiveLoans(settingsData.maxActiveLoans);
        setDailyFineRate(settingsData.dailyFineRate ?? "");
        setIsInitialConfig(false);
      } else {
        setDefaultLoanDuration("");
        setMaxActiveLoans("");
        setDailyFineRate("");
        setIsInitialConfig(true);
      }
    } catch (err: unknown) {
      setLoadError(true);
      setErrorMessage(
        getErrorMessage(err, "Gagal memuat konfigurasi kebijakan peminjaman.")
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch konfigurasi kebijakan instansi saat mount
    void loadData();
  }, [loadData]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMessage("");

    const durationNum = Number(defaultLoanDuration);
    const maxLoansNum = Number(maxActiveLoans);
    const fineRateNum = Number(dailyFineRate);

    if (defaultLoanDuration === "" || isNaN(durationNum) || durationNum < 1) {
      setErrorMessage("Durasi peminjaman minimal 1 hari.");
      return;
    }

    if (maxActiveLoans === "" || isNaN(maxLoansNum) || maxLoansNum < 1) {
      setErrorMessage("Batas maksimal transaksi aktif minimal 1 transaksi.");
      return;
    }

    if (dailyFineRate === "" || isNaN(fineRateNum) || fineRateNum < 0) {
      setErrorMessage("Tarif denda keterlambatan tidak boleh negatif.");
      return;
    }

    try {
      setSaving(true);
      await updateCompanySettingsApi(companyId, {
        defaultLoanDuration: durationNum,
        maxActiveLoans: maxLoansNum,
        dailyFineRate: fineRateNum,
      });

      toast.success("Konfigurasi kebijakan perpustakaan berhasil disimpan.");
      setIsInitialConfig(false);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, "Gagal menyimpan konfigurasi kebijakan."));
    } finally {
      setSaving(false);
    }
  };

  useSubmitHotkey(() => void handleSubmit(), {
    enabled: !loading && !saving,
    loading: saving,
  });

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-6">
        {/* Header */}
        <div className="mb-6">
          <PageHeader
            backLink="/dashboard"
            title="Konfigurasi Kebijakan Perpustakaan"
            description="Atur batas durasi peminjaman standar, kuota maksimal buku aktif, dan tarif denda harian."
            actions={
              <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                ID Instansi: {companyId || "-"}
              </span>
            }
          />
        </div>

        {loadError ? (
          <div className="mt-6">
            <ErrorState
              title="Gagal Memuat Konfigurasi"
              message={errorMessage}
              onRetry={() => void loadData()}
              retryLabel="Coba Lagi"
            />
          </div>
        ) : loading ? (
          <Card className="mt-6 p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        ) : (
          <>
            {/* Feedback Alerts */}
            {isInitialConfig && !errorMessage && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-blue-900">
                <p className="font-semibold text-sm flex items-center gap-1.5"><svg className="h-4 w-4 text-amber-600 shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Konfigurasi Belum Dikonfigurasi</p>
                <p className="mt-1 text-xs text-blue-700">
                  Instansi ini belum memiliki data kebijakan peminjaman. Isi setiap kolom kebijakan, lalu klik <strong>&ldquo;Inisialisasi & Simpan Konfigurasi&rdquo;</strong> untuk menyimpannya.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="mt-4">
                <FeedbackPanel tone="error">
                  <p className="font-medium">{errorMessage}</p>
                </FeedbackPanel>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Form Identitas & Kebijakan (lg:col-span-7 xl:col-span-8) */}
                <div className="space-y-6 lg:col-span-7 xl:col-span-8">
                  {/* Kebijakan Sirkulasi & Peminjaman (3 Field Backend) */}
                  <Card className="p-5 sm:p-6">
                    <div className="border-b border-border-subtle pb-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-text-main">
                            Kebijakan Sirkulasi Peminjaman & Denda
                          </h2>
                          <p className="text-xs text-text-muted">
                            Parameter operasional peminjaman otomatis yang berlaku untuk seluruh anggota.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Input
                            id="loan-duration"
                            type="number"
                            min="1"
                            max="90"
                            label="Durasi Peminjaman Standar (Hari) *"
                            value={defaultLoanDuration}
                            onChange={(e) => setDefaultLoanDuration(e.target.value === "" ? "" : Number(e.target.value))}
                            onBlur={() => {
                              if (!isInitialConfig && (defaultLoanDuration === "" || Number(defaultLoanDuration) < 1)) {
                                setDefaultLoanDuration(1);
                              }
                            }}
                            helperText="Lama waktu standar peminjaman buku sebelum jatuh tempo."
                            required
                          />
                        </div>

                        <div>
                          <Input
                            id="max-active-loans"
                            type="number"
                            min="1"
                            max="50"
                            label="Maksimal Transaksi Aktif *"
                            value={maxActiveLoans}
                            onChange={(e) => setMaxActiveLoans(e.target.value === "" ? "" : Number(e.target.value))}
                            onBlur={() => {
                              if (!isInitialConfig && (maxActiveLoans === "" || Number(maxActiveLoans) < 1)) {
                                setMaxActiveLoans(1);
                              }
                            }}
                            helperText="Batas maksimal transaksi peminjaman aktif per anggota."
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Input
                          id="fine-rate"
                          type="number"
                          min="0"
                          step="500"
                          label="Tarif Denda Harian (Rp per Buku / Hari) *"
                          value={dailyFineRate}
                          onChange={(e) => setDailyFineRate(e.target.value === "" ? "" : Number(e.target.value))}
                          onBlur={() => {
                            if (!isInitialConfig && (dailyFineRate === "" || Number(dailyFineRate) < 0)) {
                              setDailyFineRate(0);
                            }
                          }}
                          helperText="Besaran denda harian per buku bila terlambat dikembalikan."
                          required
                        />
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column: Ringkasan Kebijakan & Action Buttons (lg:col-span-5 xl:col-span-4) */}
                <div className="space-y-4 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
                  {/* Section 3: Ringkasan Kebijakan Aktif */}
                  <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-5 shadow-xs">
                    <div className="flex items-center gap-2 text-blue-950 font-semibold text-sm mb-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 shrink-0" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <h3 className="truncate">Ringkasan Aturan Operasional</h3>
                    </div>

                    <div className="space-y-2.5 text-xs sm:text-sm text-blue-900">
                      <div className="flex items-start gap-2.5 rounded-lg bg-surface/90 p-2.5 border border-blue-100 shadow-2xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          1
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-text-muted font-medium">Durasi Peminjaman</p>
                          <p className="font-semibold text-text-main">
                            {defaultLoanDuration !== "" ? `${defaultLoanDuration} hari kalender` : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 rounded-lg bg-surface/90 p-2.5 border border-blue-100 shadow-2xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          2
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-text-muted font-medium">Batas Transaksi Aktif</p>
                          <p className="font-semibold text-text-main">
                            {maxActiveLoans !== "" ? `Maks. ${maxActiveLoans} transaksi bersamaan` : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 rounded-lg bg-surface/90 p-2.5 border border-blue-100 shadow-2xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          3
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-text-muted font-medium">Denda Keterlambatan</p>
                          <p className="font-semibold text-text-main">
                            {dailyFineRate !== ""
                              ? `Rp ${Number(dailyFineRate).toLocaleString("id-ID")} / buku / hari`
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3.5 text-[11px] text-blue-700/90 leading-relaxed border-t border-blue-200/60 pt-2.5">
                      Aturan di atas diterapkan otomatis oleh sistem pada peminjaman baru dan penghitungan denda pengembalian.
                    </p>
                  </div>

                  {/* Action Buttons Card */}
                  <Card className="p-4">
                    <div className="flex flex-col gap-2.5">
                      <Button
                        type="submit"
                        loading={saving}
                        disabled={saving}
                        aria-keyshortcuts="Control+Enter Meta+Enter"
                        className="w-full"
                      >
                        {isInitialConfig ? "Inisialisasi & Simpan Konfigurasi" : "Simpan Konfigurasi"}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => router.push("/dashboard")}
                        disabled={saving}
                        className="w-full"
                      >
                        Kembali ke Dashboard
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
