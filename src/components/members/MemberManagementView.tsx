"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canAccessMasterData, canManageMasterData } from "@/lib/authorization";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import LoadingState from "@/components/ui/LoadingState";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import Pagination from "@/components/ui/Pagination";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import RowActions, { type RowActionItem } from "@/components/ui/RowActions";
import ErrorState from "@/components/ui/ErrorState";
import InactiveCompanyState, {
  isCompanyInactiveError,
  isStoredCompanyInactive,
} from "@/components/office/InactiveCompanyState";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { useSearchHotkey, useSubmitHotkey } from "@/hooks/useHotkeys";
import CompanySwitcher, {
  getStoredOfficeCompanyId,
  setStoredOfficeCompanyId,
} from "@/components/office/CompanySwitcher";

import type { Member, MemberStatus } from "@/lib/types";
import { masterDataRepository } from "@/lib/master-data/repository";
import {
  getOfficeMembersApi,
  createOfficeMemberApi,
  updateOfficeMemberApi,
  getOfficeMemberDetailApi,
  getCompaniesApi,
  getErrorMessage,
  getFieldErrors,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { exportToExcel } from "@/lib/export/excel";
import BookBarcodePrintModal, {
  type PrintableBookItem,
} from "@/components/barcode/BookBarcodePrintModal";

export interface MemberManagementViewProps {
  scope: "office" | "company";
}

type MemberFormErrors = {
  name: string;
  memberNumber: string;
  phone: string;
  identityNumber: string;
  email: string;
};

const EMPTY_MEMBER_ERRORS: MemberFormErrors = {
  name: "",
  memberNumber: "",
  phone: "",
  identityNumber: "",
  email: "",
};

function getStatusBadgeVariant(status: MemberStatus): "success" | "neutral" {
  return status === "ACTIVE" ? "success" : "neutral";
}

function getStatusLabel(status: MemberStatus): string {
  return status === "ACTIVE" ? "Aktif" : "Nonaktif";
}

function maskNik(nik?: string): string {
  if (!nik) return "-";
  const trimmed = nik.trim();
  if (trimmed.length <= 8) {
    return trimmed.length > 4
      ? `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`
      : "********";
  }
  return `${trimmed.slice(0, 4)}********${trimmed.slice(-4)}`;
}

function getInitial(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}

function formatDate(val?: string) {
  if (!val) return "-";
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? val
    : d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function CompanyEmptyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-7 w-7 text-blue-600"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

export default function MemberManagementView({ scope }: MemberManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const isOffice = scope === "office";

  // Auth & Permissions
  const [isAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const session = getSession();
    if (!session) return false;
    if (isOffice) return session.user.role === "SUPER_ADMIN";
    return canAccessMasterData(session.user.role);
  });

  // Selected company (for office scope)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    isOffice ? getStoredOfficeCompanyId() : ""
  );

  // Member state
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState(() => searchParams?.get("search") || "");

  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [email, setEmail] = useState("");
  const [formErrors, setFormErrors] = useState<MemberFormErrors>(EMPTY_MEMBER_ERRORS);
  const [formLoading, setFormLoading] = useState(false);

  // Detail State
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Status Confirm State
  const [confirmMember, setConfirmMember] = useState<Member | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<MemberStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Confirmation Dialog (Discard Form Changes)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Print Member Card State (Single & Bulk)
  const [companyName, setCompanyName] = useState(() => {
    if (typeof window === "undefined") return "Perpustakaan";
    const s = getSession();
    const u = s?.user as Record<string, unknown> | undefined;
    const c = u?.company as { name?: string } | undefined;
    return (
      (typeof u?.companyName === "string" ? u.companyName : undefined) ||
      (typeof c?.name === "string" ? c.name : undefined) ||
      "Perpustakaan"
    );
  });
  const [companyStatus, setCompanyStatus] = useState<string>("");

  const isInactiveCompany =
    isOffice &&
    (companyStatus === "INACTIVE" ||
      companyStatus === "SUSPENDED" ||
      isStoredCompanyInactive(selectedCompanyId) ||
      isCompanyInactiveError(error));
  const [bulkPrintModalOpen, setBulkPrintModalOpen] = useState(false);
  const [bulkPrintItems, setBulkPrintItems] = useState<PrintableBookItem[]>([]);
  const [bulkPrintTitle, setBulkPrintTitle] = useState("Cetak Kartu Anggota");
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);
  const [bulkPrintProgress, setBulkPrintProgress] = useState<{ current: number; total: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef, {
    enabled: !(isOffice && !selectedCompanyId) && !error && !loading,
  });
  useSubmitHotkey(() => void handleSubmit(), {
    enabled: showForm,
    loading: formLoading,
  });

  // 1. Auth Guard
  useEffect(() => {
    const session = getSession();
    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (isOffice) {
      if (session.user.role !== "SUPER_ADMIN") {
        router.replace("/dashboard");
        return;
      }
    } else {
      if (!canAccessMasterData(session.user.role)) {
        router.replace("/dashboard");
        return;
      }
    }
  }, [router, isOffice]);

  const canManage = isOffice
    ? true
    : canManageMasterData(getSession()?.user?.role ?? "MEMBER");

  // 2. Auto-select member from URL search params (e.g. from transaction history)
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!isAuthorized || hasAutoSelectedRef.current) return;

    const targetMemberId = searchParams?.get("memberId");
    if (!targetMemberId) return;

    hasAutoSelectedRef.current = true;

    if (isOffice && selectedCompanyId) {
      getOfficeMemberDetailApi(selectedCompanyId, targetMemberId)
        .then((res) => {
          if (res) setDetailMember(res);
        })
        .catch((err: unknown) => {
          toast.error(getErrorMessage(err, "Gagal memuat data anggota yang dipilih."));
        });
    } else if (!isOffice) {
      masterDataRepository
        .getMember(targetMemberId)
        .then((res) => {
          if (res) setDetailMember(res);
        })
        .catch((err: unknown) => {
          toast.error(getErrorMessage(err, "Gagal memuat data anggota yang dipilih."));
        });
    }
  }, [isAuthorized, isOffice, searchParams, selectedCompanyId]);

  // Sync company name for Office Super Admin
  useEffect(() => {
    if (!isOffice || !selectedCompanyId) return;
    let isMounted = true;
    getCompaniesApi()
      .then((comps) => {
        if (!isMounted) return;
        const match = comps.find((c) => c.id === selectedCompanyId);
        if (match?.name) {
          setCompanyName(match.name);
        }
        if (match?.status) {
          setCompanyStatus(match.status);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOffice, selectedCompanyId]);

  // 3. Load Members
  const loadMembers = useCallback(
    async (isBackground = false) => {
      if (!isAuthorized) return;
      if (isOffice && !selectedCompanyId) {
        setMembers([]);
        setLoading(false);
        setTableLoading(false);
        return;
      }

      if (isBackground) {
        setTableLoading(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        if (isOffice) {
          const res = await getOfficeMembersApi(selectedCompanyId, {
            page,
            size: pageSize,
            search: search.trim() || undefined,
            sortby: sortBy,
            order: sortOrder,
          });

          setMembers(res.items);
          if (res.total !== -1) {
            savedTotalRef.current = res.total;
            setTotal(res.total);
            setTotalPages(Math.max(1, Math.ceil(res.total / pageSize)));
          } else {
            setTotal(savedTotalRef.current);
            setTotalPages(Math.max(1, Math.ceil(savedTotalRef.current / pageSize)));
          }
        } else {
          const res = await masterDataRepository.listMembers({
            search: search.trim(),
            page,
            pageSize,
            sortby: sortBy,
            order: sortOrder,
          });

          setMembers(res.data);
          setTotal(res.total);
          setTotalPages(res.totalPages);
        }
      } catch (err: unknown) {
        const msg = getErrorMessage(err, "Gagal memuat data anggota.");
        setError(msg);
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    },
    [isAuthorized, isOffice, selectedCompanyId, page, pageSize, search, sortBy, sortOrder, toast]
  );

  // Trigger load with debounce on search
  useEffect(() => {
    if (!isAuthorized) return;
    if (isOffice && !selectedCompanyId) return;

    const timer = setTimeout(() => {
      void loadMembers(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [isAuthorized, isOffice, selectedCompanyId, page, pageSize, search, loadMembers]);

  // Form Handlers
  function openCreateForm() {
    setEditingMember(null);
    setMemberNumber("");
    setName("");
    setPhone("");
    setIdentityNumber("");
    setEmail("");
    setFormErrors(EMPTY_MEMBER_ERRORS);
    setShowForm(true);
  }

  function openEditForm(member: Member) {
    setEditingMember(member);
    setMemberNumber(member.memberNumber || "");
    setName(member.name || "");
    setPhone(member.phone || "");
    setIdentityNumber(member.identityNumber || "");
    setEmail(member.email || "");
    setFormErrors(EMPTY_MEMBER_ERRORS);
    setShowForm(true);
  }

  function isMemberFormDirty(): boolean {
    if (editingMember) {
      return (
        name.trim() !== (editingMember.name || "").trim() ||
        identityNumber.trim() !== (editingMember.identityNumber || "").trim() ||
        phone.trim() !== (editingMember.phone || "").trim() ||
        email.trim() !== (editingMember.email || "").trim()
      );
    }
    return (
      name.trim() !== "" ||
      memberNumber.trim() !== "" ||
      identityNumber.trim() !== "" ||
      phone.trim() !== "" ||
      email.trim() !== ""
    );
  }

  function handleRequestCloseForm() {
    if (formLoading) return;
    if (isMemberFormDirty()) {
      setShowDiscardConfirm(true);
      return;
    }
    closeForm();
  }

  function closeForm() {
    if (formLoading) return;
    setShowDiscardConfirm(false);
    setShowForm(false);
    setEditingMember(null);
    setFormErrors(EMPTY_MEMBER_ERRORS);
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();

    const cleanName = name.trim();
    const cleanNumber = memberNumber.trim();
    const cleanPhone = phone.trim();
    const cleanNik = identityNumber.trim();
    const cleanEmail = email.trim();

    const nextErrors: MemberFormErrors = {
      name: cleanName ? "" : "Nama wajib diisi.",
      memberNumber: "",
      phone: cleanPhone ? "" : "Nomor HP wajib diisi.",
      identityNumber: cleanNik ? "" : "NIK wajib diisi.",
      email: "",
    };

    if (
      nextErrors.name ||
      nextErrors.phone ||
      nextErrors.identityNumber
    ) {
      setFormErrors(nextErrors);
      return;
    }

    setFormLoading(true);
    setFormErrors(EMPTY_MEMBER_ERRORS);

    try {
      if (editingMember) {
        if (isOffice) {
          await updateOfficeMemberApi(selectedCompanyId, editingMember.id, {
            name: cleanName,
            member_number: editingMember.memberNumber,
            phone: cleanPhone,
            identity_number: cleanNik,
            email: cleanEmail || undefined,
            status: editingMember.status,
          });
        } else {
          await masterDataRepository.updateMember(editingMember.id, {
            name: cleanName,
            phone: cleanPhone,
            identityNumber: cleanNik,
            email: cleanEmail || undefined,
          });
        }
        toast.success("Data anggota berhasil diperbarui.");
      } else {
        if (isOffice) {
          await createOfficeMemberApi(selectedCompanyId, {
            name: cleanName,
            phone: cleanPhone,
            identity_number: cleanNik,
            email: cleanEmail || undefined,
          });
        } else {
          await masterDataRepository.createMember({
            name: cleanName,
            phone: cleanPhone,
            identityNumber: cleanNik,
            email: cleanEmail || undefined,
          });
        }
        toast.success("Anggota baru berhasil ditambahkan.");
      }

      closeForm();
      void loadMembers(false);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal menyimpan data anggota.");
      const fieldErrs = getFieldErrors(err);

      if (Object.keys(fieldErrs).length > 0) {
        if (fieldErrs.identity_number) setFormErrors((prev) => ({ ...prev, identityNumber: fieldErrs.identity_number }));
        if (fieldErrs.email) setFormErrors((prev) => ({ ...prev, email: fieldErrs.email }));
        if (fieldErrs.member_number) setFormErrors((prev) => ({ ...prev, memberNumber: fieldErrs.member_number }));
        if (fieldErrs.phone) setFormErrors((prev) => ({ ...prev, phone: fieldErrs.phone }));
        if (fieldErrs.name) setFormErrors((prev) => ({ ...prev, name: fieldErrs.name }));
      } else {
        const lower = message.toLowerCase();
        if (lower.includes("nik") || lower.includes("terdaftar")) {
          setFormErrors((prev) => ({ ...prev, identityNumber: message }));
        } else if (lower.includes("email")) {
          setFormErrors((prev) => ({ ...prev, email: message }));
        } else if (lower.includes("nomor") || lower.includes("member_number")) {
          setFormErrors((prev) => ({ ...prev, memberNumber: message }));
        } else if (lower.includes("phone") || lower.includes("hp")) {
          setFormErrors((prev) => ({ ...prev, phone: message }));
        } else {
          setFormErrors((prev) => ({ ...prev, name: message }));
        }
      }
    } finally {
      setFormLoading(false);
    }
  }

  // Detail Handler
  async function openDetail(member: Member) {
    setDetailMember(member);
    setDetailLoading(true);
    try {
      if (isOffice) {
        const fullDetail = await getOfficeMemberDetailApi(
          selectedCompanyId,
          member.id
        );
        if (fullDetail) setDetailMember(fullDetail);
      } else {
        const fullDetail = await masterDataRepository.getMember(member.id);
        if (fullDetail) setDetailMember(fullDetail);
      }
    } catch {
      // Keep existing member if detailed fetch fails
    } finally {
      setDetailLoading(false);
    }
  }

  // Status Change Confirm Handlers
  function openStatusConfirm(member: Member) {
    const nextStatus: MemberStatus =
      member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setConfirmMember(member);
    setConfirmStatus(nextStatus);
  }

  async function handleChangeStatus() {
    if (!confirmMember || !confirmStatus) return;

    setStatusLoading(true);
    try {
      if (isOffice) {
        await updateOfficeMemberApi(selectedCompanyId, confirmMember.id, {
          status: confirmStatus,
        });
      } else {
        await masterDataRepository.changeMemberStatus(confirmMember.id, {
          status: confirmStatus,
        });
      }

      toast.success(
        confirmStatus === "ACTIVE"
          ? "Anggota berhasil diaktifkan."
          : "Anggota berhasil dinonaktifkan."
      );

      setConfirmMember(null);
      setConfirmStatus(null);

      void loadMembers(false);

      if (detailMember?.id === confirmMember.id) {
        setDetailMember({
          ...detailMember,
          status: confirmStatus,
        });
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal mengubah status anggota.");
      toast.error(msg);
    } finally {
      setStatusLoading(false);
    }
  }

  // Export Excel
  async function handleExportExcel() {
    if (isOffice && !selectedCompanyId) {
      toast.warning("Pilih instansi terlebih dahulu.");
      return;
    }

    try {
      setExportLoading(true);
      const BATCH_SIZE = 100;
      let allMembers: Member[] = [];

      if (isOffice) {
        const firstRes = await getOfficeMembersApi(selectedCompanyId, {
          page: 1,
          size: BATCH_SIZE,
          search: search.trim() || undefined,
          sortby: sortBy,
          order: sortOrder,
        });
        allMembers = [...firstRes.items];
        const totalCount = firstRes.total > 0 ? firstRes.total : allMembers.length;
        const totalBatches = Math.max(1, Math.ceil(totalCount / BATCH_SIZE));
        if (totalBatches > 1) {
          toast.info(`Mengunduh seluruh data anggota (1/${totalBatches})...`);
          for (let p = 2; p <= totalBatches; p++) {
            const nextRes = await getOfficeMembersApi(selectedCompanyId, {
              page: p,
              size: BATCH_SIZE,
              search: search.trim() || undefined,
              sortby: "created_at",
              order: "desc",
            });
            allMembers.push(...nextRes.items);
            if (nextRes.items.length === 0) break;
          }
        }
      } else {
        const firstRes = await masterDataRepository.listMembers({
          search: search.trim(),
          page: 1,
          pageSize: BATCH_SIZE,
        });
        allMembers = [...(firstRes.data || [])];
        const totalCount = firstRes.total > 0 ? firstRes.total : allMembers.length;
        const totalBatches = Math.max(1, Math.ceil(totalCount / BATCH_SIZE));
        if (totalBatches > 1) {
          toast.info(`Mengunduh seluruh data anggota (1/${totalBatches})...`);
          for (let p = 2; p <= totalBatches; p++) {
            const nextRes = await masterDataRepository.listMembers({
              search: search.trim(),
              page: p,
              pageSize: BATCH_SIZE,
            });
            allMembers.push(...(nextRes.data || []));
            if (!nextRes.data || nextRes.data.length === 0) break;
          }
        }
      }

      if (allMembers.length === 0) {
        toast.warning("Tidak ada data anggota untuk diekspor.");
        return;
      }

      const exportData = allMembers.map((m, idx) => ({
        No: idx + 1,
        "Nomor Anggota": m.memberNumber || "-",
        Nama: m.name,
        NIK: m.identityNumber || "-",
        Telepon: m.phone || "-",
        Email: m.email || "-",
        Status: getStatusLabel(m.status),
        "Tanggal Terdaftar": formatDate(m.createdAt),
      }));

      exportToExcel(
        exportData,
        isOffice ? "data-anggota-office" : "data-anggota",
        "Data Anggota"
      );
      toast.success("Data anggota berhasil diekspor ke Excel.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mengekspor data anggota."));
    } finally {
      setExportLoading(false);
    }
  }

  // Print Single Member Card
  function handlePrintSingleMember(member: Member) {
    setBulkPrintItems([
      {
        type: "member",
        memberName: member.name,
        memberNumber: member.memberNumber || "MBR-001",
        memberType: member.memberType || "Umum",
      },
    ]);
    setBulkPrintTitle(`Cetak Kartu Anggota - ${member.name}`);
    setBulkPrintModalOpen(true);
  }

  // Bulk Print All Member Cards
  async function handlePrintAllMembers() {
    if (bulkPrintLoading) return;
    if (isOffice && !selectedCompanyId) {
      toast.warning("Pilih instansi terlebih dahulu untuk mencetak kartu anggota.");
      return;
    }

    setBulkPrintLoading(true);
    setBulkPrintProgress(null);

    try {
      let catalogMembers: Member[] = [];

      if (isOffice) {
        setBulkPrintProgress({ current: 0, total: 1 });
        const firstRes = await getOfficeMembersApi(selectedCompanyId, {
          page: 1,
          size: 100,
          search: search.trim() || undefined,
          sortby: "created_at",
          order: "desc",
        });
        catalogMembers = [...(firstRes.items || [])];
        const totalCount = firstRes.total > 0 ? firstRes.total : catalogMembers.length;
        const totalBatches = Math.max(1, Math.ceil(totalCount / 100));
        for (let p = 2; p <= totalBatches; p++) {
          const nextRes = await getOfficeMembersApi(selectedCompanyId, {
            page: p,
            size: 100,
            search: search.trim() || undefined,
            sortby: "created_at",
            order: "desc",
          });
          catalogMembers.push(...(nextRes.items || []));
          if (!nextRes.items || nextRes.items.length === 0) break;
        }
      } else {
        setBulkPrintProgress({ current: 0, total: 1 });
        const firstRes = await masterDataRepository.listMembers({
          search: search.trim(),

          page: 1,
          pageSize: 100,
        });
        catalogMembers = [...(firstRes.data || [])];
        const totalCount = firstRes.total > 0 ? firstRes.total : catalogMembers.length;
        const totalBatches = Math.max(1, Math.ceil(totalCount / 100));
        for (let p = 2; p <= totalBatches; p++) {
          const nextRes = await masterDataRepository.listMembers({
            search: search.trim(),

            page: p,
            pageSize: 100,
          });
          catalogMembers.push(...(nextRes.data || []));
          if (!nextRes.data || nextRes.data.length === 0) break;
        }
      }

      if (catalogMembers.length === 0) {
        toast.warning("Tidak ada data anggota untuk dicetak.");
        return;
      }

      const totalMembers = catalogMembers.length;
      setBulkPrintProgress({ current: totalMembers, total: totalMembers });

      const items: PrintableBookItem[] = catalogMembers.map((m) => ({
        type: "member",
        memberName: m.name,
        memberNumber: m.memberNumber || "MBR-001",
        memberType: m.memberType || "Umum",
      }));

      setBulkPrintItems(items);
      setBulkPrintTitle(`Cetak Kartu Anggota (${items.length} Anggota)`);
      setBulkPrintModalOpen(true);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal menyiapkan data cetak kartu anggota.");
      toast.error(msg);
    } finally {
      setBulkPrintLoading(false);
      setBulkPrintProgress(null);
    }
  }

  const getMemberActions = (member: Member): RowActionItem[] => {
    const isActive = member.status === "ACTIVE";

    return [
      {
        label: "Detail",
        onClick: () => void openDetail(member),
        icon: (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
      {
        label: "Cetak Kartu",
        onClick: () => handlePrintSingleMember(member),
        icon: (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
        ),
      },
      ...(canManage
        ? [
            {
              label: "Edit",
              onClick: () => openEditForm(member),
              icon: (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              ),
            },
            {
              label: isActive ? "Nonaktifkan" : "Aktifkan",
              onClick: () => openStatusConfirm(member),
              tone: isActive ? ("warning" as const) : ("success" as const),
              icon: isActive ? (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              ) : (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ),
            },
          ]
        : []),
    ];
  };

  // =====================================================
  // DATATABLE CONFIG & SORT
  // =====================================================

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<Member>[]>(
    () => [
      {
        key: "memberNumber",
        header: "No. Anggota",
        width: "150px",
        render: (member) => (
          <span className="font-mono text-xs font-semibold text-text-main">
            {member.memberNumber || "-"}
          </span>
        ),
      },
      {
        key: "name",
        header: "Nama",
        sortable: true,
        render: (member) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {getInitial(member.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-main">
                {member.name}
              </p>
              <p className="truncate text-xs text-text-muted">
                {member.email || "-"}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "identityNumber",
        header: "NIK",
        width: "140px",
        render: (member) => (
          <span className="font-mono text-xs text-text-secondary">
            {maskNik(member.identityNumber)}
          </span>
        ),
      },
      {
        key: "phone",
        header: "No. HP",
        width: "130px",
        render: (member) => (
          <span className="text-xs text-text-secondary">
            {member.phone || "-"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "110px",
        render: (member) => (
          <Badge variant={getStatusBadgeVariant(member.status)}>
            {getStatusLabel(member.status)}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "Aksi",
        width: "80px",
        align: "right",
        render: (member) => (
          <RowActions actions={getMemberActions(member)} />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, isOffice, selectedCompanyId],
  );

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-surface-subtle">
        <LoadingState label="Memeriksa otorisasi pengguna..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-6">
        <BackLink href={isOffice ? "/office/dashboard" : "/dashboard"}>
          {isOffice ? "Kembali ke Office Dashboard" : "Kembali ke Dashboard"}
        </BackLink>

        <div className="mt-4">
          <PageHeader
            className="mb-5 sm:mb-6"
            title="Master Anggota"
            description={
              isOffice
                ? "Inspeksi dan kelola data anggota perpustakaan seluruh instansi."
                : "Kelola data anggota perpustakaan, status keaktifan, dan nomor identitas."
            }
            actions={
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                {isOffice && (
                  <CompanySwitcher
                    size="sm"
                    selectedCompanyId={selectedCompanyId}
                    onSelectCompany={(id) => {
                      savedTotalRef.current = 0;
                      setStoredOfficeCompanyId(id);
                      setSelectedCompanyId(id);
                      setPage(1);
                    }}
                  />
                )}

                <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleExportExcel()}
                    loading={exportLoading}
                    disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading || members.length === 0 || exportLoading}
                    className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span>Ekspor Excel</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handlePrintAllMembers()}
                    loading={bulkPrintLoading}
                    disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading || members.length === 0 || bulkPrintLoading}
                    className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5"
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
                    <span>
                      {bulkPrintProgress
                        ? `Memuat (${bulkPrintProgress.current}/${bulkPrintProgress.total})...`
                        : "Cetak Semua Kartu"}
                    </span>
                  </Button>

                  {canManage && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={openCreateForm}
                      disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading}
                      className="col-span-2 sm:col-auto w-full sm:w-auto text-xs h-9 px-3.5 font-semibold text-center whitespace-nowrap"
                    >
                      + Tambah Anggota
                    </Button>
                  )}
                </div>
              </div>
            }
          />
        </div>

        {/* PROMPT JIKA BELUM PILIH INSTANSI (OFFICE SCOPE) */}
        {isOffice && !selectedCompanyId ? (
          <Card className="mt-6 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <CompanyEmptyIcon />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-main">
              Pilih Instansi Terlebih Dahulu
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
              Sebelum memuat data anggota, silakan pilih salah satu instansi melalui pemilih instansi di atas.
            </p>
          </Card>
        ) : (
          <>
            {/* PENCARIAN & URUTAN */}
            <Card className="mt-4 mb-3 p-3 sm:p-4">
              <div className="grid grid-cols-[1fr_135px] sm:grid-cols-[1fr_160px] xl:grid-cols-1 items-end gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <Input
                    ref={searchInputRef}
                    id="member-search"
                    label="Cari Anggota"
                    type="text"
                    value={search}
                    disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading}
                    onChange={(e) => {
                      savedTotalRef.current = 0;
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari nama, NIK, email, atau nomor anggota... (tekan /)"
                  />
                </div>

                {/* SORT (Khusus Card View: mobile & tablet < xl, disamping kolom search) */}
                <div className="min-w-0 xl:hidden">
                  <label
                    htmlFor="member-sort"
                    className="mb-1.5 block text-xs sm:text-sm font-medium text-text-secondary truncate"
                  >
                    Urutan
                  </label>
                  <Dropdown
                    id="member-sort"
                    value={`${sortBy}:${sortOrder}`}
                    disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading}
                    onChange={(value) => {
                      const [newSortBy, newSortOrder] = value.split(":");
                      setSortBy(newSortBy);
                      setSortOrder(newSortOrder as "asc" | "desc");
                      setPage(1);
                    }}
                    ariaLabel="Urutkan daftar anggota"
                    options={[
                      { value: "name:asc", label: "Nama (A-Z)" },
                      { value: "name:desc", label: "Nama (Z-A)" },
                    ]}
                  />
                </div>
              </div>
            </Card>
            {/* INACTIVE STATE vs ERROR ALERT vs TABLE / LIST */}
            {isInactiveCompany ? (
              <InactiveCompanyState
                companyName={companyName}
                description="Pengelolaan dan inspeksi data anggota ditangguhkan karena instansi ini sedang dalam status nonaktif."
                className="mb-4"
              />
            ) : error ? (
              <ErrorState
                title="Gagal Memuat Data Anggota"
                message={error}
                onRetry={() => void loadMembers(false)}
                className="mb-4"
              />
            ) : (
              <Card className="mt-5 overflow-hidden">
                <DataTable
                  rows={members}
                  columns={columns}
                  keyExtractor={(m) => m.id}
                  loading={loading || tableLoading}
                  loadingMessage="Memperbarui data anggota..."
                  sortBy={sortBy}
                  order={sortOrder}
                  onSortChange={handleSortChange}
                  mobileBreakpoint="xl"
                  cardGridClassName="bg-surface-subtle/60 p-3 sm:p-4"
                  className="border-0 shadow-none rounded-none"
                  emptyState={
                    <div className="p-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-subtle">
                        ?
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-text-main">
                        Anggota tidak ditemukan
                      </h3>
                      <p className="mt-1 text-xs text-text-muted">
                        {search
                          ? "Coba ubah kata kunci pencarian Anda."
                          : "Belum ada data anggota yang terdaftar."}
                      </p>
                      {canManage && (
                        <div className="mt-4 flex justify-center">
                          <Button
                            type="button"
                            variant="primary"
                            onClick={openCreateForm}
                            disabled={isOffice && !selectedCompanyId}
                          >
                            + Tambah Anggota
                          </Button>
                        </div>
                      )}
                    </div>
                  }
                  renderMobileCard={(member) => {
                    const isActive = member.status === "ACTIVE";

                    return (
                      <Card
                        key={member.id}
                        className="p-3.5 shadow-xs transition flex flex-col justify-between h-full hover:border-border"
                      >
                        <div>
                          {/* TOP */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                  isActive
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-surface-muted text-text-muted"
                                }`}
                              >
                                {getInitial(member.name)}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-medium text-text-muted font-mono">
                                  {member.memberNumber || "-"}
                                </p>

                                <p
                                  className="truncate text-sm font-semibold text-text-main"
                                  title={member.name}
                                >
                                  {member.name}
                                </p>
                              </div>
                            </div>

                            <Badge variant={getStatusBadgeVariant(member.status)}>
                              {getStatusLabel(member.status)}
                            </Badge>
                          </div>

                          {/* INFORMATION */}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                NIK
                              </p>
                              <p
                                className="mt-0.5 truncate text-xs font-medium text-text-secondary font-mono"
                                title={maskNik(member.identityNumber)}
                              >
                                {maskNik(member.identityNumber)}
                              </p>
                            </div>

                            <div className="rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                No. HP
                              </p>
                              <p
                                className="mt-0.5 truncate text-xs font-medium text-text-secondary"
                                title={member.phone || "-"}
                              >
                                {member.phone || "-"}
                              </p>
                            </div>

                            <div className="col-span-2 rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                Email
                              </p>
                              <p
                                className="mt-0.5 truncate text-xs font-medium text-text-secondary"
                                title={member.email || "-"}
                              >
                                {member.email || "-"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* BOTTOM ACTIONS */}
                        <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle pt-2.5">
                          <span className="text-xs font-medium text-text-muted">
                            Pilihan Aksi
                          </span>
                          <RowActions actions={getMemberActions(member)} />
                        </div>
                      </Card>
                    );
                  }}
                />

                {/* PAGINATION */}
                {members.length > 0 && total > 0 && (
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={total}
                    pageSize={pageSize}
                    pageSizeOptions={[5, 10, 20, 50, 100]}
                    onPageSizeChange={(newSize) => {
                      savedTotalRef.current = 0;
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    onPageChange={(p) => setPage(p)}
                  />
                )}
              </Card>
          )}
          </>
        )}

        {/* MODAL FORM CREATE / EDIT */}
        <Modal
          open={showForm}
          onClose={handleRequestCloseForm}
          title={editingMember ? "Edit Anggota" : "Tambah Anggota Baru"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="input-name"
              label="Nama Lengkap"
              required
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formErrors.name) {
                  setFormErrors((prev) => ({ ...prev, name: "" }));
                }
              }}
              placeholder="Contoh: Ahmad Dahlan"
              error={formErrors.name}
            />

            <Input
              id="input-identity-number"
              label="NIK / Nomor Identitas"
              required
              type="text"
              value={identityNumber}
              onChange={(e) => {
                setIdentityNumber(e.target.value);
                if (formErrors.identityNumber) {
                  setFormErrors((prev) => ({ ...prev, identityNumber: "" }));
                }
              }}
              placeholder="16 digit NIK"
              error={formErrors.identityNumber}
            />

            <Input
              id="input-phone"
              label="Nomor Telepon / WhatsApp"
              required
              type="text"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (formErrors.phone) {
                  setFormErrors((prev) => ({ ...prev, phone: "" }));
                }
              }}
              placeholder="Contoh: 08123456789"
              error={formErrors.phone}
            />

            <Input
              id="input-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) {
                  setFormErrors((prev) => ({ ...prev, email: "" }));
                }
              }}
              placeholder="Contoh: ahmad@example.com"
              error={formErrors.email}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleRequestCloseForm}
                disabled={formLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={formLoading}
                aria-keyshortcuts="Control+Enter Meta+Enter"
              >
                {editingMember ? "Simpan Perubahan" : "Tambah Anggota"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL DETAIL ANGGOTA */}
        <Modal
          open={detailMember !== null}
          onClose={() => setDetailMember(null)}
          title="Detail Anggota"
          size="lg"
        >
          {detailMember && (
            <div className="space-y-4">
              {detailLoading && (
                <div className="text-xs text-blue-600 flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Memperbarui data lengkap...
                </div>
              )}

              <div className="flex items-center gap-3.5 border-b border-border-subtle pb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                  {getInitial(detailMember.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-medium text-text-muted">
                    {detailMember.memberNumber || "-"}
                  </p>
                  <h3 className="truncate text-lg font-bold text-text-main">
                    {detailMember.name}
                  </h3>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(detailMember.status)}>
                      {getStatusLabel(detailMember.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Nama Lengkap
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {detailMember.name}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Nomor Anggota
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-text-main">
                    {detailMember.memberNumber || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    NIK
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-text-main">
                    {canManage
                      ? detailMember.identityNumber || "-"
                      : maskNik(detailMember.identityNumber)}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Nomor HP
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {detailMember.phone || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Email
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-text-main">
                    {detailMember.email || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Tipe Anggota
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {detailMember.memberType || "Umum"}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Status
                  </p>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(detailMember.status)}>
                      {getStatusLabel(detailMember.status)}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Bergabung Pada
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {formatDate(detailMember.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handlePrintSingleMember(detailMember)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5"
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
                  <span>Cetak Kartu</span>
                </Button>

                {canManage && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const target = detailMember;
                      setDetailMember(null);
                      openEditForm(target);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Ubah Anggota
                  </Button>
                )}

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setDetailMember(null)}
                  className="w-full sm:w-auto"
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* =====================================================
            BARCODE & QR PRINT MODAL (MEMBER CARDS)
        ===================================================== */}
        <BookBarcodePrintModal
          isOpen={bulkPrintModalOpen}
          onClose={() => setBulkPrintModalOpen(false)}
          items={bulkPrintItems}
          title={bulkPrintTitle}
          companyName={companyName}
        />

        {/* CONFIRMATION DIALOG DISCARD FORM */}
        <ConfirmationDialog
          open={showDiscardConfirm}
          title="Tutup Formulir Anggota?"
          description="Data yang telah Anda isi belum disimpan. Jika formulir ditutup, seluruh isian data anggota akan hilang."
          confirmLabel="Ya, Tutup Formulir"
          tone="destructive"
          onConfirm={() => {
            setShowDiscardConfirm(false);
            closeForm();
          }}
          onClose={() => setShowDiscardConfirm(false)}
        />

        {/* CONFIRMATION DIALOG STATUS TOGGLE */}
        <ConfirmationDialog
          open={confirmMember !== null}
          title={
            confirmStatus === "ACTIVE"
              ? "Aktifkan Anggota"
              : "Nonaktifkan Anggota"
          }
          description={
            confirmStatus === "ACTIVE"
              ? `Apakah Anda yakin ingin mengaktifkan anggota "${confirmMember?.name}"? Anggota ini akan dapat meminjam buku kembali.`
              : `Apakah Anda yakin ingin menonaktifkan anggota "${confirmMember?.name}"? Anggota yang dinonaktifkan tidak dapat melakukan peminjaman buku.`
          }
          confirmLabel={
            confirmStatus === "ACTIVE" ? "Aktifkan" : "Nonaktifkan"
          }
          tone={
            confirmStatus === "ACTIVE" ? "primary" : "destructive"
          }
          loading={statusLoading}
          onConfirm={() => void handleChangeStatus()}
          onClose={() => {
            if (!statusLoading) {
              setConfirmMember(null);
              setConfirmStatus(null);
            }
          }}
        />
      </div>
    </div>
  );
}
