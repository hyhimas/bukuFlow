import type { UserRole } from "./types";

export function isSuperAdmin(role?: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export function canAccessOffice(role?: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export function isSupportedRole(role: UserRole): boolean {
  return role === "COMPANY_ADMIN" || role === "STAFF" || role === "SUPER_ADMIN";
}

export function canAccessMasterData(role: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export function canManageMasterData(role: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export function canManageLoans(role: UserRole): boolean {
  return role === "STAFF";
}

export function canAccessLoans(role: UserRole): boolean {
  return role === "COMPANY_ADMIN" || role === "STAFF";
}

export function canManageReturns(role: UserRole): boolean {
  return role === "STAFF";
}

export function canAccessReturns(role: UserRole): boolean {
  return role === "COMPANY_ADMIN" || role === "STAFF";
}

export function canAccessTransactions(role: UserRole): boolean {
  return role === "COMPANY_ADMIN" || role === "STAFF";
}

export function canAccessCompanySettings(role?: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export function canAccessUserManagement(role?: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export interface RouteAccessResult {
  allowed: boolean;
  redirect: string;
}

export interface RouteRule {
  allowedRoles: UserRole[];
  getRedirect: (role: UserRole) => string;
}

/**
 * Peta Akses Terpusat: Rute -> Peran yang Diizinkan & Target Redirect jika ditolak
 */
export const ROUTE_ACCESS_MAP: Record<string, RouteRule> = {
  "/dashboard": {
    allowedRoles: ["COMPANY_ADMIN", "STAFF"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/login"),
  },
  "/loans": {
    // COMPANY_ADMIN melihat daftar peminjaman instansi.
    // STAFF dialihkan langsung ke /loans/new untuk form peminjaman baru operasional.
    allowedRoles: ["COMPANY_ADMIN"],
    getRedirect: (role) => {
      if (role === "STAFF") return "/loans/new";
      if (role === "SUPER_ADMIN") return "/office/dashboard";
      return "/dashboard";
    },
  },
  "/loans/new": {
    allowedRoles: ["STAFF"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/returns": {
    allowedRoles: ["COMPANY_ADMIN", "STAFF"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/transactions": {
    allowedRoles: ["COMPANY_ADMIN", "STAFF"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/master/books": {
    allowedRoles: ["COMPANY_ADMIN"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/master/members": {
    allowedRoles: ["COMPANY_ADMIN"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/settings/company": {
    allowedRoles: ["COMPANY_ADMIN"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/settings/users": {
    allowedRoles: ["COMPANY_ADMIN"],
    getRedirect: (role) => (role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"),
  },
  "/office/dashboard": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/office/companies": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/office/users": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/office/books": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/office/catalog": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/office/loans": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/office/members": {
    allowedRoles: ["SUPER_ADMIN"],
    getRedirect: () => "/dashboard",
  },
  "/profile": {
    allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "STAFF"],
    getRedirect: () => "/login",
  },
};

export function getRouteAccess(pathname: string, role?: UserRole): RouteAccessResult {
  if (!role || !isSupportedRole(role)) {
    return { allowed: false, redirect: "/login" };
  }

  // Exact match
  const exactRule = ROUTE_ACCESS_MAP[pathname];
  if (exactRule) {
    if (exactRule.allowedRoles.includes(role)) {
      return { allowed: true, redirect: "" };
    }
    return { allowed: false, redirect: exactRule.getRedirect(role) };
  }

  // Prefix matching untuk sub-rute
  if (pathname.startsWith("/office")) {
    if (role === "SUPER_ADMIN") {
      return { allowed: true, redirect: "" };
    }
    return { allowed: false, redirect: "/dashboard" };
  }

  if (pathname.startsWith("/master") || pathname.startsWith("/settings")) {
    if (role === "COMPANY_ADMIN") {
      return { allowed: true, redirect: "" };
    }
    return {
      allowed: false,
      redirect: role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard",
    };
  }

  if (pathname.startsWith("/loans/new")) {
    if (role === "STAFF") {
      return { allowed: true, redirect: "" };
    }
    return {
      allowed: false,
      redirect: role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard",
    };
  }

  if (pathname.startsWith("/loans")) {
    if (role === "COMPANY_ADMIN") {
      return { allowed: true, redirect: "" };
    }
    if (role === "STAFF") {
      return { allowed: false, redirect: "/loans/new" };
    }
    return {
      allowed: false,
      redirect: "/office/dashboard",
    };
  }

  if (pathname.startsWith("/returns") || pathname.startsWith("/transactions")) {
    if (role === "COMPANY_ADMIN" || role === "STAFF") {
      return { allowed: true, redirect: "" };
    }
    return {
      allowed: false,
      redirect: "/office/dashboard",
    };
  }

  if (pathname.startsWith("/profile")) {
    return { allowed: true, redirect: "" };
  }

  // Fallback untuk SUPER_ADMIN jika mencoba membuka rute operasional instansi
  if (role === "SUPER_ADMIN") {
    return { allowed: false, redirect: "/office/dashboard" };
  }

  return { allowed: true, redirect: "" };
}
