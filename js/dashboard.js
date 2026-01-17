(() => {
  const DRAFT_KEY = "ht.today.draft.v3";
  const AUTO_SAVE_ENABLED_KEY = "ht.autosave.enabled.v1";

  const taskList = document.getElementById("taskList");
  const taskEmptyState = document.getElementById("taskEmptyState");
  const welcomeName = document.getElementById("welcomeName");

  const todayDay = document.getElementById("todayDay");
  const todayDate = document.getElementById("todayDate");
  const todayYear = document.getElementById("todayYear");
  const liveTime = document.getElementById("liveTime");

  const dayTitle = document.getElementById("dashDayTitle");
  const daySubtitle = document.getElementById("dashDaySubtitle");
  const dashboardStatus = document.getElementById("dashboardStatus");
  const saveTodayBtn = document.getElementById("lockDayBtn");

  const dayProgress = document.getElementById("todayProgress");
  const dayProgressValue = document.getElementById("todayProgressValue");
  const dayProgressLabel = document.getElementById("todayProgressLabel");
  const dashboardStreak = document.getElementById("dashboardStreak");
  const dashboardThreshold = document.getElementById("dashboardThreshold");

  const prevMonthBtn = document.getElementById("dashPrevMonthBtn");
  const nextMonthBtn = document.getElementById("dashNextMonthBtn");
  const calendarTitle = document.getElementById("dashCalendarTitle");

  const monthRing = document.getElementById("dashMonthRing");
  const monthRingValue = document.getElementById("dashMonthRingValue");
  const monthRingLabel = document.getElementById("dashMonthRingLabel");
  const lineChartEl = document.getElementById("dashMonthlyLineChart");
  const barChartEl = document.getElementById("dashMonthlyBarChart");

  const monthCheckpointsScroll = document.getElementById("monthCheckpointsScroll");
  const monthCheckpointsHead = document.getElementById("monthCheckpointsHead");
  const monthCheckpointsBody = document.getElementById("monthCheckpointsBody");

  if (!monthCheckpointsBody) return;

  let profile = null;
  let todayEntry = null;
  let monthEntries = [];
  let monthEntryMap = new Map();
  let dailyStatsMap = new Map();
  let viewYear = null;
  let viewMonth = null;
  let selectedIso = null;

  let lineChart = null;
  let barChart = null;

  let draft = loadDraft();
  let autoSaveTimer = null;
  let isSaving = false;
  let peekedIso = null;
  let monthHoverWired = false;

  function setStatus(kind, message) {
    if (!dashboardStatus) return;
    dashboardStatus.classList.remove("d-none", "is-success", "is-error");
    dashboardStatus.classList.add(kind === "success" ? "is-success" : "is-error");
    dashboardStatus.textContent = message;
  }

  function clearStatus() {
    if (!dashboardStatus) return;
    dashboardStatus.classList.add("d-none");
    dashboardStatus.textContent = "";
  }

  function safeJsonParse(value, fallback) {
    try {
      if (!value) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function loadDraft() {
    const raw = safeJsonParse(sessionStorage.getItem(DRAFT_KEY), { byHabitId: {} });
    const next = raw && typeof raw === "object" ? raw : { byHabitId: {} };
    if (!next.byHabitId || typeof next.byHabitId !== "object") next.byHabitId = {};

    // Backward compat: older draft keys.
    if (Object.keys(next.byHabitId).length === 0) {
      const v2 = safeJsonParse(sessionStorage.getItem("ht.today.draft.v2"), null);
      const v1 = safeJsonParse(sessionStorage.getItem("ht.today.draft.v1"), null);
      if (v2?.byHabitId) next.byHabitId = v2.byHabitId;
      else if (v1?.byHabitId) next.byHabitId = v1.byHabitId;
    }

    // Normalize rows: keep only what dashboard edits.
    for (const [habitId, row] of Object.entries(next.byHabitId)) {
      if (!row || typeof row !== "object") {
        delete next.byHabitId[habitId];
        continue;
      }
      next.byHabitId[habitId] = {
        habitId: Number(row.habitId ?? habitId),
        completed: Boolean(row.completed),
        actualValue: row.actualValue ?? null
      };
    }

    return next;
  }

  function saveDraft() {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem("ht.today.draft.v2");
    sessionStorage.removeItem("ht.today.draft.v1");
    draft = { byHabitId: {} };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatCategoryLabel(raw) {
    const value = String(raw || "OTHER").trim();
    if (!value) return "Other";
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function toISODate(d) {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  function fromISODate(iso) {
    return new Date(`${iso}T00:00:00`);
  }

  function isSameISO(a, b) {
    return String(a || "") === String(b || "");
  }

  function isIsoInYearMonth(iso, year, month) {
    const s = String(iso || "");
    if (s.length < 7) return false;
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(5, 7));
    return y === Number(year) && m === Number(month);
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function monthName(year, month) {
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function clampPercent(n) {
    const v = Number.isFinite(n) ? n : 0;
    return Math.max(0, Math.min(100, v));
  }

  function destroyChart(chart) {
    try {
      chart?.destroy();
    } catch {
      // ignore
    }
  }

  function setRing(el, valueEl, labelEl, percent, label) {
    const p = Math.round(clampPercent(percent));
    el?.style.setProperty("--p", String(p));
    if (valueEl) valueEl.textContent = `${p}%`;
    if (labelEl) labelEl.textContent = label;
  }

  function pop(el, className, durationMs = 260) {
    if (!el) return;
    el.classList.remove(className);
    // force reflow to restart animation
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => el.classList.remove(className), durationMs);
  }

  function burst(host, kind = "primary") {
    if (!host) return;
    const el = document.createElement("span");
    el.className = `lux-burst lux-burst--${kind}`;
    host.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  function setClock() {
    const d = new Date();
    if (liveTime) liveTime.textContent = d.toLocaleTimeString(undefined, { hour12: false });
  }

  function setTodayMeta() {
    const d = new Date();
    if (todayDay) todayDay.textContent = d.toLocaleDateString(undefined, { weekday: "long" });
    if (todayDate) todayDate.textContent = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
    if (todayYear) todayYear.textContent = d.toLocaleDateString(undefined, { year: "numeric" });
  }

  function resolveDisplayName(profileData) {
    if (profileData?.fullName) return profileData.fullName;
    const cached = (localStorage.getItem("fullName") || "").trim();
    if (cached) return cached;
    const email = (localStorage.getItem("email") || "").trim();
    if (email) return email.split("@")[0];
    return "User";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getAutoSaveEnabled() {
    return localStorage.getItem(AUTO_SAVE_ENABLED_KEY) === "1";
  }

  function getOrInitRowDraft(habitState) {
    const habitId = String(habitState.habitId);
    const fromDraft = draft.byHabitId?.[habitId] || null;
    if (fromDraft) {
      return {
        habitId: Number(habitState.habitId),
        completed: Boolean(fromDraft.completed),
        actualValue: fromDraft.actualValue ?? null
      };
    }
    return {
      habitId: Number(habitState.habitId),
      completed: Boolean(habitState.completed),
      actualValue: habitState.actualValue ?? null
    };
  }

  function upsertRowDraft(habitId, nextRow) {
    draft.byHabitId[habitId] = {
      habitId: Number(nextRow.habitId),
      completed: Boolean(nextRow.completed),
      actualValue: nextRow.actualValue ?? null
    };
    saveDraft();
  }

  function getSelectedEntry() {
    if (!selectedIso) return null;
    if (todayEntry?.date && String(todayEntry.date) === String(selectedIso)) return todayEntry;
    return monthEntryMap.get(String(selectedIso)) || null;
  }

  function isSelectedEditable() {
    return Boolean(todayEntry?.date && selectedIso && String(todayEntry.date) === String(selectedIso));
  }

  function setEmptyState(title, subtitle) {
    const titleEl = taskEmptyState?.querySelector(".empty-state__title");
    const subEl = taskEmptyState?.querySelector(".empty-state__subtitle");
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
  }

  function updateSelectedDayHeader() {
    if (!dayTitle || !daySubtitle) return;
    if (!selectedIso) {
      dayTitle.textContent = "Today";
      daySubtitle.textContent = "Loading today’s habits…";
      return;
    }

    const d = fromISODate(selectedIso);
    const nice = d.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short", year: "numeric" });

    const editable = isSelectedEditable();
    const autoSave = getAutoSaveEnabled();

    dayTitle.textContent = editable ? "Today" : nice;
    daySubtitle.textContent = editable
      ? `Editable (auto-save ${autoSave ? "ON" : "OFF"}). Past/future days are read-only.`
      : "Read-only. Only today can be edited.";
  }

  function updateSelectedDayRing() {
    const entry = getSelectedEntry();
    const habits = entry?.habits || [];

    const total = habits.length;
    let completed = 0;

    if (isSelectedEditable()) {
      completed = habits.reduce((count, h) => count + (getOrInitRowDraft(h).completed ? 1 : 0), 0);
    } else {
      completed = habits.reduce((count, h) => count + (Boolean(h.completed) ? 1 : 0), 0);
    }

    const percent = total ? Math.round((completed / total) * 100) : 0;
    dayProgress?.style.setProperty("--p", String(percent));
    if (dayProgressValue) dayProgressValue.textContent = `${percent}%`;
    if (dayProgressLabel) dayProgressLabel.textContent = `${completed}/${total}`;
  }

  function renderHabits() {
    if (!taskList) return;
    const entry = getSelectedEntry();
    const editable = isSelectedEditable();
    const habits = entry?.habits || [];

    taskList.innerHTML = "";

    if (saveTodayBtn) saveTodayBtn.hidden = !editable;

    if (!selectedIso) {
      taskEmptyState?.classList.remove("d-none");
      setEmptyState("Loading…", "Fetching today’s habits.");
      updateSelectedDayRing();
      return;
    }

    if (!entry) {
      taskEmptyState?.classList.remove("d-none");
      const selectedDate = fromISODate(selectedIso);
      const today = new Date();
      const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const pickedFloor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      if (pickedFloor > todayFloor) {
        setEmptyState("No data yet", "Future days can’t be edited. Come back on that day.");
      } else {
        setEmptyState("No entry for this day", "Only days you’ve opened/saved will show habit detail.");
      }
      updateSelectedDayRing();
      return;
    }

    if (!habits.length) {
      taskEmptyState?.classList.remove("d-none");
      setEmptyState("No habits yet", "Create your first habit to start tracking today.");
      if (saveTodayBtn) saveTodayBtn.hidden = true;
      updateSelectedDayRing();
      return;
    }

    taskEmptyState?.classList.add("d-none");

    for (const hs of habits) {
      const habitId = String(hs.habitId);
      const current = editable ? getOrInitRowDraft(hs) : null;

      const row = document.createElement("div");
      row.className = "habit-grid habit-row";
      row.dataset.habitId = habitId;

      const doneWrap = document.createElement("div");
      doneWrap.className = "task-done-cell";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input";
      checkbox.checked = editable ? Boolean(current.completed) : Boolean(hs.completed);
      checkbox.disabled = !editable;
      doneWrap.appendChild(checkbox);

      row.classList.toggle("is-complete", checkbox.checked);

      const habitCell = document.createElement("div");
      const title = document.createElement("div");
      title.className = "habit-name";
      title.textContent = hs.habitTitle || "";
      habitCell.appendChild(title);

      const categoryCell = document.createElement("div");
      const cat = formatCategoryLabel(hs.category);
      categoryCell.innerHTML = `<span class="category-pill">${escapeHtml(cat)}</span>`;

      const targetCell = document.createElement("div");
      const goalWrap = document.createElement("div");
      goalWrap.className = "habit-goal";
      goalWrap.style.marginTop = "0";
      targetCell.appendChild(goalWrap);

      if (hs.targetValue != null) {
        const pill = document.createElement("span");
        pill.className = "goal-pill";
        pill.innerHTML = `<i class="bi bi-bullseye" aria-hidden="true"></i>${escapeHtml(
          `${hs.targetValue} ${hs.unit || ""}`.trim()
        )}`;
        goalWrap.appendChild(pill);

        const actual = document.createElement("input");
        actual.type = "number";
        actual.className = "form-control form-control-sm actual-mini";
        actual.placeholder = "Actual";
        actual.min = "0";
        actual.disabled = !editable;
        const value = editable ? current.actualValue : hs.actualValue;
        actual.value = value != null ? String(value) : "";
        goalWrap.appendChild(actual);

        if (editable) {
          actual.addEventListener("input", () => {
            if ((actual.value || "").trim() === "") current.actualValue = null;
            else {
              const v = Number(actual.value);
              current.actualValue = Number.isFinite(v) ? v : null;
            }
            upsertRowDraft(habitId, current);
            scheduleAutoSave();
          });
        }
      } else {
        const pill = document.createElement("span");
        pill.className = "goal-pill";
        pill.innerHTML = `<i class="bi bi-check2-circle" aria-hidden="true"></i>Checklist`;
        goalWrap.appendChild(pill);
      }

      const actionCell = document.createElement("div");
      const statusPill = document.createElement("span");
      statusPill.className = `pill ${checkbox.checked ? "is-good" : "is-bad"}`;
      statusPill.textContent = cat;
      actionCell.appendChild(statusPill);

      row.appendChild(doneWrap);
      row.appendChild(habitCell);
      row.appendChild(categoryCell);
      row.appendChild(targetCell);
      row.appendChild(actionCell);
      taskList.appendChild(row);

      if (editable) {
        checkbox.addEventListener("change", () => {
          current.completed = Boolean(checkbox.checked);
          upsertRowDraft(habitId, current);
          row.classList.toggle("is-complete", checkbox.checked);
          pop(row, "is-pop", 260);
          pop(dayProgress, "is-bump", 340);
          burst(doneWrap, checkbox.checked ? "gold" : "rose");
          statusPill.classList.toggle("is-good", checkbox.checked);
          statusPill.classList.toggle("is-bad", !checkbox.checked);
          statusPill.textContent = cat;
          scheduleAutoSave();
          updateSelectedDayRing();
          renderMonthCheckpoints();
        });
      }
    }

    updateSelectedDayRing();
  }

  function scheduleAutoSave() {
    if (!isSelectedEditable()) return;
    if (!getAutoSaveEnabled()) return;
    if (isSaving) return;

    if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      autoSaveTimer = null;
      saveTodayNow({ kind: "auto" }).catch(() => {
        // status already set in save
      });
    }, 800);
  }

  function percentForEntry(entry) {
    const hs = entry?.habits || [];
    const total = hs.length;
    const completed = hs.reduce((count, h) => {
      const isToday = todayEntry?.date && entry?.date && isSameISO(todayEntry.date, entry.date);
      if (isToday) return count + (getOrInitRowDraft(h).completed ? 1 : 0);
      return count + (Boolean(h.completed) ? 1 : 0);
    }, 0);
    return total ? (completed * 100) / total : 0;
  }

  function updateDailyStatsForToday() {
    if (!todayEntry?.date) return;
    const iso = String(todayEntry.date);
    const percent = percentForEntry(todayEntry);
    dailyStatsMap.set(iso, clampPercent(percent));
    monthEntryMap.set(iso, todayEntry);
  }

  function setCheckpointCellVisual(cell, { kind } = { kind: "empty" }) {
    if (!cell) return;
    cell.classList.remove("is-done", "is-missed", "is-empty", "is-blank", "is-future", "is-disabled");

    if (kind === "done") {
      cell.classList.add("is-done");
      cell.innerHTML = `<svg class="lux-icon" aria-hidden="true"><use href="#lux-check"></use></svg>`;
    } else if (kind === "missed") {
      cell.classList.add("is-missed");
      cell.innerHTML = `<svg class="lux-icon" aria-hidden="true"><use href="#lux-x"></use></svg>`;
    } else if (kind === "future") {
      cell.classList.add("is-future", "is-disabled", "is-empty");
      cell.innerHTML = `<svg class="lux-icon lux-icon--empty" aria-hidden="true"><use href="#lux-ghost"></use></svg>`;
    } else if (kind === "no-entry") {
      cell.classList.add("is-empty");
      cell.innerHTML = `<svg class="lux-icon lux-icon--empty" aria-hidden="true"><use href="#lux-ghost"></use></svg>`;
    } else if (kind === "inactive") {
      cell.classList.add("is-blank");
      cell.innerHTML = `<span class="checkpoint-dot checkpoint-dot--blank" aria-hidden="true"></span>`;
    } else {
      cell.classList.add("is-empty");
      cell.innerHTML = `<svg class="lux-icon lux-icon--empty" aria-hidden="true"><use href="#lux-ghost"></use></svg>`;
    }
  }

  function cssEscapeAttrValue(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replaceAll('"', '\\"');
  }

  function clearPeekedColumn() {
    if (!monthCheckpointsScroll) return;
    if (!peekedIso) return;
    const esc = cssEscapeAttrValue(peekedIso);
    monthCheckpointsScroll
      .querySelectorAll(`.checkpoint-cell.is-peeked[data-iso="${esc}"], .month-checkpoints-day.is-peeked[data-iso="${esc}"]`)
      .forEach((el) => el.classList.remove("is-peeked"));
    peekedIso = null;
  }

  function setPeekedColumn(iso) {
    if (!monthCheckpointsScroll) return;
    const next = String(iso || "");
    if (!next) return;
    if (peekedIso === next) return;
    clearPeekedColumn();
    peekedIso = next;
    const esc = cssEscapeAttrValue(next);
    monthCheckpointsScroll
      .querySelectorAll(`.checkpoint-cell[data-iso="${esc}"], .month-checkpoints-day[data-iso="${esc}"]`)
      .forEach((el) => el.classList.add("is-peeked"));
  }

  function wireMonthHoverPeek() {
    if (!monthCheckpointsScroll) return;
    if (monthHoverWired) return;
    monthHoverWired = true;

    monthCheckpointsScroll.addEventListener("mouseover", (e) => {
      const target = e.target?.closest?.(".checkpoint-cell, .month-checkpoints-day");
      if (!target) {
        clearPeekedColumn();
        return;
      }
      const iso = target.dataset?.iso;
      if (!iso) return;
      setPeekedColumn(iso);
    });

    monthCheckpointsScroll.addEventListener("mouseleave", () => {
      clearPeekedColumn();
    });
  }

  function toggleTodayHabit(habitId, { burstHost } = {}) {
    const hs = todayEntry?.habits?.find((h) => String(h?.habitId) === String(habitId)) || null;
    if (!hs) return;
    const current = getOrInitRowDraft(hs);
    setTodayHabitCompleted(habitId, !Boolean(current.completed), { burstHost });
  }

  function setTodayHabitCompleted(habitId, completed, { burstHost } = {}) {
    if (!todayEntry?.date) return;
    if (!isSelectedEditable()) return;

    const hs = todayEntry?.habits?.find((h) => String(h?.habitId) === String(habitId)) || null;
    if (!hs) return;

    const nextRow = getOrInitRowDraft(hs);
    nextRow.completed = Boolean(completed);
    upsertRowDraft(String(habitId), nextRow);

    updateSelectedDayRing();
    pop(dayProgress, "is-bump", 340);
    updateDailyStatsForToday();
    renderMonthCharts();
    scheduleAutoSave();
    if (burstHost) burst(burstHost, nextRow.completed ? "gold" : "rose");
  }

  async function saveTodayNow({ kind } = { kind: "manual" }) {
    if (!todayEntry) return;
    if (!isSelectedEditable()) return;

    clearStatus();

    const habits = todayEntry.habits || [];
    const updates = habits.map((hs) => {
      const row = getOrInitRowDraft(hs);
      const out = {
        habitId: row.habitId,
        completed: Boolean(row.completed)
      };
      if (row.actualValue != null) out.actualValue = row.actualValue;
      return out;
    });

    try {
      isSaving = true;
      if (saveTodayBtn) {
        saveTodayBtn.disabled = true;
        saveTodayBtn.classList.add("is-loading");
      }

      const payload = {
        habits: updates,
        moodScore: todayEntry.moodScore ?? null,
        energyScore: todayEntry.energyScore ?? null,
        moodTags: todayEntry.moodTags ?? null,
        journalText: todayEntry.journalText ?? null
      };

      if (todayEntry.pulseTasks != null) payload.pulseTasks = todayEntry.pulseTasks;

      todayEntry = await saveToday(payload);
      clearDraft();
      updateDailyStatsForToday();
      renderMonth();
      renderSelectedDay();
      setStatus("success", kind === "auto" ? "Autosaved." : "Saved.");
    } catch (err) {
      setStatus("error", err?.message || "Failed to save day.");
      throw err;
    } finally {
      isSaving = false;
      if (saveTodayBtn) {
        saveTodayBtn.disabled = false;
        saveTodayBtn.classList.remove("is-loading");
      }
    }
  }

  function buildMonthEntryMap(entries) {
    const map = new Map();
    for (const e of entries || []) {
      if (e?.date) map.set(String(e.date), e);
    }
    return map;
  }

  function buildHabitMetaList() {
    const map = new Map();
    const allowed = new Set((todayEntry?.habits || []).map((h) => String(h?.habitId)));

    function ingestHabitState(hs) {
      if (!hs?.habitId) return;
      const habitId = String(hs.habitId);
      const existing = map.get(habitId) || null;
      const next = existing || {
        habitId,
        habitTitle: String(hs.habitTitle || ""),
        category: String(hs.category || "OTHER"),
        targetValue: hs.targetValue ?? null,
        unit: hs.unit ?? null
      };
      if (!next.habitTitle) next.habitTitle = String(hs.habitTitle || "");
      if (!next.category || next.category === "OTHER") next.category = String(hs.category || "OTHER");
      if (next.targetValue == null && hs.targetValue != null) next.targetValue = hs.targetValue;
      if (!next.unit && hs.unit) next.unit = hs.unit;
      map.set(habitId, next);
    }

    for (const hs of todayEntry?.habits || []) ingestHabitState(hs);
    for (const entry of monthEntries || []) {
      for (const hs of entry?.habits || []) {
        if (!hs?.habitId) continue;
        if (!allowed.has(String(hs.habitId))) continue;
        ingestHabitState(hs);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const cat = String(a.category).localeCompare(String(b.category));
      if (cat !== 0) return cat;
      return String(a.habitTitle).localeCompare(String(b.habitTitle));
    });
  }

  function buildDayCompletionMap() {
    const byIso = new Map();

    for (const entry of monthEntries || []) {
      if (!entry?.date) continue;
      const iso = String(entry.date);
      const map = new Map();
      for (const hs of entry?.habits || []) {
        if (!hs?.habitId) continue;
        map.set(String(hs.habitId), Boolean(hs.completed));
      }
      byIso.set(iso, map);
    }

    if (todayEntry?.date) {
      const iso = String(todayEntry.date);
      const map = new Map();
      for (const hs of todayEntry?.habits || []) {
        if (!hs?.habitId) continue;
        map.set(String(hs.habitId), Boolean(getOrInitRowDraft(hs).completed));
      }
      byIso.set(iso, map);
    }

    return byIso;
  }

  function renderMonthCheckpoints() {
    if (!monthCheckpointsBody || !monthCheckpointsHead) return;
    if (viewYear == null || viewMonth == null) return;

    const dim = daysInMonth(viewYear, viewMonth);
    const compact = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    const leftCol = compact ? 190 : 210;

    if (monthCheckpointsScroll && monthCheckpointsScroll.clientWidth) {
      const styles = window.getComputedStyle(monthCheckpointsScroll);
      const maxCell = Number.parseInt(styles.getPropertyValue("--mc-cell"), 10) || (compact ? 20 : 24);
      const maxGap = Number.parseInt(styles.getPropertyValue("--mc-gap"), 10) || (compact ? 4 : 6);
      const minCell = compact ? 16 : 18;
      const minGap = compact ? 3 : 4;
      const available = monthCheckpointsScroll.clientWidth;

      let cell = maxCell;
      let gap = maxGap;
      const fits = () => leftCol + dim * cell + dim * gap <= available;

      while (!fits() && (cell > minCell || gap > minGap)) {
        if (cell > minCell) cell -= 1;
        else gap -= 1;
      }

      monthCheckpointsScroll.style.setProperty("--mc-cell", `${cell}px`);
      monthCheckpointsScroll.style.setProperty("--mc-gap", `${gap}px`);
    }

    const template = `${leftCol}px repeat(${dim}, var(--mc-cell, 34px))`;
    monthCheckpointsHead.style.gridTemplateColumns = template;

    monthCheckpointsHead.innerHTML = "";
    monthCheckpointsBody.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "month-checkpoints-corner";
    corner.textContent = "Habit";
    monthCheckpointsHead.appendChild(corner);

    const todayFloor = new Date();
    todayFloor.setHours(0, 0, 0, 0);
    const todayIso = toISODate(todayFloor);
    const signup = profile?.signupDate ? fromISODate(profile.signupDate) : null;

    for (let day = 1; day <= dim; day++) {
      const dateObj = new Date(viewYear, viewMonth - 1, day);
      const iso = toISODate(dateObj);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "month-checkpoints-day";
      btn.classList.add("month-checkpoints-day--label");
      btn.dataset.iso = iso;
      const num = document.createElement("span");
      num.className = "month-checkpoints-day__num";
      num.textContent = String(day);
      btn.appendChild(num);
      if (iso === todayIso) {
        const tick = document.createElement("i");
        tick.className = "bi bi-check2 month-checkpoints-day__tick";
        tick.setAttribute("aria-hidden", "true");
        btn.appendChild(tick);
      }
      btn.title = dateObj.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      btn.classList.toggle("is-today", iso === todayIso);
      btn.classList.toggle("is-selected", iso === selectedIso);
      btn.classList.toggle("is-future", dateObj > todayFloor);
      btn.setAttribute("aria-disabled", "true");
      btn.tabIndex = -1;
      monthCheckpointsHead.appendChild(btn);
    }

    const habits = buildHabitMetaList();
    if (!habits.length) {
      monthCheckpointsBody.innerHTML = `<div class="p-3 muted">No habits yet.</div>`;
      return;
    }

    const completionByIso = buildDayCompletionMap();

    for (const habit of habits) {
      const row = document.createElement("div");
      row.className = "month-checkpoints-row";
      row.style.gridTemplateColumns = template;

      const left = document.createElement("div");
      left.className = "month-checkpoints-habit month-checkpoints-habit--rich";

      const hsToday = todayEntry?.habits?.find((h) => String(h?.habitId) === String(habit.habitId)) || null;
      const todayDone = hsToday ? Boolean(getOrInitRowDraft(hsToday).completed) : false;

      const leftText = document.createElement("div");
      const title = document.createElement("div");
      title.className = "month-checkpoints-habit__title";
      title.textContent = habit.habitTitle || "Habit";
      const meta = document.createElement("div");
      meta.className = "month-checkpoints-habit__meta";
      const cat = formatCategoryLabel(habit.category);
      const target =
        habit.targetValue != null
          ? `Target: ${habit.targetValue}${habit.unit ? ` ${habit.unit}` : ""}`
          : "Target: —";
      meta.textContent = target;
      leftText.appendChild(title);
      leftText.appendChild(meta);
      left.appendChild(leftText);

      const statusPill = document.createElement("span");
      statusPill.className = `pill ${todayDone ? "is-good" : "is-bad"}`;
      statusPill.textContent = cat;
      left.appendChild(statusPill);
      left.classList.toggle("is-complete", todayDone);
      row.appendChild(left);

      for (let day = 1; day <= dim; day++) {
        const dateObj = new Date(viewYear, viewMonth - 1, day);
        const iso = toISODate(dateObj);

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "checkpoint-cell";
        cell.dataset.iso = iso;

        const beforeSignup = signup && dateObj < signup;
        const isFuture = dateObj > todayFloor;
        const isToday = iso === todayIso;
        const isPast = dateObj < todayFloor;
        cell.classList.toggle("is-today", isToday);

        const nice = dateObj.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
        const dayMap = completionByIso.get(iso) || null;
        const hasEntry = monthEntryMap.has(iso);
        const hasStatus = Boolean(dayMap && dayMap.has(habit.habitId));
        const completed = hasStatus ? Boolean(dayMap.get(habit.habitId)) : false;

        if (beforeSignup) {
          cell.disabled = true;
          setCheckpointCellVisual(cell, { kind: "future" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Disabled`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: disabled`);
        } else if (isFuture) {
          cell.disabled = true;
          setCheckpointCellVisual(cell, { kind: "future" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Future (disabled)`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: future disabled`);
        } else if (isToday && hasStatus) {
          cell.disabled = false;
          setCheckpointCellVisual(cell, { kind: completed ? "done" : "missed" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - ${completed ? "Completed" : "Open"}`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: ${completed ? "completed" : "open"}`);
          cell.addEventListener("click", () => {
            toggleTodayHabit(habit.habitId, { burstHost: cell });
            const hs = todayEntry?.habits?.find((h) => String(h?.habitId) === String(habit.habitId)) || null;
            const nowDone = hs ? Boolean(getOrInitRowDraft(hs).completed) : false;
            setCheckpointCellVisual(cell, { kind: nowDone ? "done" : "missed" });
            pop(cell, "is-pop", 380);
            statusPill.classList.toggle("is-good", nowDone);
            statusPill.classList.toggle("is-bad", !nowDone);
            left.classList.toggle("is-complete", nowDone);
          });
        } else if (hasEntry && hasStatus && completed) {
          cell.disabled = true;
          setCheckpointCellVisual(cell, { kind: "done" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Completed (read-only)`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: completed (read-only)`);
        } else if (hasEntry && hasStatus) {
          cell.disabled = true;
          setCheckpointCellVisual(cell, { kind: "missed" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Missed (read-only)`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: missed (read-only)`);
        } else if (!hasEntry && isPast) {
          cell.disabled = true;
          cell.classList.add("is-assumed");
          setCheckpointCellVisual(cell, { kind: "missed" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Missed (not saved)`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: missed (not saved)`);
        } else if (!hasEntry) {
          cell.disabled = true;
          setCheckpointCellVisual(cell, { kind: "future" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Future (disabled)`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: future (disabled)`);
        } else {
          cell.disabled = true;
          setCheckpointCellVisual(cell, { kind: "inactive" });
          cell.title = `${habit.habitTitle || "Habit"} - ${nice} - Not active`;
          cell.setAttribute("aria-label", `${habit.habitTitle || "Habit"} on ${nice}: not active`);
        }

        cell.classList.toggle("is-selected", iso === selectedIso);
        cell.classList.toggle("is-future", isFuture);
        row.appendChild(cell);
      }

      monthCheckpointsBody.appendChild(row);
    }

    if (monthCheckpointsScroll) {
      monthCheckpointsScroll.dataset.ready = "1";
    }
  }

  function renderMonthCharts() {
    if (viewYear == null || viewMonth == null) return;

    const dim = daysInMonth(viewYear, viewMonth);
    const signup = profile?.signupDate ? fromISODate(profile.signupDate) : null;

    if (calendarTitle) calendarTitle.textContent = monthName(viewYear, viewMonth);

    const perDay = [];
    for (let day = 1; day <= dim; day++) {
      const dateObj = new Date(viewYear, viewMonth - 1, day);
      const iso = toISODate(dateObj);
      let val = dailyStatsMap.get(iso) ?? 0;
      if (signup && dateObj < signup) val = 0;
      perDay.push(clampPercent(Number(val)));
    }

    const monthAvgStrict = perDay.reduce((a, b) => a + b, 0) / (perDay.length || 1);
    setRing(monthRing, monthRingValue, monthRingLabel, monthAvgStrict, `${dim} days`);

    if (lineChartEl && window.Chart) {
      destroyChart(lineChart);
      const ctx = lineChartEl.getContext("2d");
      const fill = ctx.createLinearGradient(0, 0, 0, 240);
      fill.addColorStop(0, "rgba(108, 99, 255, 0.22)");
      fill.addColorStop(1, "rgba(108, 99, 255, 0.02)");

      lineChart = new Chart(lineChartEl, {
        type: "line",
        data: {
          labels: Array.from({ length: dim }, (_, i) => String(i + 1)),
          datasets: [
            {
              label: "Completion %",
              data: perDay,
              borderColor: "rgba(108, 99, 255, 0.95)",
              backgroundColor: fill,
              pointRadius: 2,
              tension: 0.28,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
          }
        }
      });
    }

    if (barChartEl && window.Chart) {
      destroyChart(barChart);
      barChart = new Chart(barChartEl, {
        type: "bar",
        data: {
          labels: Array.from({ length: dim }, (_, i) => String(i + 1)),
          datasets: [
            {
              label: "Completion %",
              data: perDay,
              backgroundColor: "rgba(108, 99, 255, 0.30)",
              borderColor: "rgba(108, 99, 255, 0.85)",
              borderWidth: 1.5,
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
          }
        }
      });
    }
  }

  function renderMonth() {
    renderMonthCharts();
    renderMonthCheckpoints();
  }

  function renderSelectedDay() {
    updateSelectedDayHeader();
    if (taskList) renderHabits();
    else updateSelectedDayRing();
  }

  async function loadMonth(year, month) {
    viewYear = year;
    viewMonth = month;

    const dim = daysInMonth(year, month);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month - 1, dim);

    const [dailyStats, entries] = await Promise.all([
      getDailyStats(toISODate(first), toISODate(last)),
      getEntriesForMonth(year, month)
    ]);

    dailyStatsMap = new Map((dailyStats || []).map((s) => [String(s.date), clampPercent(Number(s.completionPercent))]));
    monthEntries = entries || [];
    monthEntryMap = buildMonthEntryMap(monthEntries);

    // Ensure today's latest data is reflected in current month views.
    updateDailyStatsForToday();

    // Day card stays pinned to today (read-only for other dates is handled by backend rule).
    const todayIso = todayEntry?.date ? String(todayEntry.date) : null;
    selectedIso = todayIso;

    renderMonth();
    renderSelectedDay();
  }

  function stepMonth(delta) {
    if (viewYear == null || viewMonth == null) return;
    const d = new Date(viewYear, viewMonth - 1, 1);
    d.setMonth(d.getMonth() + delta);
    loadMonth(d.getFullYear(), d.getMonth() + 1).catch((err) => {
      alert(err?.message || "Failed to load month");
    });
  }

  async function init() {
    setTodayMeta();
    setClock();
    window.setInterval(() => {
      setClock();
      setTodayMeta();
    }, 1000);

    wireMonthHoverPeek();

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        renderMonthCheckpoints();
      }, 120);
    });

    try {
      const [profileData, today, streak] = await Promise.all([getMyProfile(), getOrCreateToday(), getStreakStats()]);
      profile = profileData;
      todayEntry = today;

      if (welcomeName) welcomeName.textContent = resolveDisplayName(profile);

      if (dashboardStreak) {
        dashboardStreak.textContent = `${streak.currentStreakDays} / best ${streak.longestStreakDays}`;
      }
      if (dashboardThreshold) {
        dashboardThreshold.textContent = `${Number(streak.thresholdPercent).toFixed(0)}%`;
      }

      if (saveTodayBtn) {
        saveTodayBtn.addEventListener("click", () => {
          saveTodayNow({ kind: "manual" }).catch(() => {});
        });
      }

      if (prevMonthBtn) prevMonthBtn.addEventListener("click", () => stepMonth(-1));
      if (nextMonthBtn) nextMonthBtn.addEventListener("click", () => stepMonth(1));

      const todayDateObj = todayEntry?.date ? fromISODate(String(todayEntry.date)) : new Date();
      await loadMonth(todayDateObj.getFullYear(), todayDateObj.getMonth() + 1);

      document.querySelectorAll(".glass-card").forEach((el, i) => {
        el.classList.add("fade-up");
        window.setTimeout(() => el.classList.add("is-visible"), 40 + i * 60);
      });
    } catch (err) {
      alert(err?.message || "Failed to load dashboard");
    }
  }

  init();
})();
