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
  return isSupportedRole(role);
}

export function canManageReturns(role: UserRole): boolean {
  return role === "STAFF";
}

export function canAccessReturns(role: UserRole): boolean {
  return isSupportedRole(role);
}

export function canAccessTransactions(role: UserRole): boolean {
  return isSupportedRole(role);
}

export function canAccessCompanySettings(role?: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
}

export function canAccessUserManagement(role?: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
}
