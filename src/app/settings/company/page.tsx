"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import LoadingState from "@/components/ui/LoadingState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";

import { getSession } from "@/lib/auth";
import { canAccessCompanySettings } from "@/lib/authorization";
import {
  getCompanyDetailApi,
  getCompanySettingsApi,
  updateCompanyApi,
  updateCompanySettingsApi,
} from "@/lib/api";
import type { Company, CompanySettings } from "@/lib/types";

export default function CompanySettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [companyId, setCompanyId] = useState<string>("company-001");
  const [company, setCompany] = useState<Company | null>(null);

  // Form State - Company Identity
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");

  // Form State - Policies
  const [defaultLoanDuration, setDefaultLoanDuration] = useState<number>(7);
  const [maxActiveLoans, setMaxActiveLoans] = useState<number>(3);
  const [dailyFineRate, setDailyFineRate] = useState<number>(1000);
  const [allowRenewal, setAllowRenewal] = useState<boolean>(true);
  const [maxRenewals, setMaxRenewals] = useState<number>(1);

  useEffect(() => {
    const session = getSession();

    if (!session || !canAccessCompanySettings(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    const currentCompId = session.user.companyId || "company-001";
    setCompanyId(currentCompId);

    async function loadData() {
      try {
        setLoading(true);
        const [compData, settingsData] = await Promise.all([
          getCompanyDetailApi(currentCompId).catch(() => null),
          getCompanySettingsApi(currentCompId).catch(() => null),
        ]);

        if (compData) {
          setCompany(compData);
          setName(compData.name || "");
          setCode(compData.code || "");
          setAddress(compData.address || "");
          setTimezone(compData.timezone || "Asia/Jakarta");
        }

        if (settingsData) {
          setDefaultLoanDuration(settingsData.defaultLoanDuration ?? 7);
          setMaxActiveLoans(settingsData.maxActiveLoans ?? 3);
          setDailyFineRate(settingsData.dailyFineRate ?? 1000);
          setAllowRenewal(settingsData.allowRenewal ?? true);
          setMaxRenewals(settingsData.maxRenewals ?? 1);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Gagal memuat konfigurasi instansi.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Nama instansi/perpustakaan tidak boleh kosong.");
      return;
    }

    if (defaultLoanDuration < 1) {
      setErrorMessage("Durasi peminjaman minimal 1 hari.");
      return;
    }

    if (maxActiveLoans < 1) {
      setErrorMessage("Batas maksimal peminjaman minimal 1 buku.");
      return;
    }

    try {
      setSaving(true);

      // 1. Update Company Profile
      await updateCompanyApi(companyId, {
        name: name.trim(),
        address: address.trim(),
        timezone,
      });

      // 2. Update Policies & Settings
      await updateCompanySettingsApi(companyId, {
        defaultLoanDuration: Number(defaultLoanDuration),
        maxActiveLoans: Number(maxActiveLoans),
        dailyFineRate: Number(dailyFineRate),
        allowRenewal,
        maxRenewals: allowRenewal ? Number(maxRenewals) : 0,
        timezone,
      });

      setSuccessMessage("Konfigurasi instansi dan kebijakan perpustakaan berhasil disimpan!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat konfigurasi instansi..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-6">
        <BackLink href="/dashboard" />

        {/* Header */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Konfigurasi Instansi & Kebijakan
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Atur identitas perpustakaan, batas durasi peminjaman, kuota buku, dan ketentuan denda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
              Instansi: {code || companyId}
            </span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {successMessage && (
          <div className="mt-4">
            <FeedbackPanel tone="success">
              <p className="font-medium">{successMessage}</p>
            </FeedbackPanel>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4">
            <FeedbackPanel tone="error">
              <p className="font-medium">{errorMessage}</p>
            </FeedbackPanel>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Section 1: Profil Instansi */}
          <Card className="p-6">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20V5l8-2v17M12 20h8V8l-8-3" />
                    <path d="M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Informasi & Identitas Perpustakaan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi umum instansi atau unit perpustakaan Anda.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Input
                  id="comp-name"
                  label="Nama Perpustakaan / Instansi *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Perpustakaan SMAN 1 Surakarta"
                  required
                />
              </div>

              <div>
                <Input
                  id="comp-code"
                  label="Kode Unik Instansi"
                  value={code}
                  disabled
                  helperText="Kode instansi diberikan oleh Super Admin platform."
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  id="comp-address"
                  label="Alamat Lengkap Perpustakaan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Slamet Riyadi No. 123, Surakarta, Jawa Tengah"
                  helperText="Alamat akan dicantumkan pada slip peminjaman dan bukti transaksi."
                />
              </div>

              <div>
                <Dropdown
                  id="comp-timezone"
                  label="Zona Waktu Operasional"
                  value={timezone}
                  onChange={(val) => setTimezone(val)}
                  helperText="Digunakan untuk perhitungan batas jatuh tempo transaksi."
                  options={[
                    { value: "Asia/Jakarta", label: "WIB - Asia/Jakarta (UTC+7)" },
                    { value: "Asia/Makassar", label: "WITA - Asia/Makassar (UTC+8)" },
                    { value: "Asia/Jayapura", label: "WIT - Asia/Jayapura (UTC+9)" },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Kebijakan Sirkulasi & Peminjaman */}
          <Card className="p-6">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Ketentuan Peminjaman & Denda
                  </h2>
                  <p className="text-xs text-slate-500">
                    Aturan sirkulasi otomatis yang berlaku untuk seluruh anggota di instansi ini.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Input
                  id="loan-duration"
                  type="number"
                  min="1"
                  max="90"
                  label="Durasi Peminjaman Default (Hari) *"
                  value={defaultLoanDuration}
                  onChange={(e) => setDefaultLoanDuration(Math.max(1, Number(e.target.value)))}
                  helperText="Lama waktu standar anggota boleh meminjam buku sebelum jatuh tempo."
                  required
                />
              </div>

              <div>
                <Input
                  id="max-books"
                  type="number"
                  min="1"
                  max="20"
                  label="Maksimal Buku Dipinjam per Anggota *"
                  value={maxActiveLoans}
                  onChange={(e) => setMaxActiveLoans(Math.max(1, Number(e.target.value)))}
                  helperText="Batas maksimal total buku aktif yang dapat dipinjam secara bersamaan."
                  required
                />
              </div>

              <div>
                <Input
                  id="fine-rate"
                  type="number"
                  min="0"
                  step="500"
                  label="Tarif Denda Keterlambatan (Rp per Buku / Hari) *"
                  value={dailyFineRate}
                  onChange={(e) => setDailyFineRate(Math.max(0, Number(e.target.value)))}
                  helperText="Besaran denda yang dihitung harian untuk setiap buku yang terlambat."
                  required
                />
              </div>

              <div>
                <Input
                  id="max-renewals"
                  type="number"
                  min="0"
                  max="5"
                  label="Batas Maksimal Perpanjangan (Kali)"
                  disabled={!allowRenewal}
                  value={allowRenewal ? maxRenewals : 0}
                  onChange={(e) => setMaxRenewals(Math.max(0, Number(e.target.value)))}
                  helperText={
                    allowRenewal
                      ? "Frekuensi perpanjangan transaksi yang diizinkan untuk setiap buku."
                      : "Fitur perpanjangan dinonaktifkan."
                  }
                />
              </div>

              {/* Toggle Perpanjangan */}
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowRenewal}
                    onChange={(e) => setAllowRenewal(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 block">
                      Izinkan Perpanjangan Masa Pinjam (Renewal)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Jika diaktifkan, staf dapat memperpanjang masa jatuh tempo buku sebelum statusnya terlambat.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </Card>

          {/* Section 3: Ringkasan Kebijakan Aktif */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
            <h3 className="text-sm font-semibold text-blue-950">
              Ringkasan Ketentuan Perpustakaan Aktif:
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-xs sm:text-sm text-blue-900 list-disc list-inside">
              <li>
                Setiap anggota dapat meminjam maksimal <strong>{maxActiveLoans} buku</strong> dalam satu waktu.
              </li>
              <li>
                Durasi pinjam standar adalah <strong>{defaultLoanDuration} hari</strong> kalender.
              </li>
              <li>
                Denda keterlambatan sebesar{" "}
                <strong>
                  Rp {dailyFineRate.toLocaleString("id-ID")}
                </strong>{" "}
                per buku per hari keterlambatan.
              </li>
              <li>
                Perpanjangan buku:{" "}
                <strong>
                  {allowRenewal
                    ? `Diizinkan (maks. ${maxRenewals} kali perpanjangan)`
                    : "Tidak diizinkan"}
                </strong>
                .
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashboard")}
              disabled={saving}
            >
              Kembali ke Dashboard
            </Button>
            <Button type="submit" loading={saving}>
              Simpan Konfigurasi
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
