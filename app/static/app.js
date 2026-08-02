const todosEl      = document.querySelector("#todo-list");
const form         = document.querySelector("#todo-form");
const formStatus   = document.querySelector("#form-status");
const listStatus   = document.querySelector("#list-status");
const backdrop     = document.querySelector("#modal-backdrop");
const modalBody    = document.querySelector("#modal-body");
const modalClose   = document.querySelector("#modal-close");
const catFilterEl  = document.querySelector("#category-filter");

let currentFilter   = "all";
let currentCategory = null;  // null = all categories

// ── API ───────────────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#ad2e24" : "";
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function formatDeadline(value) {
  if (!value) return "No deadline";
  return new Date(value).toLocaleString([], {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit",
  });
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Category colour ───────────────────────────────────────────────────────────

const CAT_COLORS = [
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#dcfce7", text: "#166534" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#ffedd5", text: "#9a3412" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fdf2f8", text: "#86198f" },
];

function catColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return CAT_COLORS[h % CAT_COLORS.length];
}

function catBadge(category) {
  if (!category) return "";
  const { bg, text } = catColor(category);
  return `<span class="cat-badge" style="background:${bg};color:${text}">${escapeHtml(category)}</span>`;
}

// ── Todo row ──────────────────────────────────────────────────────────────────

