// Master Data Repository connecting directly to Backend API

import {
  getMembersApi,
  searchMembersApi,
  getMemberApi,
  createMemberApi,
  updateMemberApi,
  changeMemberStatusApi,
  searchBooksApi,
  getBooksApi,
  createBookApi,
  getBookApi,
  updateBookApi,
  changeBookStatusApi,
  getBookCopiesApi,
  createBookCopyApi,
  createBookCopiesBulkApi,
  changeBookCopyStatusApi,
} from "@/lib/api";

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
 * Mengambil data member dan buku dari Backend API secara terintegrasi.
 */
export const masterDataRepository = {
  /**
   * MEMBER
   */

  async listMembers(
    input: MemberListInput = {},
  ): Promise<PaginatedResult<Member>> {
    const keyword = input.search?.trim() ?? "";
    const members =
      keyword.length > 0
        ? await searchMembersApi(keyword)
        : await getMembersApi();

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
    try {
      return await getMemberApi(id);
    } catch {
      return null;
    }
  },

  async createMember(
    input: CreateMemberInput,
  ): Promise<MutationResult<Member>> {
    const member = await createMemberApi({
      name: input.name,
      phone: input.phone,
      identityNumber: input.identityNumber,
      email: input.email,
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
    const member = await updateMemberApi(id, input);

    return {
      data: member,
      message: "Member berhasil diperbarui.",
    };
  },

  async changeMemberStatus(
    id: string,
    input: ChangeMemberStatusInput,
  ): Promise<MutationResult<Member>> {
    const member = await changeMemberStatusApi(id, input.status);

    return {
      data: member,
      message:
        input.status === "ACTIVE"
          ? "Member berhasil diaktifkan."
          : "Member berhasil dinonaktifkan.",
    };
  },

  /**
   * BOOK
   */

  async listBooks(
    input: BookListInput = {},
  ): Promise<PaginatedResult<Book>> {
    const keyword = input.search?.trim() ?? "";
    const books = keyword.length > 0
      ? await searchBooksApi(keyword)
      : await getBooksApi();

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
    return await getBookApi(id);
  },

  async createBook(
    input: CreateBookInput,
  ): Promise<MutationResult<Book>> {
    const book = await createBookApi(input);

    return {
      data: book,
      message: "Buku berhasil dibuat.",
    };
  },

  async updateBook(
    id: string,
    input: UpdateBookInput,
  ): Promise<MutationResult<Book>> {
    const book = await updateBookApi(id, input);

    return {
      data: book,
      message: "Buku berhasil diperbarui.",
    };
  },

  async changeBookStatus(
    id: string,
    input: ChangeBookStatusInput,
  ): Promise<MutationResult<Book>> {
    const book = await changeBookStatusApi(id, input.status);

    return {
      data: book,
      message:
        input.status === "AVAILABLE"
          ? "Buku berhasil diaktifkan."
          : "Buku berhasil diarsipkan.",
    };
  },

  /**
   * BOOK COPY
   */

  async listBookCopies(
    input: BookCopyListInput = {},
  ): Promise<PaginatedResult<BookCopy>> {
    if (!input.bookId) {
      return paginate(
        [],
        input.page ?? 1,
        input.pageSize ?? 10,
      );
    }

    const copies = await getBookCopiesApi(input.bookId);

    const filtered =
      input.status !== undefined
        ? copies.filter(
            (copy) => copy.status === input.status,
          )
        : copies;

    return paginate(
      filtered,
      input.page ?? 1,
      input.pageSize ?? 10,
    );
  },

  async getBookCopy(
    _id: string,
  ): Promise<BookCopy | null> {
    return null;
  },

  async createBookCopy(
    input: CreateBookCopyInput,
  ): Promise<MutationResult<BookCopy>> {
    const count = input.count ?? 1;
    const copies = await createBookCopiesBulkApi(input.bookId, count);
    const firstCopy = copies[0];

    return {
      data: firstCopy,
      message:
        count > 1
          ? `${count} copy buku berhasil ditambahkan.`
          : `Copy ${firstCopy.code} berhasil ditambahkan.`,
    };
  },

  async changeBookCopyStatus(
    id: string,
    input: ChangeBookCopyStatusInput,
  ): Promise<MutationResult<BookCopy>> {
    const bookId = input.bookId || "";
    const copy = await changeBookCopyStatusApi(
      bookId,
      id,
      input.status,
    );

    return {
      data: copy,
      message: `Status copy ${copy.code} berhasil diubah.`,
    };
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