const LOGIN_USER = "admin";
const LOGIN_PASS = "library123";

const storageKeys = {
  books: "digitalLibrary.books",
  borrowed: "digitalLibrary.borrowed",
  returned: "digitalLibrary.returned",
  auth: "digitalLibrary.auth"
};

const state = {
  books: readStorage(storageKeys.books, []),
  borrowed: readStorage(storageKeys.borrowed, []),
  returned: readStorage(storageKeys.returned, [])
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  seedSampleData();
  bindEvents();
  setTodayDefaults();
  renderAll();

  if (localStorage.getItem(storageKeys.auth) === "true") {
    showDashboard();
  } else {
    showLogin();
  }
});

function bindEvents() {
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#logoutBtn").addEventListener("click", handleLogout);
  $("#menuToggle").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $("#bookForm").addEventListener("submit", handleBookSubmit);
  $("#issueForm").addEventListener("submit", handleIssueSubmit);
  $("#cancelEditBtn").addEventListener("click", resetBookForm);

  $("#bookSearch").addEventListener("input", renderBooksTable);
  $("#categoryFilter").addEventListener("change", renderBooksTable);
  $("#borrowedSearch").addEventListener("input", renderBorrowedTable);
  $("#historySearch").addEventListener("input", renderHistoryTable);

  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
  });

  $$("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.jump));
  });
}

function handleLogin(event) {
  event.preventDefault();
  const username = $("#username").value.trim();
  const password = $("#password").value.trim();
  const error = $("#loginError");

  if (!username || !password) {
    error.textContent = "Enter both username and password.";
    return;
  }

  if (username === LOGIN_USER && password === LOGIN_PASS) {
    localStorage.setItem(storageKeys.auth, "true");
    error.textContent = "";
    $("#loginForm").reset();
    showDashboard();
    toast("Welcome back, librarian.");
    return;
  }

  error.textContent = "Invalid librarian credentials.";
}

function handleLogout() {
  localStorage.removeItem(storageKeys.auth);
  showLogin();
  toast("Logged out successfully.");
}

function showLogin() {
  $("#loginPage").classList.remove("is-hidden");
  $("#app").classList.add("is-hidden");
}

function showDashboard() {
  $("#loginPage").classList.add("is-hidden");
  $("#app").classList.remove("is-hidden");
  showSection("homeSection");
}

function showSection(sectionId) {
  $$(".content-section").forEach((section) => section.classList.toggle("active", section.id === sectionId));
  $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
  $("#pageTitle").textContent = document.querySelector(`[data-section="${sectionId}"]`)?.textContent || "Dashboard";
  $(".sidebar").classList.remove("open");
}

function handleBookSubmit(event) {
  event.preventDefault();
  const editingId = $("#editingBookId").value;
  const book = {
    id: editingId || crypto.randomUUID(),
    name: cleanText($("#bookName").value),
    author: cleanText($("#authorName").value),
    category: $("#category").value,
    bookId: cleanText($("#bookId").value).toUpperCase(),
    quantity: Number($("#quantity").value)
  };

  if (!book.name || !book.author || !book.category || !book.bookId || !Number.isInteger(book.quantity) || book.quantity < 1) {
    toast("Please complete every book field with valid data.");
    return;
  }

  const duplicate = state.books.some((item) => item.bookId === book.bookId && item.id !== editingId);
  if (duplicate) {
    toast("A book with this Book ID already exists.");
    return;
  }

  if (editingId) {
    state.books = state.books.map((item) => (item.id === editingId ? book : item));
    toast("Book record updated.");
  } else {
    state.books.unshift(book);
    toast("Book added to the library.");
  }

  saveStorage(storageKeys.books, state.books);
  resetBookForm();
  renderAll();
}

function editBook(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;

  $("#editingBookId").value = book.id;
  $("#bookName").value = book.name;
  $("#authorName").value = book.author;
  $("#category").value = book.category;
  $("#bookId").value = book.bookId;
  $("#quantity").value = book.quantity;
  $("#bookFormTitle").textContent = "Edit Book Record";
  $("#bookForm button[type='submit']").textContent = "Update Book";
  $("#cancelEditBtn").classList.remove("is-hidden");
  showSection("booksSection");
}

function deleteBook(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;

  const activeBorrowed = state.borrowed.some((record) => record.bookId === book.bookId);
  if (activeBorrowed) {
    toast("Return active borrowed copies before deleting this book.");
    return;
  }

  if (!confirm(`Delete "${book.name}" from the catalog?`)) return;

  state.books = state.books.filter((item) => item.id !== id);
  saveStorage(storageKeys.books, state.books);
  renderAll();
  toast("Book deleted.");
}

