const backdrop   = document.querySelector("#modal-backdrop");
const modalBody  = document.querySelector("#modal-body");
const modalClose = document.querySelector("#modal-close");
const calGrid    = document.querySelector("#cal-grid");
const calStatus  = document.querySelector("#cal-status");
const monthLabel = document.querySelector("#month-label");

const now = new Date();
let viewYear  = now.getFullYear();
let viewMonth = now.getMonth();

// ── API helper ────────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function fmt(value) {
  return new Date(value).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function toLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(html, onMount) {
  modalBody.innerHTML = html;
  onMount?.();
  backdrop.hidden = false;
}

function closeModal() { backdrop.hidden = true; }

modalClose.addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ── Event modal ───────────────────────────────────────────────────────────────

function openEventModal(event = null, defaultDate = null) {
  const isNew = !event;
  const defaultStart = defaultDate
    ? (() => { const d = new Date(defaultDate); d.setHours(9, 0, 0, 0); return toLocal(d); })()
    : toLocal(event?.start_at);
  const defaultEnd = defaultDate
    ? (() => { const d = new Date(defaultDate); d.setHours(10, 0, 0, 0); return toLocal(d); })()
    : toLocal(event?.end_at);

  openModal(`
    <h2 class="modal-title">${isNew ? "新增行程" : "編輯行程"}</h2>
    <form id="event-form">
      <div class="modal-field">
        <label class="modal-label" for="ev-title">標題</label>
        <input class="modal-input" id="ev-title" value="${escapeHtml(event?.title ?? "")}" required maxlength="200" />
      </div>
      <div class="modal-field">
        <label class="modal-label" for="ev-desc">說明</label>
        <textarea class="modal-textarea" id="ev-desc" placeholder="選填">${escapeHtml(event?.description ?? "")}</textarea>
      </div>
      <div class="modal-field">
        <label class="modal-label" for="ev-start">開始時間</label>
        <input class="modal-input" id="ev-start" type="datetime-local" step="600" value="${defaultStart}" required />
      </div>
      <div class="modal-field">
        <label class="modal-label" for="ev-end">結束時間</label>
        <input class="modal-input" id="ev-end" type="datetime-local" step="600" value="${defaultEnd}" />
      </div>
      <div class="modal-actions">
        <button class="primary" type="submit">${isNew ? "建立" : "儲存"}</button>
        ${!isNew ? `<button class="danger" id="ev-delete" type="button">刪除</button>` : ""}
      </div>
      <div class="status" id="ev-status"></div>
    </form>
  `, () => {
    document.querySelector("#event-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const startVal = document.querySelector("#ev-start").value;
      const endVal   = document.querySelector("#ev-end").value;
      const body = {
        title:       document.querySelector("#ev-title").value.trim(),
        description: document.querySelector("#ev-desc").value.trim() || null,
        start_at:    new Date(startVal).toISOString(),
        end_at:      endVal ? new Date(endVal).toISOString() : null,
      };
      try {
        if (isNew) {
          await api("/api/v1/events", { method: "POST", body: JSON.stringify(body) });
        } else {
          await api(`/api/v1/events/${event.id}`, { method: "PATCH", body: JSON.stringify(body) });
        }
        closeModal();
        await loadCalendar();
      } catch (err) {
        const s = document.querySelector("#ev-status");
        s.textContent = err.message;
        s.style.color = "#ad2e24";
      }
    });

    document.querySelector("#ev-delete")?.addEventListener("click", async () => {
      await api(`/api/v1/events/${event.id}`, { method: "DELETE" });
      closeModal();
      await loadCalendar();
    });
  });
}

// ── Todo modal ────────────────────────────────────────────────────────────────

