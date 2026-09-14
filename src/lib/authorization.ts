import type {UserRole} from "./types";

export function canAccessMasterData(role: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export function canManageMasterData(role: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export function canManageLoans(role: UserRole): boolean {
  return role === "STAFF";
}

export function canManageReturns(role: UserRole): boolean {
  return role === "STAFF";
}

export function canAccessCompanySettings(role: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}

export function canAccessUserManagement(role: UserRole): boolean {
  return role === "COMPANY_ADMIN";
}