function resetBookForm() {
  $("#bookForm").reset();
  $("#editingBookId").value = "";
  $("#bookFormTitle").textContent = "Add Available Book";
  $("#bookForm button[type='submit']").textContent = "Add Book";
  $("#cancelEditBtn").classList.add("is-hidden");
}

function handleIssueSubmit(event) {
  event.preventDefault();
  const record = {
    id: crypto.randomUUID(),
    studentName: cleanText($("#studentName").value),
    rollNumber: cleanText($("#rollNumber").value).toUpperCase(),
    department: cleanText($("#department").value),
    phone: cleanText($("#phone").value),
    bookName: cleanText($("#issueBookName").value),
    bookId: cleanText($("#issueBookId").value).toUpperCase(),
    issueDate: $("#issueDate").value,
    returnDate: $("#returnDate").value
  };

  if (!Object.values(record).every(Boolean)) {
    toast("Please complete every issue-book field.");
    return;
  }

  if (!/^[0-9]{10}$/.test(record.phone)) {
    toast("Phone number must be exactly 10 digits.");
    return;
  }

  if (record.returnDate < record.issueDate) {
    toast("Expected return date cannot be before the issue date.");
    return;
  }

  const book = state.books.find((item) => item.bookId === record.bookId && item.name.toLowerCase() === record.bookName.toLowerCase());
  if (!book) {
    toast("Book name and Book ID must match an available catalog record.");
    return;
  }

  const issuedCount = state.borrowed.filter((item) => item.bookId === record.bookId).length;
  if (issuedCount >= book.quantity) {
    toast("No available copies are left for this book.");
    return;
  }

  state.borrowed.unshift(record);
  saveStorage(storageKeys.borrowed, state.borrowed);
  $("#issueForm").reset();
  setTodayDefaults();
  renderAll();
  toast("Book issued successfully.");
}

function returnBook(id) {
  const record = state.borrowed.find((item) => item.id === id);
  if (!record) return;

  state.borrowed = state.borrowed.filter((item) => item.id !== id);
  state.returned.unshift({
    ...record,
    returnedOn: new Date().toISOString().slice(0, 10)
  });

  saveStorage(storageKeys.borrowed, state.borrowed);
  saveStorage(storageKeys.returned, state.returned);
  renderAll();
  toast("Book returned and moved to history.");
}

function renderAll() {
  renderStats();
  renderBooksTable();
  renderBorrowedTable();
  renderHistoryTable();
  renderMiniLists();
  renderDatalists();
  $("#loginBooksCount").textContent = state.books.length;
}

function renderStats() {
  const totalQuantity = state.books.reduce((sum, book) => sum + Number(book.quantity), 0);
  const borrowedQuantity = state.borrowed.length;
  const students = new Set(state.borrowed.map((record) => record.rollNumber));

  $("#totalBooks").textContent = state.books.length;
  $("#availableBooks").textContent = Math.max(totalQuantity - borrowedQuantity, 0);
  $("#borrowedBooks").textContent = borrowedQuantity;
  $("#returnedBooks").textContent = state.returned.length;
  $("#studentCount").textContent = students.size;
}

