import {
  createMember,
  createBook,
  getBookCopies,
  getBookById,
  getBookCopy,
  updateBook,
  changeBookStatus,
  createBookCopy,
  changeBookCopyStatus,
  getMemberById,
  updateMember,
  changeMemberStatus,
} from "@/lib/mock-api";

import { searchMembersApi, searchBooksApi } from "@/lib/api";

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
 * Mengambil data member dari Backend API jika tersedia.
 */
export const masterDataRepository = {
  /**
   * MEMBER
   */

  async listMembers(
    input: MemberListInput = {},
  ): Promise<PaginatedResult<Member>> {
    const keyword = input.search ?? "";
    const members = await searchMembersApi(keyword);

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
      return await getMemberById(id);
    } catch {
      return null;
    }
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
  const member = await updateMember(id, input);

  return {
    data: member,
    message: "Member berhasil diperbarui.",
  };
},

  async changeMemberStatus(
  id: string,
  input: ChangeMemberStatusInput,
): Promise<MutationResult<Member>> {
  const member = await changeMemberStatus(id, input.status);

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
    const keyword = input.search ?? "";
    const books = await searchBooksApi(keyword);

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
  try {
    return await getBookById(id);
  } catch {
    return null;
  }
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
  const book = await updateBook(id, input);

  return {
    data: book,
    message: "Buku berhasil diperbarui.",
  };
},

async changeBookStatus(
  id: string,
  input: ChangeBookStatusInput,
): Promise<MutationResult<Book>> {
  const book = await changeBookStatus(
    id,
    input.status,
  );

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

  const copies = await getBookCopies(
    input.bookId,
  );

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
  id: string,
): Promise<BookCopy | null> {
  try {
    return await getBookCopy(id);
  } catch {
    return null;
  }
},

async createBookCopy(
  input: CreateBookCopyInput,
): Promise<MutationResult<BookCopy>> {
  const copy = await createBookCopy(input.bookId);

  return {
    data: copy,
    message: `Copy ${copy.code} berhasil ditambahkan.`,
  };
},

async changeBookCopyStatus(
  id: string,
  input: ChangeBookCopyStatusInput,
): Promise<MutationResult<BookCopy>> {
  const copy = await changeBookCopyStatus(
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