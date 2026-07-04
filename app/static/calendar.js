const backdrop    = document.querySelector("#modal-backdrop");
const modalBody   = document.querySelector("#modal-body");
const modalClose  = document.querySelector("#modal-close");
const calGrid     = document.querySelector("#cal-grid");
const calListView = document.querySelector("#cal-list-view");
const calStatus   = document.querySelector("#cal-status");
const monthLabel  = document.querySelector("#month-label");

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

// ── Event detail modal (read-only) ────────────────────────────────────────────

function openEventDetailModal(ev) {
  const startD = new Date(ev.start_at);
  const endD   = ev.end_at ? new Date(ev.end_at) : null;
  const fmtDT  = (d) => d.toLocaleString("zh-Hant", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

  openModal(`
    <h2 class="modal-title">${escapeHtml(ev.title)}</h2>
    <div class="ev-detail-row">
      <span class="ev-detail-label">開始</span>
      <span>${fmtDT(startD)}</span>
    </div>
    ${endD ? `<div class="ev-detail-row">
      <span class="ev-detail-label">結束</span>
      <span>${fmtDT(endD)}</span>
    </div>` : ""}
    ${ev.description ? `<div class="ev-detail-row ev-detail-desc">
      <span class="ev-detail-label">說明</span>
      <span>${escapeHtml(ev.description)}</span>
    </div>` : ""}
  `);
}

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

  let eventsPayload;
  try {
    eventsPayload = await api(`/api/v1/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  } catch {
    eventsPayload = await api(`/api/v1/events/public?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  // Expand multi-day events: each event appears on every day it spans.
  const eventsByDate = {};
  for (const ev of eventsPayload.items) {
    const startDay = new Date(ev.start_at);
    startDay.setHours(0, 0, 0, 0);
    const endDay = ev.end_at ? new Date(ev.end_at) : new Date(startDay);
    endDay.setHours(0, 0, 0, 0);
    const cur = new Date(startDay);
    while (cur <= endDay) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      (eventsByDate[key] ??= []).push({ ev, isStart: cur.getTime() === startDay.getTime() });
      cur.setDate(cur.getDate() + 1);
    }
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
    const events = eventsByDate[key] || [];

    const cell = document.createElement("div");
    cell.className = `cal-cell${isToday ? " cal-today" : ""}`;

    const dateEl = document.createElement("span");
    dateEl.className = "cal-date";
    dateEl.textContent = day;
    cell.appendChild(dateEl);

    for (const { ev, isStart } of events) {
      const item = document.createElement("div");
      item.className = "cal-item cal-event-item";
      const timeStr = isStart
        ? new Date(ev.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "→";
      item.textContent = `${timeStr} ${ev.title}`;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        CALENDAR_EDITABLE ? openEventModal(ev) : openEventDetailModal(ev);
      });
      cell.appendChild(item);
    }

    if (CALENDAR_EDITABLE) {
      cell.title = "點擊新增行程";
      cell.addEventListener("click", () => {
        openEventModal(null, new Date(viewYear, viewMonth, day));
      });
    }

    calGrid.appendChild(cell);
  }

  renderList(eventsByDate);
  calStatus.textContent = eventsPayload.total ? `${eventsPayload.total} 個行程` : "本月無行程。";
}

// ── List view (mobile) ────────────────────────────────────────────────────────

function renderList(eventsByDate) {
  if (!calListView) return;
  calListView.innerHTML = "";

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let hasAny = false;

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${viewYear}-${viewMonth}-${day}`;
    const dayItems = eventsByDate[key];
    if (!dayItems || !dayItems.length) continue;
    hasAny = true;

    const isToday = key === todayKey;
    const dayLabel = new Date(viewYear, viewMonth, day).toLocaleDateString("zh-Hant", {
      month: "long", day: "numeric", weekday: "short",
    });

    const group = document.createElement("div");
    group.className = "cal-list-group";

    const dateEl = document.createElement("div");
    dateEl.className = `cal-list-date${isToday ? " cal-list-today" : ""}`;
    dateEl.textContent = isToday ? `今天　${dayLabel}` : dayLabel;
    group.appendChild(dateEl);

    for (const { ev, isStart } of dayItems) {
      const row = document.createElement("div");
      row.className = "cal-list-item";

      const timeEl = document.createElement("div");
      timeEl.className = "cal-list-time";
      timeEl.textContent = isStart
        ? new Date(ev.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "→";

      const dot = document.createElement("div");
      dot.className = "cal-list-dot";

      const info = document.createElement("div");
      info.className = "cal-list-info";

      const titleEl = document.createElement("div");
      titleEl.className = "cal-list-title";
      titleEl.textContent = ev.title;
      info.appendChild(titleEl);

      if (ev.end_at) {
        const range = document.createElement("div");
        range.className = "cal-list-range";
        const startD = new Date(ev.start_at);
        const endD   = new Date(ev.end_at);
        const sameDay = startD.toDateString() === endD.toDateString();
        if (isStart) {
          range.textContent = sameDay
            ? `${startD.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} – ${endD.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`
            : `${startD.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} – ${endD.toLocaleDateString("zh-Hant",{month:"numeric",day:"numeric"})} ${endD.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`;
        } else {
          range.textContent = `到 ${endD.toLocaleDateString("zh-Hant",{month:"numeric",day:"numeric"})} ${endD.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`;
        }
        info.appendChild(range);
      }

      row.appendChild(timeEl);
      row.appendChild(dot);
      row.appendChild(info);
      row.addEventListener("click", () => {
        CALENDAR_EDITABLE ? openEventModal(ev) : openEventDetailModal(ev);
      });
      group.appendChild(row);
    }

    calListView.appendChild(group);
  }

  if (!hasAny) {
    calListView.innerHTML = `<p class="cal-list-empty">本月無行程。</p>`;
  }
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
