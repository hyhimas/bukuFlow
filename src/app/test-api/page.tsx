"use client";

import { useState } from "react";
import {
  api,
  loginApi,
  getMeApi,
  logoutApi,
  searchMembersApi,
  listLoansApi,
  getActiveReturnsApi,
  returnLoanItemsApi,
  getBooksApi,
  getBookCopiesApi,
  searchBooksApi,
} from "@/lib/api";
import { getToken, getSession, setSession } from "@/lib/auth";

export default function TestApiPage() {
  // 1. State Health Check
  const [healthResult, setHealthResult] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Loans & Returns State
  const [loansResult, setLoansResult] = useState<any>(null);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState("");

  const [returnsResult, setReturnsResult] = useState<any>(null);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState("");

  const [booksListResult, setBooksListResult] = useState<any>(null);
  const [booksListLoading, setBooksListLoading] = useState(false);
  const [booksListError, setBooksListError] = useState("");

  const [searchBooksQuery, setSearchBooksQuery] = useState("");
  const [searchBooksResult, setSearchBooksResult] = useState<any>(null);
  const [searchBooksLoading, setSearchBooksLoading] = useState(false);
  const [searchBooksError, setSearchBooksError] = useState("");

  async function handleGetBooksList() {
    setBooksListLoading(true);
    setBooksListError("");
    setBooksListResult(null);
    try {
      const data = await getBooksApi();
      setBooksListResult(data);
    } catch (err: any) {
      setBooksListError(JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
      setBooksListLoading(false);
    }
  }

  async function handleSearchBooks(e: React.FormEvent) {
    e.preventDefault();
    setSearchBooksLoading(true);
    setSearchBooksError("");
    setSearchBooksResult(null);
    try {
      const data = await searchBooksApi(searchBooksQuery);
      setSearchBooksResult(data);
    } catch (err: any) {
      setSearchBooksError(JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
      setSearchBooksLoading(false);
    }
  }

  async function handleGetLoans() {
    setLoansLoading(true);
    setLoansError("");
    setLoansResult(null);
    try {
      const data = await listLoansApi();
      setLoansResult(data);
    } catch (err: any) {
      setLoansError(JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
      setLoansLoading(false);
    }
  }

  async function handleGetActiveReturns() {
    setReturnsLoading(true);
    setReturnsError("");
    setReturnsResult(null);
    try {
      const data = await getActiveReturnsApi();
      setReturnsResult(data);
    } catch (err: any) {
      setReturnsError(JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
      setReturnsLoading(false);
    }
  }

  // 11. Return Loan Test State
  const [returnLoanId, setReturnLoanId] = useState("");
  const [returnCopyIds, setReturnCopyIds] = useState("");
  const [returnTestResult, setReturnTestResult] = useState<any>(null);
  const [returnTestLoading, setReturnTestLoading] = useState(false);
  const [returnTestError, setReturnTestError] = useState("");

  async function handleTestReturnDirect(e: React.FormEvent) {
    e.preventDefault();
    setReturnTestLoading(true);
    setReturnTestError("");
    setReturnTestResult(null);

    const cleanLoanId = returnLoanId.trim();
    const cleanCopies = returnCopyIds
      .split(",")
      .map((c) => {
        const trimmed = c.trim();
        const hexMatch = trimmed.match(/[0-9a-fA-F]{24}/);
        return hexMatch ? hexMatch[0] : trimmed;
      })
      .filter(Boolean);

    try {
      const res = await api.post(`/loan/returns/${cleanLoanId}`, {
        copy_ids: cleanCopies,
      });
      setReturnTestResult({
        status: res.status,
        statusText: res.statusText,
        data: res.data,
      });
    } catch (err: any) {
      setReturnTestError(
        JSON.stringify(
          {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data || err.message,
          },
          null,
          2
        )
      );
    } finally {
      setReturnTestLoading(false);
    }
  }

  // 12. Create Book Copy Test State
  const [copyBookId, setCopyBookId] = useState("");
  const [copyCode, setCopyCode] = useState("");
  const [createCopyResult, setCreateCopyResult] = useState<any>(null);
  const [createCopyLoading, setCreateCopyLoading] = useState(false);
  const [createCopyError, setCreateCopyError] = useState("");

  async function handleCreateCopy(e: React.FormEvent) {
    e.preventDefault();
    setCreateCopyLoading(true);
    setCreateCopyError("");
    setCreateCopyResult(null);

    const cleanBookId = copyBookId.trim();
    const cleanCode = copyCode.trim();

    try {
      const res = await api.post(`/catalog/books/${cleanBookId}/copies`, {
        code: cleanCode,
        status: "AVAILABLE",
      });
      setCreateCopyResult({
        status: res.status,
        data: res.data,
      });
    } catch (err: any) {
      setCreateCopyError(
        JSON.stringify(
          {
            status: err.response?.status,
            data: err.response?.data || err.message,
          },
          null,
          2
        )
      );
    } finally {
      setCreateCopyLoading(false);
    }
  }

  // 13. Delete Book Test State
  const [deleteBookId, setDeleteBookId] = useState("");
  const [deleteBookResult, setDeleteBookResult] = useState<any>(null);
  const [deleteBookLoading, setDeleteBookLoading] = useState(false);
  const [deleteBookError, setDeleteBookError] = useState("");

  async function handleDeleteBook(e: React.FormEvent) {
    e.preventDefault();
    setDeleteBookLoading(true);
    setDeleteBookError("");
    setDeleteBookResult(null);

    const cleanBookId = deleteBookId.trim();

    try {
      const res = await api.delete(`/catalog/books/${cleanBookId}`);

      setDeleteBookResult({
        status: res.status,
        data: res.data,
      });

      // Refresh list buku jika sudah terbuka
      if (booksListResult) {
        handleGetBooksList();
      }
    } catch (err: any) {
      setDeleteBookError(
        JSON.stringify(
          {
            status: err.response?.status,
            data: err.response?.data || err.message,
          },
          null,
          2
        )
      );
    } finally {
      setDeleteBookLoading(false);
    }
  }

  // 14. Delete Book Copy State
  const [deleteCopyBookId, setDeleteCopyBookId] = useState("");
  const [deleteCopyId, setDeleteCopyId] = useState("");
  const [deleteCopyResult, setDeleteCopyResult] = useState<any>(null);
  const [deleteCopyLoading, setDeleteCopyLoading] = useState(false);
  const [deleteCopyError, setDeleteCopyError] = useState("");
  const [bookCopiesForDelete, setBookCopiesForDelete] = useState<any[]>([]);
  const [loadCopiesLoading, setLoadCopiesLoading] = useState(false);

  async function handleLoadCopiesForDelete(bookId: string) {
    setLoadCopiesLoading(true);
    try {
      const copies = await getBookCopiesApi(bookId);
      setBookCopiesForDelete(copies);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadCopiesLoading(false);
    }
  }

  async function handleDeleteBookCopy(e: React.FormEvent) {
    e.preventDefault();
    setDeleteCopyLoading(true);
    setDeleteCopyError("");
    setDeleteCopyResult(null);

    const cleanBookId = deleteCopyBookId.trim();
    const cleanCopyId = deleteCopyId.trim();

    try {
      const res = await api.delete(`/catalog/books/${cleanBookId}/copies/${cleanCopyId}`);

      setDeleteCopyResult({
        status: res.status,
        data: res.data,
      });

      // Refresh list copies & books
      handleLoadCopiesForDelete(cleanBookId);
      if (booksListResult) {
        handleGetBooksList();
      }
    } catch (err: any) {
      setDeleteCopyError(
        JSON.stringify(
          {
            status: err.response?.status,
            data: err.response?.data || err.message,
          },
          null,
          2
        )
      );
    } finally {
      setDeleteCopyLoading(false);
    }
  }

  // 15. Delete Member State
  const [deleteMemberId, setDeleteMemberId] = useState("");
  const [deleteMemberResult, setDeleteMemberResult] = useState<any>(null);
  const [deleteMemberLoading, setDeleteMemberLoading] = useState(false);
  const [deleteMemberError, setDeleteMemberError] = useState("");

  async function handleDeleteMember(e: React.FormEvent) {
    e.preventDefault();
    setDeleteMemberLoading(true);
    setDeleteMemberError("");
    setDeleteMemberResult(null);

    const cleanMemberId = deleteMemberId.trim();

    try {
      const res = await api.delete(`/member/${cleanMemberId}`);

      setDeleteMemberResult({
        status: res.status,
        data: res.data,
      });

      // Refresh member search
      if (membersResult) {
        handleSearchMember(e);
      }
    } catch (err: any) {
      setDeleteMemberError(
        JSON.stringify(
          {
            status: err.response?.status,
            data: err.response?.data || err.message,
          },
          null,
          2
        )
      );
    } finally {
      setDeleteMemberLoading(false);
    }
  }

  // 2. State Login Test
  const [email, setEmail] = useState("admin@bukuflow.com");
  const [password, setPassword] = useState("Admin12345!");
  const [loginResult, setLoginResult] = useState<any>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // 3. State GET /me
  const [meResult, setMeResult] = useState<any>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState("");

  // Handler GET /health
  async function handleCheckHealth() {
    setHealthLoading(true);
    setHealthResult(null);
    try {
      const response = await api.get("/health");
      setHealthResult(response.data);
    } catch (err: any) {
      setHealthResult({ error: err.message });
    } finally {
      setHealthLoading(false);
    }
  }

  // 2. State & Handler untuk Test Member Search
const [searchQuery, setSearchQuery] = useState("");
const [membersResult, setMembersResult] = useState<any>(null);
const [searchLoading, setSearchLoading] = useState(false);
async function handleSearchMember(e: React.FormEvent) {
  e.preventDefault();
  setSearchLoading(true);
  try {
    const data = await searchMembersApi(searchQuery);
    console.log("Hasil Member Backend:", data);
    setMembersResult(data);
  } catch (err: any) {
    console.error("Gagal cari member:", err.response?.data || err.message);
  } finally {
    setSearchLoading(false);
  }
}

  // Handler POST /auth/login
  async function handleTestLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    setLoginResult(null);

    try {
      const data = await loginApi(email, password);
      console.log("Login Sukses:", data);
      setLoginResult(data);

      // Simpan session & token
      const userToSave = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        username: data.user.email,
        role: data.user.role,
        companyId: data.user.company_id || "company-001",
        status: "ACTIVE" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSession(userToSave, data.access_token);
    } catch (err: any) {
      setLoginError(JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
      setLoginLoading(false);
    }
  }

  // Handler GET /auth/me
  async function handleGetMe() {
    setMeLoading(true);
    setMeError("");
    setMeResult(null);

    try {
      const data = await getMeApi();
      console.log("Data Profil /me:", data);
      setMeResult(data);
    } catch (err: any) {
      console.error("Gagal /me:", err.response?.data || err.message);
      setMeError(JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
      setMeLoading(false);
    }
  }

  const currentToken = typeof window !== "undefined" ? getToken() : null;
  const currentSession = typeof window !== "undefined" ? getSession() : null;

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "700px" }}>
      <h1>Dashboard Uji Coba Auth Backend</h1>

      {/* STATUS TOKEN SAAT INI */}
      <div style={{ padding: "12px", backgroundColor: currentToken ? "#dcfce7" : "#fee2e2", borderRadius: "8px", marginBottom: "20px" }}>
        <strong>Status Token di Browser: </strong>
        {currentToken ? "✅ Token Tersimpan (Aktif)" : "❌ Belum Ada Token (Belum Login)"}
        {currentSession && (
          <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>
            User Aktif: <strong>{currentSession.user.name}</strong> ({currentSession.user.role})
          </p>
        )}
      </div>

      {/* 1. HEALTH CHECK */}
      <section style={{ marginBottom: "25px", borderBottom: "1px solid #e2e8f0", paddingBottom: "15px" }}>
        <h3>1. GET /bukuflow/health</h3>
        <button onClick={handleCheckHealth} disabled={healthLoading} style={btnStyle("#2563eb")}>
          {healthLoading ? "Memeriksa..." : "Cek Health"}
        </button>
        {healthResult && <pre style={codeStyle}>{JSON.stringify(healthResult, null, 2)}</pre>}
      </section>

      {/* 2. LOGIN */}
      <section style={{ marginBottom: "25px", borderBottom: "1px solid #e2e8f0", paddingBottom: "15px" }}>
        <h3>2. POST /bukuflow/auth/login</h3>
        <form onSubmit={handleTestLogin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
          />
          <button type="submit" disabled={loginLoading} style={btnStyle("#16a34a")}>
            {loginLoading ? "Memproses Login..." : "Test Login"}
          </button>
        </form>
        {loginError && <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{loginError}</pre>}
        {loginResult && <pre style={{ ...codeStyle, backgroundColor: "#dcfce7", color: "#15803d" }}>{JSON.stringify(loginResult, null, 2)}</pre>}
      </section>

      {/* 3. GET ME (PROFIL DENGAN TOKEN) */}
      <section style={{ marginBottom: "25px", borderBottom: "1px solid #e2e8f0", paddingBottom: "15px" }}>
        <h3>3. GET /bukuflow/auth/me 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mengambil data profil user berdasarkan Token yang sedang aktif.
        </p>
        <button onClick={handleGetMe} disabled={meLoading} style={btnStyle("#7c3aed")}>
          {meLoading ? "Mengambil Data..." : "Ambil Profil Saya (/me)"}
        </button>
        {meError && <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{meError}</pre>}
        {meResult && <pre style={{ ...codeStyle, backgroundColor: "#f5f3ff", color: "#6d28d9" }}>{JSON.stringify(meResult, null, 2)}</pre>}
      </section>

      {/* 4. LOGOUT */}
      <section>
        <h3>4. POST /bukuflow/auth/logout 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mencabut token di server backend dan membersihkan sesi browser.
        </p>
        <button onClick={() => logoutApi()} style={btnStyle("#dc2626")}>
          Test Logout
        </button>
      </section>

            {/* 5. SEARCH MEMBER */}
      <section style={{ marginTop: "25px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
        <h3>5. GET /bukuflow/members/search 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mencari member berdasarkan nama, nomor identitas, atau email.
        </p>

        <form onSubmit={handleSearchMember} style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik nama / kata kunci member (misal: a)"
            required
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", flex: 1 }}
          />
          <button type="submit" disabled={searchLoading} style={btnStyle("#0284c7")}>
            {searchLoading ? "Mencari..." : "Cari Member"}
          </button>
        </form>

        {/* HASIL DATA DARI BACKEND */}
        {membersResult && (
          <div>
            <strong>Hasil JSON dari Backend:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0f9ff", color: "#0369a1" }}>
              {JSON.stringify(membersResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 6. SIMULASI SESI & TIMER */}
      <section style={{ marginTop: "25px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
        <h3>6. ⏱️ Simulasi Timer & Warning Sesi</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Klik tombol di bawah untuk menyimulasikan sisa waktu tanpa perlu menunggu:
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
          <button
            onClick={() => {
              localStorage.setItem("auth_expires_at", new Date(Date.now() + 9 * 60 * 1000).toISOString());
              window.location.href = "/dashboard";
            }}
            style={btnStyle("#f59e0b")}
          >
            Simulasi Sisa 9 Menit (Cek Banner Warning)
          </button>

          <button
            onClick={() => {
              localStorage.setItem("auth_expires_at", new Date(Date.now() + 4 * 60 * 1000).toISOString());
              window.location.href = "/dashboard";
            }}
            style={btnStyle("#ea580c")}
          >
            Simulasi Sisa 4 Menit (Cek Popup Pengingat)
          </button>

          <button
            onClick={() => {
              localStorage.setItem("auth_expires_at", new Date(Date.now() + 6 * 1000).toISOString());
              window.location.href = "/dashboard";
            }}
            style={btnStyle("#dc2626")}
          >
            Simulasi Sisa 6 Detik (Cek Auto-Logout 00:00)
          </button>
        </div>
      </section>
      {/* 7. GET LOANS */}
      <section style={{ marginTop: "25px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
        <h3>7. GET /bukuflow/loans (List Loans) 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mengambil daftar seluruh transaksi peminjaman buku dari backend.
        </p>
        <button onClick={handleGetLoans} disabled={loansLoading} style={btnStyle("#059669")}>
          {loansLoading ? "Mengambil Data Loans..." : "Test GET Loans"}
        </button>
        {loansError && <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{loansError}</pre>}
        {loansResult && (
          <div>
            <strong>Hasil Data Loans:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0fdf4", color: "#166534" }}>
              {JSON.stringify(loansResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 8. GET ACTIVE RETURNS */}
      <section style={{ marginTop: "25px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
        <h3>8. GET /bukuflow/returns/active (Active Returns) 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mengambil daftar peminjaman aktif yang siap untuk dikembalikan.
        </p>
        <button onClick={handleGetActiveReturns} disabled={returnsLoading} style={btnStyle("#d97706")}>
          {returnsLoading ? "Mengambil Data Returns..." : "Test GET Active Returns"}
        </button>
        {returnsError && <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{returnsError}</pre>}
        {returnsResult && (
          <div>
            <strong>Hasil Data Active Returns:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#fffbeb", color: "#92400e" }}>
              {JSON.stringify(returnsResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 9. GET CATALOG BOOKS (LIST BOOKS) */}
      <section style={{ marginTop: "25px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
        <h3>9. GET /bukuflow/catalog/books (List Books) 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mengambil seluruh daftar buku menggunakan endpoint utama List Books (bukan search).
        </p>
        <button onClick={handleGetBooksList} disabled={booksListLoading} style={btnStyle("#4f46e5")}>
          {booksListLoading ? "Mengambil Data Buku..." : "Test GET /catalog/books"}
        </button>
        {booksListError && <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{booksListError}</pre>}
        {booksListResult && (
          <div>
            <strong>Hasil Data Buku dari Backend:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#eef2ff", color: "#3730a3" }}>
              {JSON.stringify(booksListResult, null, 2)}
            </pre>
          </div>
        )}
      </section>
      {/* 10. GET CATALOG BOOKS SEARCH */}
      <section style={{ marginTop: "25px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
        <h3>10. GET /bukuflow/catalog/books/search?q=... (Search Books) 🔒</h3>
        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Mencari buku berdasarkan kata kunci (judul, kode, ISBN, pengarang).
        </p>

        <form onSubmit={handleSearchBooks} style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            type="text"
            value={searchBooksQuery}
            onChange={(e) => setSearchBooksQuery(e.target.value)}
            placeholder="Ketik judul / kata kunci buku (misal: Python)"
            required
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", flex: 1 }}
          />
          <button type="submit" disabled={searchBooksLoading} style={btnStyle("#0284c7")}>
            {searchBooksLoading ? "Mencari..." : "Cari Buku"}
          </button>
        </form>

        {searchBooksError && <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{searchBooksError}</pre>}
        {searchBooksResult && (
          <div>
            <strong>Hasil Pencarian Buku dari Backend:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0f9ff", color: "#0369a1" }}>
              {JSON.stringify(searchBooksResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 11. TEST POST /loan/returns/{loan_id} */}
      <section style={{ marginTop: "25px", borderTop: "2px solid #2563eb", paddingTop: "15px", backgroundColor: "#f8fafc", padding: "16px", borderRadius: "8px" }}>
        <h3 style={{ color: "#1e40af" }}>11. TEST POST /loan/returns/&#123;loan_id&#125; (Pengembalian Buku Langsung) ⚡</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>
          Uji langsung eksekusi pengembalian buku ke backend dengan Loan ID dan Copy ID MongoDB.
        </p>

        {/* HELPER: DAFTAR TRANSAKSI AKTIF */}
        <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1e40af" }}>
              📋 Daftar Transaksi Peminjaman Aktif:
            </span>
            <button
              type="button"
              onClick={handleGetActiveReturns}
              disabled={returnsLoading}
              style={{ ...btnStyle("#2563eb"), padding: "4px 12px", fontSize: "12px" }}
            >
              {returnsLoading ? "Memuat..." : "🔄 Refresh / Ambil Transaksi Aktif"}
            </button>
          </div>

          {returnsResult && Array.isArray(returnsResult) && returnsResult.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
              {returnsResult.map((tx: any, idx: number) => {
                const loanId = tx.loan?.id || tx.id;
                const copyIds = (tx.items || [])
                  .map((it: any) => it.bookCopy?.id || it.loanItem?.bookCopyId)
                  .filter(Boolean);
                const bookTitles = (tx.items || [])
                  .map((it: any) => `${it.book?.title || "Buku"} (${it.bookCopy?.code || "Copy"})`)
                  .join(", ");

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "13px", color: "#0f172a" }}>
                        {tx.loan?.loanNumber || `TRX-${idx + 1}`} — {tx.member?.name || "Anggota"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#475569" }}>
                        Buku: {bookTitles || "-"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                        Loan ID: {loanId} | Copy ID: {copyIds.join(", ") || "-"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cleanCleanCopyIds = copyIds.map((id: string) => {
                          const hex = id.match(/[0-9a-fA-F]{24}/);
                          return hex ? hex[0] : id;
                        });
                        setReturnLoanId(loanId);
                        setReturnCopyIds(cleanCleanCopyIds.join(", "));
                      }}
                      style={{ ...btnStyle("#059669"), padding: "6px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                    >
                      👉 Pilih Transaksi Ini
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Klik tombol &quot;Refresh / Ambil Transaksi Aktif&quot; di atas untuk melihat transaksi yang sedang berjalan.
            </div>
          )}
        </div>

        <form onSubmit={handleTestReturnDirect} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Loan ID (24-hex MongoDB ID atau ID Transaksi):
            </label>
            <input
              type="text"
              value={returnLoanId}
              onChange={(e) => setReturnLoanId(e.target.value)}
              placeholder="Contoh: 6ab4cc63517050599bb6332e"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Copy IDs (pisahkan dengan koma jika lebih dari 1):
            </label>
            <input
              type="text"
              value={returnCopyIds}
              onChange={(e) => setReturnCopyIds(e.target.value)}
              placeholder="Contoh: 6ab4cc63517050599bb6332e"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <button type="submit" disabled={returnTestLoading} style={btnStyle("#2563eb")}>
            {returnTestLoading ? "Memproses Pengembalian..." : "Eksekusi POST /loan/returns/{id}"}
          </button>
        </form>

        {returnTestError && (
          <div>
            <strong style={{ color: "#dc2626" }}>Error / Respon Non-200 dari Backend:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{returnTestError}</pre>
          </div>
        )}
        {returnTestResult && (
          <div>
            <strong style={{ color: "#166534" }}>Sukses Respons Backend (Status: {returnTestResult.status}):</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0fdf4", color: "#166534" }}>
              {JSON.stringify(returnTestResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 12. TEST CREATE BOOK COPY */}
      <section style={{ marginTop: "25px", borderTop: "2px solid #16a34a", paddingTop: "15px", backgroundColor: "#f8fafc", padding: "16px", borderRadius: "8px" }}>
        <h3 style={{ color: "#15803d" }}>12. TEST POST /catalog/books/&#123;book_id&#125;/copies (Tambah Stok Copy Fisik Buku) 📚</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>
          Tambahkan copy fisik baru pada buku yang stoknya habis agar bisa langsung dipinjamkan kembali.
        </p>

        {/* HELPER: DAFTAR BUKU */}
        <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", fontSize: "13px", color: "#166534" }}>
              📚 Daftar Buku di Katalog:
            </span>
            <button
              type="button"
              onClick={handleGetBooksList}
              disabled={booksListLoading}
              style={{ ...btnStyle("#16a34a"), padding: "4px 12px", fontSize: "12px" }}
            >
              {booksListLoading ? "Memuat..." : "🔄 Refresh / Ambil Buku"}
            </button>
          </div>

          {booksListResult && Array.isArray(booksListResult) && booksListResult.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
              {booksListResult.map((b: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "white",
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "13px", color: "#0f172a" }}>
                      {b.title} ({b.code})
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      Stok Tersedia: {b.availableCopies} / {b.totalCopies}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                      Book ID: {b.id}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCopyBookId(b.id);
                      setCopyCode(`${b.code}-${(b.totalCopies || 0) + 1}`);
                    }}
                    style={{ ...btnStyle("#059669"), padding: "6px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                  >
                    👉 Pilih Buku Ini
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Klik tombol &quot;Refresh / Ambil Buku&quot; di atas untuk melihat daftar buku.
            </div>
          )}
        </div>

        <form onSubmit={handleCreateCopy} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Book ID (ID Buku MongoDB):
            </label>
            <input
              type="text"
              value={copyBookId}
              onChange={(e) => setCopyBookId(e.target.value)}
              placeholder="Contoh: 6ab4a81234567890abcdef12"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Kode Copy (Barcode / Nomor Registrasi Buku):
            </label>
            <input
              type="text"
              value={copyCode}
              onChange={(e) => setCopyCode(e.target.value)}
              placeholder="Contoh: BK-001-02"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <button type="submit" disabled={createCopyLoading} style={btnStyle("#16a34a")}>
            {createCopyLoading ? "Menambahkan Copy..." : "Tambah Copy Buku Baru"}
          </button>
        </form>

        {createCopyError && (
          <div>
            <strong style={{ color: "#dc2626" }}>Error Tambah Copy:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{createCopyError}</pre>
          </div>
        )}
        {createCopyResult && (
          <div>
            <strong style={{ color: "#166534" }}>Sukses Tambah Copy (Status: {createCopyResult.status}):</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0fdf4", color: "#166534" }}>
              {JSON.stringify(createCopyResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 13. TEST DELETE /catalog/books/{book_id} */}
      <section style={{ marginTop: "25px", borderTop: "2px solid #ef4444", paddingTop: "15px", backgroundColor: "#fff5f5", padding: "16px", borderRadius: "8px" }}>
        <h3 style={{ color: "#b91c1c" }}>13. TEST DELETE /bukuflow/catalog/books/&#123;book_id&#125; (Hapus Buku dari Backend) 🗑️</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>
          Menguji endpoint penghapusan buku berdasarkan Book ID MongoDB secara langsung.
        </p>

        {/* HELPER: DAFTAR BUKU */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #fecaca", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", fontSize: "13px", color: "#b91c1c" }}>
              📚 Pilih Buku yang Ingin Dihapus:
            </span>
            <button
              type="button"
              onClick={handleGetBooksList}
              disabled={booksListLoading}
              style={{ ...btnStyle("#ef4444"), padding: "4px 12px", fontSize: "12px" }}
            >
              {booksListLoading ? "Memuat..." : "🔄 Refresh / Ambil Buku"}
            </button>
          </div>

          {booksListResult && Array.isArray(booksListResult) && booksListResult.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
              {booksListResult.map((b: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fca5a5",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "13px", color: "#991b1b" }}>
                      {b.title} ({b.code})
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      Stok: {b.availableCopies} / {b.totalCopies}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                      Book ID: {b.id}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteBookId(b.id);
                    }}
                    style={{ ...btnStyle("#dc2626"), padding: "6px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                  >
                    👉 Pilih Buku Ini
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Klik tombol &quot;Refresh / Ambil Buku&quot; di atas untuk melihat daftar buku.
            </div>
          )}
        </div>

        <form onSubmit={handleDeleteBook} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Book ID (ID Buku MongoDB):
            </label>
            <input
              type="text"
              value={deleteBookId}
              onChange={(e) => setDeleteBookId(e.target.value)}
              placeholder="Contoh: 6ab4a81234567890abcdef12"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <button type="submit" disabled={deleteBookLoading} style={btnStyle("#dc2626")}>
            {deleteBookLoading ? "Menghapus Buku..." : "Eksekusi DELETE /catalog/books/{book_id}"}
          </button>
        </form>

        {deleteBookError && (
          <div>
            <strong style={{ color: "#dc2626" }}>Error / Respon Gagal:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{deleteBookError}</pre>
          </div>
        )}
        {deleteBookResult && (
          <div>
            <strong style={{ color: "#166534" }}>Sukses Hapus Buku (Status: {deleteBookResult.status}):</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0fdf4", color: "#166534" }}>
              {JSON.stringify(deleteBookResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 14. TEST DELETE /catalog/books/{book_id}/copies/{copy_id} */}
      <section style={{ marginTop: "25px", borderTop: "2px solid #ea580c", paddingTop: "15px", backgroundColor: "#fff7ed", padding: "16px", borderRadius: "8px" }}>
        <h3 style={{ color: "#c2410c" }}>14. TEST DELETE /bukuflow/catalog/books/&#123;book_id&#125;/copies/&#123;copy_id&#125; (Hapus Copy Fisik Buku) ✂️</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>
          Menguji penghapusan satu copy fisik spesifik dari sebuah buku di database backend.
        </p>

        {/* STEP 1: PILIH BUKU UNTUK LIHAT DAFTAR COPY */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #fed7aa", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", fontSize: "13px", color: "#c2410c" }}>
              1️⃣ Pilih Buku untuk Memuat Daftar Copy:
            </span>
            <button
              type="button"
              onClick={handleGetBooksList}
              disabled={booksListLoading}
              style={{ ...btnStyle("#ea580c"), padding: "4px 12px", fontSize: "12px" }}
            >
              {booksListLoading ? "Memuat..." : "🔄 Refresh Buku"}
            </button>
          </div>

          {booksListResult && Array.isArray(booksListResult) && booksListResult.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto", marginBottom: "10px" }}>
              {booksListResult.map((b: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "#fffaf5",
                    border: "1px solid #ffedd5",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#0f172a" }}>
                    <strong>{b.title}</strong> ({b.code}) — {b.totalCopies} Copy
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteCopyBookId(b.id);
                      handleLoadCopiesForDelete(b.id);
                    }}
                    style={{ ...btnStyle("#ea580c"), padding: "4px 8px", fontSize: "11px" }}
                  >
                    🔍 Cek Copies Buku Ini
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Klik tombol &quot;Refresh Buku&quot; di atas untuk memilih buku.
            </div>
          )}

          {/* STEP 2: DAFTAR COPIES BUKU */}
          {loadCopiesLoading && <p style={{ fontSize: "12px", color: "#ea580c" }}>Memuat daftar copies...</p>}
          {bookCopiesForDelete.length > 0 && (
            <div style={{ marginTop: "10px", borderTop: "1px dashed #fed7aa", paddingTop: "10px" }}>
              <span style={{ fontWeight: "bold", fontSize: "12px", color: "#9a3412" }}>
                2️⃣ Daftar Copy Tersedia:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                {bookCopiesForDelete.map((c: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #fdba74",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "12px", color: "#c2410c" }}>{c.code}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>
                        ID: {c.id} ({c.status})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteCopyId(c.id);
                      }}
                      style={{ ...btnStyle("#dc2626"), padding: "4px 8px", fontSize: "11px" }}
                    >
                      👉 Pilih Copy Ini
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleDeleteBookCopy} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Book ID:
            </label>
            <input
              type="text"
              value={deleteCopyBookId}
              onChange={(e) => setDeleteCopyBookId(e.target.value)}
              placeholder="Contoh: 6ab4a81234567890abcdef12"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Copy ID (ID Copy MongoDB yang Ingin Dihapus):
            </label>
            <input
              type="text"
              value={deleteCopyId}
              onChange={(e) => setDeleteCopyId(e.target.value)}
              placeholder="Contoh: 6ab4a81234567890abcdef13"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <button type="submit" disabled={deleteCopyLoading} style={btnStyle("#c2410c")}>
            {deleteCopyLoading ? "Menghapus Copy..." : "Eksekusi DELETE /catalog/books/{book_id}/copies/{copy_id}"}
          </button>
        </form>

        {deleteCopyError && (
          <div>
            <strong style={{ color: "#dc2626" }}>Error / Respon Gagal:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{deleteCopyError}</pre>
          </div>
        )}
        {deleteCopyResult && (
          <div>
            <strong style={{ color: "#166534" }}>Sukses Hapus Copy (Status: {deleteCopyResult.status}):</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0fdf4", color: "#166534" }}>
              {JSON.stringify(deleteCopyResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 15. TEST DELETE /member/{member_id} */}
      <section style={{ marginTop: "25px", borderTop: "2px solid #7c3aed", paddingTop: "15px", backgroundColor: "#faf5ff", padding: "16px", borderRadius: "8px" }}>
        <h3 style={{ color: "#6d28d9" }}>15. TEST DELETE /bukuflow/member/&#123;member_id&#125; (Hapus Anggota dari Backend) 👤🗑️</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>
          Menguji endpoint penghapusan member/anggota berdasarkan Member ID MongoDB.
        </p>

        {/* HELPER: DAFTAR MEMBER */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e9d5ff", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", fontSize: "13px", color: "#6d28d9" }}>
              👤 Pilih Anggota yang Ingin Dihapus:
            </span>
            <button
              type="button"
              onClick={() => handleSearchMember({ preventDefault: () => {} } as any)}
              disabled={searchLoading}
              style={{ ...btnStyle("#7c3aed"), padding: "4px 12px", fontSize: "12px" }}
            >
              {searchLoading ? "Memuat..." : "🔄 Cari / Refresh Member"}
            </button>
          </div>

          {membersResult && Array.isArray(membersResult) && membersResult.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
              {membersResult.map((m: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "13px", color: "#4c1d95" }}>
                      {m.name} ({m.memberNumber || "-"})
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      NIK: {m.identityNumber || "-"} | Telp: {m.phone || "-"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                      Member ID: {m.id}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteMemberId(m.id);
                    }}
                    style={{ ...btnStyle("#7c3aed"), padding: "6px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                  >
                    👉 Pilih Anggota Ini
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Ketik huruf di Section No. 5 lalu klik &quot;Cari Member&quot; untuk menampilkan daftar anggota.
            </div>
          )}
        </div>

        <form onSubmit={handleDeleteMember} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Member ID (ID Anggota MongoDB):
            </label>
            <input
              type="text"
              value={deleteMemberId}
              onChange={(e) => setDeleteMemberId(e.target.value)}
              placeholder="Contoh: 6ab4a81234567890abcdef12"
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
            />
          </div>

          <button type="submit" disabled={deleteMemberLoading} style={btnStyle("#6d28d9")}>
            {deleteMemberLoading ? "Menghapus Anggota..." : "Eksekusi DELETE /member/{member_id}"}
          </button>
        </form>

        {deleteMemberError && (
          <div>
            <strong style={{ color: "#dc2626" }}>Error / Respon Gagal:</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#fee2e2", color: "#dc2626" }}>{deleteMemberError}</pre>
          </div>
        )}
        {deleteMemberResult && (
          <div>
            <strong style={{ color: "#166534" }}>Sukses Hapus Member (Status: {deleteMemberResult.status}):</strong>
            <pre style={{ ...codeStyle, backgroundColor: "#f0fdf4", color: "#166534" }}>
              {JSON.stringify(deleteMemberResult, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

const btnStyle = (bg: string) => ({
  padding: "8px 16px",
  backgroundColor: bg,
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold" as const,
});

const codeStyle = {
  backgroundColor: "#f1f5f9",
  padding: "10px",
  borderRadius: "6px",
  marginTop: "10px",
  overflowX: "auto" as const,
};