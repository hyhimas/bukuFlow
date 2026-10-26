// Master Data Repository connecting directly to Backend API

import {
  getMembersPaginatedApi,
  searchMembersApi,
  getMemberApi,
  createMemberApi,
  updateMemberApi,
  changeMemberStatusApi,
  searchBooksApi,
  getBooksPaginatedApi,
  createBookApi,
  getBookApi,
  updateBookApi,
  changeBookStatusApi,
  getBookCopiesApi,
  createBookCopiesBulkApi,
  changeBookCopyStatusApi,
} from "@/lib/api";

import type {
  Book,
  BookCopy,
  Member,
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
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 10;

    if (keyword.length > 0) {
      const members = await searchMembersApi(keyword);
      const sorted = [...members];
      if (input.sortby === "name") {
        sorted.sort((a, b) =>
          input.order === "desc"
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name)
        );
      }
      return paginate(
        sorted,
        page,
        pageSize,
      );
    }

    const res = await getMembersPaginatedApi({
      page,
      size: pageSize,
      sortby: input.sortby ?? "name",
      order: input.order ?? "asc",
    });

    return {
      data: res.items,
      total: res.total,
      page: res.page,
      pageSize: res.size,
      totalPages: res.totalPages,
    };
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
      memberNumber: input.memberNumber,
      phone: input.phone,
      identityNumber: input.identityNumber,
      email: input.email,
    });

    return {
      data: member,
      message: "Anggota berhasil dibuat.",
    };
  },

  async updateMember(
    id: string,
    input: UpdateMemberInput,
  ): Promise<MutationResult<Member>> {
    const member = await updateMemberApi(id, input);

    return {
      data: member,
      message: "Anggota berhasil diperbarui.",
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
          ? "Anggota berhasil diaktifkan."
          : "Anggota berhasil dinonaktifkan.",
    };
  },

  /**
   * BOOK
   */

  async listBooks(
    input: BookListInput = {},
  ): Promise<PaginatedResult<Book>> {
    const keyword = input.search?.trim() ?? "";
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 10;
    const sortby = input.sortby ?? "title";
    const order = input.order ?? "asc";

    if (keyword.length > 0) {
      const books = await searchBooksApi(keyword);
      const sorted = [...books];

      if (sortby === "title") {
        sorted.sort((a, b) =>
          order === "desc"
            ? b.title.localeCompare(a.title)
            : a.title.localeCompare(b.title)
        );
      } else if (sortby === "code") {
        sorted.sort((a, b) =>
          order === "desc"
            ? b.code.localeCompare(a.code)
            : a.code.localeCompare(b.code)
        );
      }

      return paginate(
        sorted,
        page,
        pageSize,
      );
    }

    const res = await getBooksPaginatedApi({
      page,
      size: pageSize,
      sortby,
      order,
    });

    return {
      data: res.items,
      total: res.total,
      page: res.page,
      pageSize: res.size,
      totalPages: res.totalPages,
    };
  },

  async getBook(id: string, companyId?: string): Promise<Book | null> {
    return await getBookApi(id, companyId);
  },

  async createBook(
    input: CreateBookInput,
  ): Promise<MutationResult<Book>> {
    const book = await createBookApi(input, input.companyId);

    return {
      data: book,
      message: "Buku berhasil dibuat.",
    };
  },

  async updateBook(
    id: string,
    input: UpdateBookInput,
  ): Promise<MutationResult<Book>> {
    const book = await updateBookApi(id, input, input.companyId);

    return {
      data: book,
      message: "Buku berhasil diperbarui.",
    };
  },

  async changeBookStatus(
    id: string,
    input: ChangeBookStatusInput,
  ): Promise<MutationResult<Book>> {
    const book = await changeBookStatusApi(id, input.status, input.companyId);

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

    const copies = await getBookCopiesApi(input.bookId, input.companyId);

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
    const copies = await createBookCopiesBulkApi(input.bookId, count, input.companyId);
    const firstCopy = copies[0];

    return {
      data: firstCopy,
      message:
        count > 1
          ? `${count} eksemplar buku berhasil ditambahkan.`
          : `Eksemplar ${firstCopy.code} berhasil ditambahkan.`,
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
      input.companyId,
    );

    return {
      data: copy,
      message: `Status eksemplar ${copy.code} berhasil diubah.`,
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