const todosEl     = document.querySelector("#todo-list");
const form        = document.querySelector("#todo-form");
const formStatus  = document.querySelector("#form-status");
const listStatus  = document.querySelector("#list-status");
const backdrop    = document.querySelector("#modal-backdrop");
const modalBody   = document.querySelector("#modal-body");
const modalClose  = document.querySelector("#modal-close");

let currentFilter = "all";
let modalTodoId   = null;

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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
  });
}

function todoRow(todo) {
  const row = document.createElement("div");
  row.className = `todo ${todo.completed ? "done" : ""}`;
  row.innerHTML = `
    <input type="checkbox" class="todo-check" ${todo.completed ? "checked" : ""} aria-label="Toggle completed" />
    <span class="todo-title">${escapeHtml(todo.title)}</span>
    <span class="todo-date">${formatDeadline(todo.deadline)}</span>
  `;
  const checkbox = row.querySelector(".todo-check");
  checkbox.addEventListener("click", (event) => event.stopPropagation());
  checkbox.addEventListener("change", async () => {
    await updateDone(todo.id, checkbox.checked);
  });
  row.addEventListener("click", () => openModal(todo));
  return row;
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function openModal(todo) {
  modalTodoId = todo.id;
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
        <input class="modal-input" id="modal-deadline" type="datetime-local" step="3600" value="${toDatetimeLocal(todo.deadline)}" />
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

  document.querySelector("#modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const deadlineVal = document.querySelector("#modal-deadline").value;
    try {
      await api(`/api/v1/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: document.querySelector("#modal-title").value.trim(),
          description: document.querySelector("#modal-textarea").value.trim() || null,
          deadline: deadlineVal ? new Date(deadlineVal).toISOString() : null,
        }),
      });
      await loadTodos();
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

function closeModal() {
  backdrop.hidden = true;
  modalTodoId = null;
}

modalClose.addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

async function loadTodos() {
  setStatus(listStatus, "Loading...");
  const params = new URLSearchParams();
  if (currentFilter === "done")   params.set("completed", "true");
  if (currentFilter === "active") params.set("completed", "false");

  const payload = await api(`/api/v1/todos${params.toString() ? `?${params}` : ""}`);
  todosEl.replaceChildren(...payload.items.map(todoRow));

  if (!payload.items.length) {
    setStatus(listStatus, "No todos yet. Add one to get started.");
    return;
  }
  setStatus(listStatus, `Showing ${payload.total} todo(s).`);
}

async function updateDone(id, isDone) {
  await api(`/api/v1/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: isDone }),
  });
  await loadTodos();
}

async function removeTodo(id) {
  await api(`/api/v1/todos/${id}`, { method: "DELETE" });
  await loadTodos();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const deadlineValue = form.deadline.value;
    await api("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({
        title: form.title.value.trim(),
        description: form.description.value.trim() || null,
        deadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
      }),
    });
    form.reset();
    setStatus(formStatus, "Todo created.");
    await loadTodos();
  } catch (error) {
    setStatus(formStatus, error.message, true);
  }
});

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


loadTodos().catch((error) => setStatus(listStatus, error.message, true));