function todoRow(todo) {
  const row = document.createElement("div");
  row.className = `todo ${todo.completed ? "done" : ""}`;
  row.innerHTML = `
    <input type="checkbox" class="todo-check" ${todo.completed ? "checked" : ""} aria-label="Toggle completed" />
    <span class="todo-title">${escapeHtml(todo.title)}</span>
    ${catBadge(todo.category)}
    <span class="todo-date">${formatDeadline(todo.deadline)}</span>
  `;
  const checkbox = row.querySelector(".todo-check");
  checkbox.addEventListener("click", (e) => e.stopPropagation());
  checkbox.addEventListener("change", async () => { await updateDone(todo.id, checkbox.checked); });
  row.addEventListener("click", () => openModal(todo));
  return row;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(todo) {
  modalBody.innerHTML = `
    <form id="modal-form">
      <div class="modal-status">
        <span class="modal-status-dot" style="color:${todo.completed ? "var(--muted)" : "var(--accent)"}"></span>
        ${todo.completed ? "Completed" : "Active"}
      </div>
      <div class="modal-field">
        <label class="modal-label" for="modal-title">Title</label>
        <input class="modal-input" id="modal-title" value="${escapeHtml(todo.title)}" required maxlength="200" />
      </div>
      <div class="modal-field">
        <label class="modal-label" for="modal-textarea">Description</label>
        <textarea class="modal-textarea" id="modal-textarea" placeholder="Optional details">${escapeHtml(todo.description || "")}</textarea>
      </div>
      <div class="modal-field">
        <label class="modal-label" for="modal-deadline">Deadline</label>
        <input class="modal-input" id="modal-deadline" type="datetime-local" step="600" value="${toDatetimeLocal(todo.deadline)}" />
      </div>
      <div class="modal-field">
        <label class="modal-label" for="modal-category">Category</label>
        <input class="modal-input" id="modal-category" list="modal-category-list"
          maxlength="100" autocomplete="off"
          value="${escapeHtml(todo.category || "")}" placeholder="Work, Personal…" />
        <datalist id="modal-category-list"></datalist>
      </div>
      <div class="modal-meta">
        <span>Created: ${formatDate(todo.created_at)}</span>
        <span>Updated: ${formatDate(todo.updated_at)}</span>
      </div>
      <div class="modal-actions">
        <button class="primary" type="submit">Save</button>
        <button class="ghost" id="modal-toggle" type="button">${todo.completed ? "Mark active" : "Mark done"}</button>
        <button class="danger" id="modal-delete" type="button">Delete</button>
      </div>
      <div class="status" id="modal-status"></div>
    </form>
  `;

  // populate datalist in modal
  populateDatalist("modal-category-list");

  document.querySelector("#modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const deadlineVal  = document.querySelector("#modal-deadline").value;
    const categoryVal  = document.querySelector("#modal-category").value.trim();
    try {
      await api(`/api/v1/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title:       document.querySelector("#modal-title").value.trim(),
          description: document.querySelector("#modal-textarea").value.trim() || null,
          deadline:    deadlineVal ? new Date(deadlineVal).toISOString() : null,
          category:    categoryVal || null,
        }),
      });
      await refresh();
      closeModal();
    } catch (err) {
      setStatus(document.querySelector("#modal-status"), err.message, true);
    }
  });

  document.querySelector("#modal-toggle").addEventListener("click", async () => {
    await updateDone(todo.id, !todo.completed);
    closeModal();
  });
  document.querySelector("#modal-delete").addEventListener("click", async () => {
    await removeTodo(todo.id);
    closeModal();
  });

  backdrop.hidden = false;
}

function closeModal() { backdrop.hidden = true; }

modalClose.addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ── Categories ────────────────────────────────────────────────────────────────

let knownCategories = [];

async function loadCategories() {
  try {
    knownCategories = await api("/api/v1/todos/categories");
  } catch {
    knownCategories = [];
  }
  populateDatalist("category-list");
  renderCategoryFilter();
}

function populateDatalist(id) {
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.replaceChildren(...knownCategories.map((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    return opt;
  }));
}

function renderCategoryFilter() {
  if (!catFilterEl) return;
  catFilterEl.replaceChildren();
  if (!knownCategories.length) return;

  const all = document.createElement("button");
  all.className = `ghost cat-filter-btn${currentCategory === null ? " active" : ""}`;
  all.textContent = "All";
  all.addEventListener("click", () => { currentCategory = null; loadTodos(); renderCategoryFilter(); });
  catFilterEl.appendChild(all);

  for (const cat of knownCategories) {
    const btn = document.createElement("button");
    btn.className = `ghost cat-filter-btn${currentCategory === cat ? " active" : ""}`;
    const { bg, text } = catColor(cat);
    if (currentCategory === cat) {
      btn.style.background = bg;
      btn.style.color = text;
      btn.style.borderColor = text;
    }
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      currentCategory = currentCategory === cat ? null : cat;
      renderCategoryFilter();
      loadTodos();
    });
    catFilterEl.appendChild(btn);
  }
}

// ── Load / mutations ──────────────────────────────────────────────────────────

async function loadTodos() {
  setStatus(listStatus, "Loading...");
  const params = new URLSearchParams();
  if (currentFilter === "done")   params.set("completed", "true");
  if (currentFilter === "active") params.set("completed", "false");
  if (currentCategory)            params.set("category", currentCategory);

  const payload = await api(`/api/v1/todos${params.toString() ? `?${params}` : ""}`);
  todosEl.replaceChildren(...payload.items.map(todoRow));

  if (!payload.items.length) {
    const base = { all: "No todos yet.", active: "No active todos.", done: "No completed todos." }[currentFilter];
    const suffix = currentCategory ? ` in "${currentCategory}"` : "";
    setStatus(listStatus, base.replace(".", "") + suffix + ".");
    return;
  }
  setStatus(listStatus, `Showing ${payload.total} todo(s).`);
}

async function refresh() {
  await Promise.all([loadCategories(), loadTodos()]);
}

async function updateDone(id, isDone) {
  await api(`/api/v1/todos/${id}`, { method: "PATCH", body: JSON.stringify({ completed: isDone }) });
  await loadTodos();
}

async function removeTodo(id) {
  await api(`/api/v1/todos/${id}`, { method: "DELETE" });
  await refresh();
}

// ── Create form ───────────────────────────────────────────────────────────────

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const deadlineValue  = form.deadline.value;
    const categoryValue  = form.category.value.trim();
    await api("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({
        title:       form.title.value.trim(),
        description: form.description.value.trim() || null,
        deadline:    deadlineValue ? new Date(deadlineValue).toISOString() : null,
        category:    categoryValue || null,
      }),
    });
    form.reset();
    setStatus(formStatus, "Todo created.");
    await refresh();
  } catch (error) {
    setStatus(formStatus, error.message, true);
  }
});

// ── Status filter ─────────────────────────────────────────────────────────────

const filterButtons = document.querySelectorAll("[data-filter]");

function updateFilterUI() {
  filterButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === currentFilter);
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    currentFilter = button.dataset.filter;
    updateFilterUI();
    await loadTodos();
  });
});

updateFilterUI();
refresh().catch((err) => setStatus(listStatus, err.message, true));
