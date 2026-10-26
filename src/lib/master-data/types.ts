import type {
  BookCopyStatus,
  BookStatus,
  MemberStatus,
} from "@/lib/types";

/**
 * Pagination
 */
export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Member
 */
export interface MemberListInput extends PaginationInput {
  search?: string;
  status?: MemberStatus;
  sortby?: string;
  order?: "asc" | "desc";
}

export interface CreateMemberInput {
  name: string;
  memberNumber: string;
  phone: string;
  identityNumber: string;
  email?: string;
}

export interface UpdateMemberInput {
  name: string;
  phone: string;
  identityNumber: string;
  email?: string;
}

export interface ChangeMemberStatusInput {
  status: MemberStatus;
}

/**
 * Book
 */
export interface BookListInput extends PaginationInput {
  search?: string;
  status?: BookStatus;
  sortby?: string;
  order?: "asc" | "desc";
}

export interface CreateBookInput {
  code: string;
  title: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  totalCopies: number;
  companyId?: string;
}

export interface UpdateBookInput {
  title: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  companyId?: string;
}

export interface ChangeBookStatusInput {
  status: BookStatus;
  companyId?: string;
}



/**
 * Book Copy
 */
export interface BookCopyListInput extends PaginationInput {
  bookId?: string;
  status?: BookCopyStatus;
  companyId?: string;
}

export interface CreateBookCopyInput {
  bookId: string;
  count?: number;
  companyId?: string;
}

export interface ChangeBookCopyStatusInput {
  status: BookCopyStatus;
  bookId?: string;
  companyId?: string;
}

/**
 * Mutation result
 */
export interface MutationResult<T> {
  data: T;
  message: string;
}