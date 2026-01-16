(() => {
  const panel = document.getElementById("pulseBoard");

  const viewSelect = document.getElementById("pulseBoardView");
  const listEl = document.getElementById("pulseBoardList");
  const form = document.getElementById("pulseBoardForm");
  const titleInput = document.getElementById("pulseTaskTitle");
  const kindSelect = document.getElementById("pulseTaskKind");
  const projectInput = document.getElementById("pulseTaskProject");
  const statusEl = document.getElementById("pulseBoardStatus");

  const VIEW_KEY = "ht.pulseboard.view.v1";
  const FUTURE_KEY = "ht.pulseboard.future.v1";

  let dayIsoOverride = null;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function localIsoDate(d = new Date()) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function resolveDayIso() {
    return String(dayIsoOverride || localIsoDate());
  }

  function dailyKey() {
    return `ht.pulseboard.daily.${resolveDayIso()}.v1`;
  }

  function safeJsonParse(value, fallback) {
    try {
      if (!value) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSelectedView() {
    const saved = (localStorage.getItem(VIEW_KEY) || "").toUpperCase();
    if (saved === "FUTURE" || saved === "TODAY") return saved;
    return "TODAY";
  }

  function setSelectedView(next) {
    const v = next === "FUTURE" ? "FUTURE" : "TODAY";
    localStorage.setItem(VIEW_KEY, v);
    if (viewSelect) viewSelect.value = v;
  }

  function showStatus(message) {
    if (!statusEl) return;
    statusEl.classList.remove("d-none");
    statusEl.textContent = message;
  }

  function clearStatus() {
    if (!statusEl) return;
    statusEl.classList.add("d-none");
    statusEl.textContent = "";
  }

  function getStoreKeyForView(view) {
    return view === "FUTURE" ? FUTURE_KEY : dailyKey();
  }

  function loadTasks(key) {
    const raw = safeJsonParse(localStorage.getItem(key), null);
    if (!Array.isArray(raw)) return [];
    return raw.filter((t) => t && typeof t === "object");
  }

  function saveTasks(key, tasks) {
    saveJson(key, tasks);
  }

  function makeId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function kindLabel(kind) {
    return kind === "PROJECT" ? "Project" : "24h";
  }

  function kindBadgeClass(kind) {
    return kind === "PROJECT" ? "pulse-badge is-project" : "pulse-badge is-quick";
  }

  function sanitizeForStorage(task) {
    const title = String(task?.title || "").trim();
    if (!title) return null;
    const kind = task?.kind === "PROJECT" ? "PROJECT" : "QUICK_24H";
    const projectName = String(task?.projectName || "").trim();
    return {
      id: String(task?.id || makeId()),
      title,
      kind,
      projectName: projectName || null,
      completed: Boolean(task?.completed)
    };
  }

  function tasksForSaveOrNull() {
    const key = dailyKey();
    const raw = localStorage.getItem(key);
    if (raw == null) return null;

    const tasks = loadTasks(key)
      .map(sanitizeForStorage)
      .filter(Boolean)
      .map((t) => ({
        title: t.title,
        kind: t.kind,
        projectName: t.projectName,
        completed: Boolean(t.completed)
      }));

    return tasks;
  }

  function render() {
    if (!panel || !listEl) return;
    clearStatus();

    const view = getSelectedView();
    const key = getStoreKeyForView(view);
    const tasks = loadTasks(key).map(sanitizeForStorage).filter(Boolean);

    listEl.innerHTML = "";

    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.style.fontSize = "12px";
      empty.style.fontWeight = "800";
      empty.textContent = view === "FUTURE" ? "No future tasks" : "No 24h tasks";
      listEl.appendChild(empty);
      return;
    }

    for (const task of tasks) {
      const row = document.createElement("div");
      row.className = `pulse-item ${task.completed ? "is-complete" : ""}`;

      const boxWrap = document.createElement("div");
      boxWrap.className = "form-check m-0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input mt-1";
      checkbox.checked = Boolean(task.completed);
      checkbox.addEventListener("change", () => {
        const next = loadTasks(key).map(sanitizeForStorage).filter(Boolean);
        const idx = next.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          next[idx].completed = Boolean(checkbox.checked);
          saveTasks(key, next);
        }
        render();
      });
      boxWrap.appendChild(checkbox);

      const mid = document.createElement("div");
      const title = document.createElement("div");
      title.className = "pulse-item__title";
      title.textContent = task.title;

      const meta = document.createElement("div");
      meta.className = "pulse-item__meta";
      const badge = document.createElement("span");
      badge.className = kindBadgeClass(task.kind);
      badge.textContent = kindLabel(task.kind);
      meta.appendChild(badge);
      if (task.projectName) {
        const p = document.createElement("span");
        p.className = "pulse-badge";
        p.textContent = task.projectName;
        meta.appendChild(p);
      }

      mid.appendChild(title);
      mid.appendChild(meta);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "pulse-item__delete";
      del.title = "Delete";
      del.innerHTML = `<i class="bi bi-x-lg" aria-hidden="true"></i>`;
      del.addEventListener("click", () => {
        const next = loadTasks(key).map(sanitizeForStorage).filter(Boolean).filter((t) => t.id !== task.id);
        saveTasks(key, next);
        render();
      });

      row.appendChild(boxWrap);
      row.appendChild(mid);
      row.appendChild(del);
      listEl.appendChild(row);
    }
  }

  function syncFromDayEntry(entry) {
    const iso = entry?.date != null ? String(entry.date) : null;
    const tasks = Array.isArray(entry?.pulseTasks) ? entry.pulseTasks : null;
    if (!iso || !tasks || !tasks.length) return;

    dayIsoOverride = iso;
    const key = dailyKey();
    const sanitized = tasks.map(sanitizeForStorage).filter(Boolean);
    saveTasks(key, sanitized);
    render();
  }

  function setDayIso(iso) {
    if (!iso) return;
    dayIsoOverride = String(iso);
    render();
  }

  window.htPulseBoard = {
    setDayIso,
    syncFromDayEntry,
    getDailyTasksForSave: tasksForSaveOrNull
  };

  if (!panel) return;

  viewSelect?.addEventListener("change", () => {
    setSelectedView(viewSelect.value);
    render();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearStatus();

    const title = String(titleInput?.value || "").trim();
    if (!title) {
      showStatus("Task title is required.");
      return;
    }

    const kind = kindSelect?.value === "PROJECT" ? "PROJECT" : "QUICK_24H";
    const projectName = String(projectInput?.value || "").trim();
    if (kind === "PROJECT" && !projectName) {
      showStatus("Project name is required for Project tasks.");
      return;
    }

    const view = getSelectedView();
    const key = getStoreKeyForView(view);
    const tasks = loadTasks(key).map(sanitizeForStorage).filter(Boolean);
    tasks.unshift({
      id: makeId(),
      title,
      kind,
      projectName: projectName || null,
      completed: false
    });
    saveTasks(key, tasks);

    if (titleInput) titleInput.value = "";
    if (kindSelect) kindSelect.value = kind;
    if (projectInput && kind !== "PROJECT") projectInput.value = "";
    render();
  });

  kindSelect?.addEventListener("change", () => {
    const kind = kindSelect.value === "PROJECT" ? "PROJECT" : "QUICK_24H";
    if (projectInput) projectInput.placeholder = kind === "PROJECT" ? "Project name" : "Project (optional)";
  });

  setSelectedView(getSelectedView());
  render();
})();
