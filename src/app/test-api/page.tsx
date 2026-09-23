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