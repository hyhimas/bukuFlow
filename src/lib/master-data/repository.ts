import {
  createMember,
  createBook,
  getBookCopies,
  searchMembers,
  searchBooks,
} from "@/lib/mock-api";

import type {
  Book,
  BookCopy,
  Member,
  MemberStatus,
  BookStatus,
  BookCopyStatus,
} from "@/lib/types";

import type {
  MemberListInput,
  CreateMemberInput,
  UpdateMemberInput,
  ChangeMemberStatusInput,
  BookListInput,
  CreateBookInput,
  UpdateBookInput,
  ChangeBookStatusInput,
  BookCopyListInput,
  CreateBookCopyInput,
  ChangeBookCopyStatusInput,
  PaginatedResult,
  MutationResult,
} from "./types";

/**
 * Repository Master Data
 *
 * UI hanya berkomunikasi dengan repository ini.
 * Implementasi sekarang menggunakan mock API.
 */
export const masterDataRepository = {
  /**
   * MEMBER
   */

  async listMembers(
    input: MemberListInput = {},
  ): Promise<PaginatedResult<Member>> {
    const members = await searchMembers(input.search ?? "");

    const filtered =
      input.status !== undefined
        ? members.filter((member) => member.status === input.status)
        : members;

    return paginate(
      filtered,
      input.page ?? 1,
      input.pageSize ?? 10,
    );
  },

  async getMember(id: string): Promise<Member | null> {
    const members = await searchMembers("");

    return members.find((member) => member.id === id) ?? null;
  },

  async createMember(
    input: CreateMemberInput,
  ): Promise<MutationResult<Member>> {
    const member = await createMember({
      ...input,
      memberType: "UMUM",
      status: "ACTIVE",
    });

    return {
      data: member,
      message: "Member berhasil dibuat.",
    };
  },

  async updateMember(
    id: string,
    input: UpdateMemberInput,
  ): Promise<MutationResult<Member>> {
    throw new Error(
      `Update member ${id} belum tersedia di mock API.`,
    );
  },

  async changeMemberStatus(
    id: string,
    input: ChangeMemberStatusInput,
  ): Promise<MutationResult<Member>> {
    throw new Error(
      `Perubahan status member ${id} belum tersedia di mock API.`,
    );
  },

  /**
   * BOOK
   */

  async listBooks(
    input: BookListInput = {},
  ): Promise<PaginatedResult<Book>> {
    const books = await searchBooks(input.search ?? "");

    const filtered =
      input.status !== undefined
        ? books.filter((book) => book.status === input.status)
        : books;

    return paginate(
      filtered,
      input.page ?? 1,
      input.pageSize ?? 10,
    );
  },

  async getBook(id: string): Promise<Book | null> {
    const books = await searchBooks("");

    return books.find((book) => book.id === id) ?? null;
  },

  async createBook(
    input: CreateBookInput,
  ): Promise<MutationResult<Book>> {
    const book = await createBook(input);

    return {
      data: book,
      message: "Buku berhasil dibuat.",
    };
  },

  async updateBook(
    id: string,
    input: UpdateBookInput,
  ): Promise<MutationResult<Book>> {
    throw new Error(
      `Update buku ${id} belum tersedia di mock API.`,
    );
  },

  async changeBookStatus(
    id: string,
    input: ChangeBookStatusInput,
  ): Promise<MutationResult<Book>> {
    throw new Error(
      `Perubahan status buku ${id} belum tersedia di mock API.`,
    );
  },

  /**
   * BOOK COPY
   */

  async listBookCopies(
    input: BookCopyListInput = {},
  ): Promise<PaginatedResult<BookCopy>> {
    if (!input.bookId) {
      return paginate([], input.page ?? 1, input.pageSize ?? 10);
    }

    const copies = await getBookCopies(input.bookId);

    const filtered =
      input.status !== undefined
        ? copies.filter((copy) => copy.status === input.status)
        : copies;

    return paginate(
      filtered,
      input.page ?? 1,
      input.pageSize ?? 10,
    );
  },

  async getBookCopy(id: string): Promise<BookCopy | null> {
    throw new Error(
      `Detail copy ${id} belum tersedia di mock API.`,
    );
  },

  async createBookCopy(
    input: CreateBookCopyInput,
  ): Promise<MutationResult<BookCopy>> {
    throw new Error(
      `Penambahan copy untuk buku ${input.bookId} belum tersedia di mock API.`,
    );
  },

  async changeBookCopyStatus(
    id: string,
    input: ChangeBookCopyStatusInput,
  ): Promise<MutationResult<BookCopy>> {
    throw new Error(
      `Perubahan status copy ${id} belum tersedia di mock API.`,
    );
  },
};

/**
 * Pagination helper
 */
function paginate<T>(
  data: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    data: data.slice(start, end),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}