function openTodoModal(todo) {
  openModal(`
    <form id="todo-form">
      <div class="modal-status">
        <span class="modal-status-dot" style="color:${todo.completed ? "var(--muted)" : "var(--accent)"}"></span>
        ${todo.completed ? "Completed" : "Active"}
      </div>
      <div class="modal-field">
        <label class="modal-label" for="td-title">Title</label>
        <input class="modal-input" id="td-title" value="${escapeHtml(todo.title)}" required maxlength="200" />
      </div>
      <div class="modal-field">
        <label class="modal-label" for="td-desc">Description</label>
        <textarea class="modal-textarea" id="td-desc" placeholder="Optional details">${escapeHtml(todo.description || "")}</textarea>
      </div>
      <div class="modal-field">
        <label class="modal-label" for="td-deadline">Deadline</label>
        <input class="modal-input" id="td-deadline" type="datetime-local" step="600" value="${toLocal(todo.deadline)}" />
      </div>
      <div class="modal-actions">
        <button class="primary" type="submit">Save</button>
        <button class="ghost" id="td-toggle" type="button">${todo.completed ? "Mark active" : "Mark done"}</button>
        <button class="danger" id="td-delete" type="button">Delete</button>
      </div>
      <div class="status" id="td-status"></div>
    </form>
  `, () => {
    document.querySelector("#todo-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const dlVal = document.querySelector("#td-deadline").value;
      try {
        await api(`/api/v1/todos/${todo.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title:       document.querySelector("#td-title").value.trim(),
            description: document.querySelector("#td-desc").value.trim() || null,
            deadline:    dlVal ? new Date(dlVal).toISOString() : null,
          }),
        });
        closeModal();
        await loadCalendar();
      } catch (err) {
        const s = document.querySelector("#td-status");
        s.textContent = err.message;
        s.style.color = "#ad2e24";
      }
    });

    document.querySelector("#td-toggle").addEventListener("click", async () => {
      await api(`/api/v1/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !todo.completed }),
      });
      closeModal();
      await loadCalendar();
    });

    document.querySelector("#td-delete").addEventListener("click", async () => {
      await api(`/api/v1/todos/${todo.id}`, { method: "DELETE" });
      closeModal();
      await loadCalendar();
    });
  });
}

// ── Calendar render ───────────────────────────────────────────────────────────

async function loadCalendar() {
  const from = new Date(viewYear, viewMonth, 1).toISOString();
  const to   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();

  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  monthLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  const [todosPayload, eventsPayload] = await Promise.all([
    api(`/api/v1/todos?deadline_from=${encodeURIComponent(from)}&deadline_to=${encodeURIComponent(to)}`),
    api(`/api/v1/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  ]);

  // group by local "Y-M-D" key
  const todosByDate  = {};
  const eventsByDate = {};

  for (const todo of todosPayload.items) {
    const d = new Date(todo.deadline);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (todosByDate[key] ??= []).push(todo);
  }
  for (const ev of eventsPayload.items) {
    const d = new Date(ev.start_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (eventsByDate[key] ??= []).push(ev);
  }

  // remove previous day cells
  calGrid.querySelectorAll(".cal-cell, .cal-cell-empty").forEach(c => c.remove());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  let startOffset = new Date(viewYear, viewMonth, 1).getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  for (let i = 0; i < startOffset; i++) {
    const blank = document.createElement("div");
    blank.className = "cal-cell cal-cell-empty";
    calGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${viewYear}-${viewMonth}-${day}`;
    const isToday = key === todayKey;
    const todos  = todosByDate[key]  || [];
    const events = eventsByDate[key] || [];

    const cell = document.createElement("div");
    cell.className = `cal-cell${isToday ? " cal-today" : ""}`;
    cell.title = "點擊新增行程";

    const dateEl = document.createElement("span");
    dateEl.className = "cal-date";
    dateEl.textContent = day;
    cell.appendChild(dateEl);

    for (const ev of events) {
      const item = document.createElement("div");
      item.className = "cal-item cal-event-item";
      item.textContent = `${new Date(ev.start_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} ${ev.title}`;
      item.addEventListener("click", (e) => { e.stopPropagation(); openEventModal(ev); });
      cell.appendChild(item);
    }

    for (const todo of todos) {
      const item = document.createElement("div");
      item.className = `cal-item cal-todo-item${todo.completed ? " done" : ""}`;
      item.textContent = todo.title;
      item.addEventListener("click", (e) => { e.stopPropagation(); openTodoModal(todo); });
      cell.appendChild(item);
    }

    // click empty area of cell → new event
    cell.addEventListener("click", () => {
      openEventModal(null, new Date(viewYear, viewMonth, day));
    });

    calGrid.appendChild(cell);
  }

  const total = todosPayload.total + eventsPayload.total;
  calStatus.textContent = total ? `${eventsPayload.total} 行程・${todosPayload.total} todo` : "本月無行程與 todo。";
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.querySelector("#prev-btn").addEventListener("click", () => {
  if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
  loadCalendar();
});

document.querySelector("#next-btn").addEventListener("click", () => {
  if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
  loadCalendar();
});

loadCalendar();