function renderBooksTable() {
  const query = $("#bookSearch").value?.toLowerCase() || "";
  const category = $("#categoryFilter").value;
  const rows = state.books.filter((book) => {
    const matchesQuery = [book.name, book.author, book.bookId].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (!category || book.category === category);
  });

  $("#booksTable").innerHTML = rows.length ? rows.map((book) => `
    <tr>
      <td>${escapeHtml(book.name)}</td>
      <td>${escapeHtml(book.author)}</td>
      <td>${escapeHtml(book.category)}</td>
      <td>${escapeHtml(book.bookId)}</td>
      <td>${availableCopies(book)} / ${book.quantity}</td>
      <td>
        <div class="row-actions">
          <button class="secondary-btn" type="button" onclick="editBook('${book.id}')">Edit</button>
          <button class="danger-btn" type="button" onclick="deleteBook('${book.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") : emptyRow(6, "No books found. Add a catalog record to begin.");
}

function renderBorrowedTable() {
  const query = $("#borrowedSearch").value?.toLowerCase() || "";
  const rows = state.borrowed.filter((record) =>
    [record.studentName, record.rollNumber, record.bookName, record.bookId].some((value) => value.toLowerCase().includes(query))
  );

  $("#borrowedTable").innerHTML = rows.length ? rows.map((record) => `
    <tr>
      <td>${escapeHtml(record.studentName)}</td>
      <td>${escapeHtml(record.rollNumber)}</td>
      <td>${escapeHtml(record.department)}</td>
      <td>${escapeHtml(record.phone)}</td>
      <td>${escapeHtml(record.bookName)}</td>
      <td>${escapeHtml(record.bookId)}</td>
      <td>${formatDate(record.issueDate)}</td>
      <td>${formatDate(record.returnDate)}</td>
      <td><button class="primary-btn" type="button" onclick="returnBook('${record.id}')">Return Book</button></td>
    </tr>
  `).join("") : emptyRow(9, "No active borrowed-book records.");
}

function renderHistoryTable() {
  const query = $("#historySearch").value?.toLowerCase() || "";
  const rows = state.returned.filter((record) =>
    [record.studentName, record.rollNumber, record.bookName, record.bookId].some((value) => value.toLowerCase().includes(query))
  );

  $("#historyTable").innerHTML = rows.length ? rows.map((record) => `
    <tr>
      <td>${escapeHtml(record.studentName)}</td>
      <td>${escapeHtml(record.rollNumber)}</td>
      <td>${escapeHtml(record.bookName)}</td>
      <td>${escapeHtml(record.bookId)}</td>
      <td>${formatDate(record.issueDate)}</td>
      <td>${formatDate(record.returnDate)}</td>
      <td>${formatDate(record.returnedOn)}</td>
    </tr>
  `).join("") : emptyRow(7, "Returned books will appear here.");
}

function renderMiniLists() {
  $("#recentBooks").innerHTML = state.books.slice(0, 4).map((book) => `
    <div class="mini-item">
      <strong>${escapeHtml(book.name)}</strong>
      <span>${escapeHtml(book.author)} · ${availableCopies(book)} available</span>
    </div>
  `).join("") || `<div class="empty-state">No books added yet.</div>`;

  $("#recentBorrowed").innerHTML = state.borrowed.slice(0, 4).map((record) => `
    <div class="mini-item">
      <strong>${escapeHtml(record.bookName)}</strong>
      <span>${escapeHtml(record.studentName)} · Due ${formatDate(record.returnDate)}</span>
    </div>
  `).join("") || `<div class="empty-state">No active loans right now.</div>`;
}

function renderDatalists() {
  $("#bookNameList").innerHTML = state.books.map((book) => `<option value="${escapeHtml(book.name)}"></option>`).join("");
  $("#bookIdList").innerHTML = state.books.map((book) => `<option value="${escapeHtml(book.bookId)}"></option>`).join("");
}

function availableCopies(book) {
  const issued = state.borrowed.filter((record) => record.bookId === book.bookId).length;
  return Math.max(Number(book.quantity) - issued, 0);
}

function emptyRow(columns, message) {
  return `<tr><td colspan="${columns}" class="empty-state">${message}</td></tr>`;
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setTodayDefaults() {
  const today = new Date();
  const due = new Date();
  due.setDate(today.getDate() + 14);
  $("#issueDate").value = today.toISOString().slice(0, 10);
  $("#returnDate").value = due.toISOString().slice(0, 10);
}

function cleanText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function toast(message) {
  const toastElement = $("#toast");
  toastElement.textContent = message;
  toastElement.classList.add("show");
  clearTimeout(toastElement.hideTimer);
  toastElement.hideTimer = setTimeout(() => toastElement.classList.remove("show"), 2600);
}

function seedSampleData() {
  if (state.books.length) return;

  state.books = [
    {
      id: crypto.randomUUID(),
      name: "Clean Code",
      author: "Robert C. Martin",
      category: "Computer Science",
      bookId: "CS-101",
      quantity: 6
    },
    {
      id: crypto.randomUUID(),
      name: "A Brief History of Time",
      author: "Stephen Hawking",
      category: "Science",
      bookId: "SC-204",
      quantity: 4
    },
    {
      id: crypto.randomUUID(),
      name: "The Intelligent Investor",
      author: "Benjamin Graham",
      category: "Business",
      bookId: "BS-312",
      quantity: 3
    }
  ];
  saveStorage(storageKeys.books, state.books);
}

window.editBook = editBook;
window.deleteBook = deleteBook;
window.returnBook = returnBook;
