import type {
  Book,
  BookCopy,
  BookCopyStatus,
  BookStatus,
  Member,
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
}

export interface CreateMemberInput {
  name: string;
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
}

export interface UpdateBookInput {
  title: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
}

export interface ChangeBookStatusInput {
  status: BookStatus;
}



/**
 * Book Copy
 */
export interface BookCopyListInput extends PaginationInput {
  bookId?: string;
  status?: BookCopyStatus;
}

export interface CreateBookCopyInput {
  bookId: string;
}

export interface ChangeBookCopyStatusInput {
  status: BookCopyStatus;
}

/**
 * Mutation result
 */
export interface MutationResult<T> {
  data: T;
  message: string;
}