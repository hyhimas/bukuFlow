import type { UserRole } from "./types";

export function isSupportedRole(role: UserRole): boolean {
  return role === "COMPANY_ADMIN" || role === "STAFF";
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

export function canAccessCompanySettings(): boolean {
  return false;
}

export function canAccessUserManagement(): boolean {
  return false;
}
