import axios from "axios";

const BASE_URL = "https://api.office.teknologikartu.com/bukuflow";

async function run() {
  console.log("=== 1. LOGGING IN TO BACKEND ===");
  let token = "";

  const credentials = [
    { email: "admin@bukuflow.id", password: "admin123" },
    { email: "staff@bukuflow.id", password: "admin123" },
    { email: "superadmin@bukuflow.id", password: "admin123" },
    { email: "admin@company-001.com", password: "admin123" },
  ];

  for (const cred of credentials) {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, cred);
      token = res.data?.access_token || res.data?.token || res.data?.data?.access_token;
      console.log(`Login SUCCESS with ${cred.email}! Token: ${token?.slice(0, 20)}...`);
      break;
    } catch (err) {
      console.log(`Login failed with ${cred.email}: ${err.response?.data?.detail || err.message}`);
    }
  }

  if (!token) {
    console.error("Could not obtain auth token!");
    return;
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  console.log("\n=== 2. FETCHING BOOKS & FINDING 'Buku Uji Integrasi 1' ===");
  const booksRes = await axios.get(`${BASE_URL}/catalog/books?page=1&size=50`, { headers: authHeaders });
  const books = booksRes.data?.items || booksRes.data || [];
  console.log(`Found ${books.length} books in catalog`);

  const targetBook = books.find((b) => 
    b.title?.toLowerCase().includes("uji integrasi 1") ||
    b.code?.toLowerCase().includes("test-1011")
  );

  let bookId = "";
  if (targetBook) {
    bookId = targetBook._id || targetBook.id;
    console.log(`Target Book: [${bookId}] ${targetBook.code} | Title: "${targetBook.title}" | Status: ${targetBook.status}`);
  } else {
    console.log("All books:");
    books.forEach(b => console.log(`- [${b._id || b.id}] ${b.code} : ${b.title}`));
  }

  if (bookId) {
    console.log(`\n=== 3. FETCHING ALL COPIES FOR '${targetBook.title}' (${bookId}) ===`);
    const copiesRes = await axios.get(`${BASE_URL}/catalog/books/${bookId}/copies`, { headers: authHeaders });
    const copies = copiesRes.data?.items || copiesRes.data?.copies || copiesRes.data || [];
    console.log(`Total copies returned by BE: ${copies.length}`);
    copies.forEach((c, idx) => {
      console.log(`  [Copy ${idx + 1}] ID: ${c._id || c.id} | Code: ${c.copy_code || c.code} | Status: ${c.status} | Updated: ${c.updated_at || c.updatedAt}`);
    });
  }

  console.log("\n=== 4. FETCHING ALL LOANS / TRANSACTIONS ===");
  const loansRes = await axios.get(`${BASE_URL}/loan?page=1&size=50`, { headers: authHeaders });
  const loans = loansRes.data?.items || loansRes.data || [];
  console.log(`Total loans returned by BE: ${loans.length}`);
  
  loans.forEach((l) => {
    const loanNum = l.loan_number || l.loanNumber || l.id;
    const items = l.items || l.loan_items || l.details || [];
    console.log(`\nLoan: ${loanNum} | Status: ${l.status} | BorrowedAt: ${l.borrowed_at} | DueAt: ${l.due_at} | ReturnedAt: ${l.returned_at}`);
    items.forEach((it, idx) => {
      console.log(`  Item ${idx + 1}: Book: "${it.book_title || it.title || it.book?.title}" | Copy: ${it.copy_code || it.copy?.code || it.book_copy?.code || it.copy_id || it.book_copy_id} | Status: ${it.status || it.loan_status || it.is_returned}`);
    });
  });

  console.log("\n=== 5. FETCHING ACTIVE RETURNS (/loan/returns/active) ===");
  try {
    const returnsRes = await axios.get(`${BASE_URL}/loan/returns/active`, { headers: authHeaders });
    console.log("Active returns response:", JSON.stringify(returnsRes.data, null, 2));
  } catch (err) {
    console.log("Active returns error:", err.response?.data || err.message);
  }
}

run();

