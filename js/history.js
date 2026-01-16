(() => {
  const yearSelect = document.getElementById("historyYear");
  const monthSelect = document.getElementById("historyMonth");
  const loadBtn = document.getElementById("loadHistoryBtn");
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");

  const toggleCompareBtn = document.getElementById("toggleCompareBtn");
  const comparePicker = document.getElementById("comparePicker");
  const compareYearSelect = document.getElementById("compareYear");
  const compareMonthSelect = document.getElementById("compareMonth");
  const runCompareBtn = document.getElementById("runCompareBtn");

  const historyDate = document.getElementById("historyDate");
  const goDateBtn = document.getElementById("goDateBtn");
  const calendarTitle = document.getElementById("calendarTitle");
  const calendarSub = document.getElementById("calendarSub");
  const calendarDays = document.getElementById("calendarDays");

  const ring = document.getElementById("historyRing");
  const ringValue = document.getElementById("historyRingValue");
  const ringLabel = document.getElementById("historyRingLabel");

  const dailyChartEl = document.getElementById("historyDailyChart");
  const categoryChartEl = document.getElementById("historyCategoryChart");

  const promptBox = document.getElementById("promptBox");
  const exportBox = document.getElementById("exportBox");
  const copyPromptBtn = document.getElementById("copyPromptBtn");
  const copyExportBtn = document.getElementById("copyExportBtn");

  const daySubtitle = document.getElementById("daySubtitle");
  const dayRing = document.getElementById("dayRing");
  const dayRingValue = document.getElementById("dayRingValue");
  const dayRingLabel = document.getElementById("dayRingLabel");
  const dayMood = document.getElementById("dayMood");
  const dayEnergy = document.getElementById("dayEnergy");
  const dayHabitList = document.getElementById("dayHabitList");
  const dayPulseWrap = document.getElementById("dayPulseWrap");
  const dayPulseList = document.getElementById("dayPulseList");
  const dayEmpty = document.getElementById("dayEmpty");
  const dayJournal = document.getElementById("dayJournal");
  const dayDonutEl = document.getElementById("dayDonut");
  const daySparkEl = document.getElementById("daySpark");

  const compareSection = document.getElementById("compareSection");
  const compareDeltaEl = document.getElementById("compareDelta");
  const compareMonthLabelA = document.getElementById("compareMonthLabelA");
  const compareMonthLabelB = document.getElementById("compareMonthLabelB");
  const compareRingA = document.getElementById("compareRingA");
  const compareRingValueA = document.getElementById("compareRingValueA");
  const compareRingLabelA = document.getElementById("compareRingLabelA");
  const compareRingB = document.getElementById("compareRingB");
  const compareRingValueB = document.getElementById("compareRingValueB");
  const compareRingLabelB = document.getElementById("compareRingLabelB");
  const compareCategoryChartAEl = document.getElementById("compareCategoryChartA");
  const compareCategoryChartBEl = document.getElementById("compareCategoryChartB");
  const compareNotesA = document.getElementById("compareNotesA");
  const compareNotesB = document.getElementById("compareNotesB");

  if (!yearSelect || !monthSelect || !calendarDays) return;

  let profile = null;
  let habits = [];
  let monthEntries = [];
  let dailyChart = null;
  let categoryChart = null;
  let dayDonut = null;
  let daySpark = null;
  let compareCategoryChartA = null;
  let compareCategoryChartB = null;
  let compareVisible = false;

  function pad2(n) {
    return String(n).padStart(2, "0");
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

  function setRing(el, valueEl, labelEl, percent, label) {
    const p = Math.round(clampPercent(percent));
    el?.style.setProperty("--p", String(p));
    if (valueEl) valueEl.textContent = `${p}%`;
    if (labelEl) labelEl.textContent = label;
  }

  function destroyChart(chart) {
    try {
      chart?.destroy();
    } catch {
      // ignore
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function truncateText(value, max) {
    const s = String(value ?? "");
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }

  function decodeNote(note) {
    const result = { feel: "", feelOther: "", noteText: "" };
    if (!note) return result;

    const lines = String(note).split(/\r?\n/);
    const noteLines = [];
    for (const line of lines) {
      if (line.startsWith("[Feel]=")) result.feel = line.slice(7).trim();
      else if (line.startsWith("[Other]=")) result.feelOther = line.slice(8).trim();
      else noteLines.push(line);
    }
    result.noteText = noteLines.join("\n").trim();
    return result;
  }

  function buildYearOptions() {
    yearSelect.innerHTML = "";
    const now = new Date();
    const current = now.getFullYear();
    for (let y = current - 4; y <= current + 1; y++) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = String(current);

    if (compareYearSelect) {
      compareYearSelect.innerHTML = yearSelect.innerHTML;
      compareYearSelect.value = yearSelect.value;
    }
  }

  function buildMonthOptions() {
    monthSelect.innerHTML = "";
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = `${names[m - 1]} (${pad2(m)})`;
      monthSelect.appendChild(opt);
    }

    if (compareMonthSelect) {
      compareMonthSelect.innerHTML = monthSelect.innerHTML;
    }
  }

  function setCurrentMonth() {
    const now = new Date();
    yearSelect.value = String(now.getFullYear());
    monthSelect.value = String(now.getMonth() + 1);
  }

  function setCompareDefaultMonth() {
    if (!compareYearSelect || !compareMonthSelect) return;
    const baseY = Number(yearSelect.value);
    const baseM = Number(monthSelect.value);
    if (!Number.isFinite(baseY) || !Number.isFinite(baseM)) return;

    const d = new Date(baseY, baseM - 1, 1);
    d.setMonth(d.getMonth() - 1);
    compareYearSelect.value = String(d.getFullYear());
    compareMonthSelect.value = String(d.getMonth() + 1);
  }

  function setCalendarHeader(year, month) {
    if (calendarTitle) calendarTitle.textContent = monthName(year, month);
    if (calendarSub) calendarSub.textContent = profile?.signupDate ? `From ${profile.signupDate}` : "—";
  }

  function entryCompletionPercent(entry) {
    const hs = entry?.habits || [];
    const total = hs.length;
    const completed = hs.filter((h) => Boolean(h.completed)).length;
    return total ? (completed * 100) / total : 0;
  }

  function buildEntryMap(entries) {
    const map = new Map();
    for (const e of entries || []) {
      if (e?.date) map.set(String(e.date), e);
    }
    return map;
  }

  function renderCalendar(year, month) {
    calendarDays.innerHTML = "";
    const dim = daysInMonth(year, month);

    const first = new Date(year, month - 1, 1);
    const firstWeekday = (first.getDay() + 6) % 7; // Mon=0

    const signup = profile?.signupDate ? fromISODate(profile.signupDate) : null;
    const today = new Date();
    const todayIso = toISODate(today);

    const map = buildEntryMap(monthEntries);

    setCalendarHeader(year, month);

    // Leading blanks
    for (let i = 0; i < firstWeekday; i++) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell is-empty";
      calendarDays.appendChild(cell);
    }

    for (let day = 1; day <= dim; day++) {
      const dateObj = new Date(year, month - 1, day);
      const iso = toISODate(dateObj);

      const beforeSignup = signup ? dateObj < signup : false;
      const isFuture = dateObj > new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const entry = map.get(iso) || null;
      const locked = Boolean(entry?.locked);
      const percent = entry ? entryCompletionPercent(entry) : 0;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-cell";
      btn.dataset.date = iso;
      btn.disabled = beforeSignup;

      const selected = historyDate?.value === iso;
      if (selected) btn.classList.add("is-selected");
      if (iso === todayIso) btn.classList.add("is-today");
      if (beforeSignup) btn.classList.add("is-disabled");
      if (isFuture) btn.classList.add("is-future");
      if (entry && locked) btn.classList.add("is-locked");
      if (entry && !locked) btn.classList.add("is-open");

      btn.innerHTML = `
        <div class="calendar-cell__top">
          <div class="calendar-daynum">${day}</div>
          ${locked ? `<span class="calendar-lock" title="Locked"><i class="bi bi-lock-fill" aria-hidden="true"></i></span>` : ""}
        </div>
        <div class="calendar-meter">
          <div class="calendar-meter__bar" style="--p:${Math.round(percent)}"></div>
        </div>
      `;

      btn.addEventListener("click", () => {
        if (historyDate) historyDate.value = iso;
        renderCalendar(year, month);
        selectDay(iso);
      });

      calendarDays.appendChild(btn);
    }
  }

  function setDayHeader(iso, locked) {
    if (!daySubtitle) return;
    const d = fromISODate(iso);
    const nice = d.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
    daySubtitle.textContent = locked ? `${nice} • Locked` : `${nice}`;
  }

  function renderDayEmpty(iso) {
    dayHabitList.innerHTML = "";
    dayEmpty?.classList.remove("d-none");
    dayJournal.value = "";
    if (dayPulseList) dayPulseList.innerHTML = "";
    dayPulseWrap?.classList.add("d-none");
    dayMood.textContent = "—";
    dayEnergy.textContent = "—";
    setDayHeader(iso, false);
    setRing(dayRing, dayRingValue, dayRingLabel, 0, "0/0");
    destroyChart(dayDonut);
    destroyChart(daySpark);
  }

  function renderDayDetail(entry) {
    const iso = String(entry.date);
    setDayHeader(iso, Boolean(entry.locked));

    const hs = entry.habits || [];
    const total = hs.length;
    const completed = hs.filter((h) => Boolean(h.completed)).length;
    const missed = total - completed;
    const percent = total ? (completed * 100) / total : 0;

    dayEmpty?.classList.add("d-none");
    setRing(dayRing, dayRingValue, dayRingLabel, percent, `${completed}/${total}`);

    dayMood.textContent = entry.moodScore ? `${entry.moodScore}/5` : "—";
    dayEnergy.textContent = entry.energyScore ? `${entry.energyScore}/5` : "—";
    dayJournal.value = entry.journalText || "";

    // Habit list
    dayHabitList.innerHTML = "";
    for (const h of hs) {
      const decoded = decodeNote(h.note);
      const feel = decoded.feel === "OTHER" ? decoded.feelOther : decoded.feel;
      const badge = h.completed
        ? `<span class="pill is-good">Done</span>`
        : `<span class="pill is-bad">Miss</span>`;

      const actual = h.actualValue != null
        ? `<div class="muted">Actual: <strong>${escapeHtml(h.actualValue)}</strong> ${escapeHtml(h.unit || "")}</div>`
        : "";
      const target = h.targetValue != null
        ? `<div class="muted">Target: <strong>${escapeHtml(h.targetValue)}</strong> ${escapeHtml(h.unit || "")}</div>`
        : "";
      const noteText = decoded.noteText ? `<div class="note-box">${escapeHtml(decoded.noteText)}</div>` : "";
      const feelText = feel ? `<div class="muted">Feel: <strong>${escapeHtml(feel)}</strong></div>` : `<div class="muted">Feel: —</div>`;

      const row = document.createElement("div");
      row.className = "day-habit-row hover-lift";
      row.innerHTML = `
        <div class="day-habit-row__left">
          <div class="day-habit-title">${escapeHtml(h.habitTitle)}</div>
          <div class="muted">${escapeHtml(h.category || "")}</div>
        </div>
        <div class="day-habit-row__mid">
          ${target}
          ${actual}
          ${feelText}
          ${noteText}
        </div>
        <div class="day-habit-row__right">
          ${badge}
        </div>
      `;
      dayHabitList.appendChild(row);
    }

    // PulseBoard tasks (only if saved)
    if (dayPulseWrap && dayPulseList) {
      const tasks = Array.isArray(entry.pulseTasks) ? entry.pulseTasks : [];
      if (!tasks.length) {
        dayPulseWrap.classList.add("d-none");
        dayPulseList.innerHTML = "";
      } else {
        dayPulseWrap.classList.remove("d-none");
        dayPulseList.innerHTML = "";

        for (const t of tasks) {
          const done = Boolean(t?.completed);
          const kind = t?.kind === "PROJECT" ? "PROJECT" : "QUICK_24H";
          const kindLabel = kind === "PROJECT" ? "Project" : "24h-only";
          const kindClass = kind === "PROJECT" ? "day-pulse-pill is-project" : "day-pulse-pill is-quick";
          const project = String(t?.projectName || "").trim();

          const row = document.createElement("div");
          row.className = "day-pulse-row hover-lift";
          row.innerHTML = `
            <div>${done ? `<span class="pill is-good">Done</span>` : `<span class="pill is-bad">Open</span>`}</div>
            <div style="font-weight: 950; letter-spacing:-0.01em;">${escapeHtml(t?.title || "")}</div>
            <div><span class="${kindClass}">${escapeHtml(kindLabel)}</span></div>
            <div class="muted" style="margin-top:0;">${project ? escapeHtml(project) : "—"}</div>
          `;
          dayPulseList.appendChild(row);
        }
      }
    }

    // Day donut
    destroyChart(dayDonut);
    dayDonut = new Chart(dayDonutEl, {
      type: "doughnut",
      data: {
        labels: ["Completed", "Missed"],
        datasets: [{
          data: [completed, missed],
          backgroundColor: ["rgba(108, 99, 255, 0.85)", "rgba(17, 24, 39, 0.10)"],
          borderColor: "rgba(255,255,255,0.9)",
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  async function renderDaySparkline(iso) {
    destroyChart(daySpark);
    const date = fromISODate(iso);
    const start = new Date(date);
    start.setDate(date.getDate() - 6);

    const startIso = toISODate(start);
    const endIso = toISODate(date);

    const stats = await getDailyStats(startIso, endIso);
    const map = new Map((stats || []).map((s) => [String(s.date), clampPercent(Number(s.completionPercent))]));

    const labels = [];
    const values = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toISODate(d);
      labels.push(pad2(d.getDate()));
      values.push(map.get(key) ?? 0);
    }

    const ctx = daySparkEl.getContext("2d");
    const fill = ctx.createLinearGradient(0, 0, 0, 140);
    fill.addColorStop(0, "rgba(108, 99, 255, 0.20)");
    fill.addColorStop(1, "rgba(108, 99, 255, 0.02)");

    daySpark = new Chart(daySparkEl, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Completion %",
          data: values,
          borderColor: "rgba(108, 99, 255, 0.95)",
          backgroundColor: fill,
          pointRadius: 2,
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
        }
      }
    });
  }

  async function selectDay(iso) {
    const d = fromISODate(iso);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;

    yearSelect.value = String(y);
    monthSelect.value = String(m);

    const minDate = profile?.signupDate ? fromISODate(profile.signupDate) : null;
    if (minDate && d < minDate) {
      renderDayEmpty(iso);
      return;
    }

    try {
      dayEmpty?.classList.add("d-none");
      dayHabitList.innerHTML = `<div class="muted">Loading…</div>`;
      dayJournal.value = "";
      setDayHeader(iso, false);

      const entry = await apiJson(`/api/day/by-date?date=${encodeURIComponent(iso)}`, { method: "GET" });
      renderDayDetail(entry);
      await renderDaySparkline(iso);
    } catch (err) {
      // BusinessException: "No entry found for date" is 400 -> show empty state.
      renderDayEmpty(iso);
      try {
        await renderDaySparkline(iso);
      } catch {
        // ignore
      }
      console.error("[History] day load failed:", err);
    }
  }

  function buildCategoryBreakdown(allHabits, entries, dim) {
    const habitCounts = new Map();
    for (const h of allHabits || []) {
      const key = String(h.category || "OTHER");
      habitCounts.set(key, (habitCounts.get(key) || 0) + 1);
    }

    const completedByCategory = new Map();
    for (const entry of entries || []) {
      for (const hs of entry.habits || []) {
        const cat = String(hs.category || "OTHER");
        if (hs.completed) completedByCategory.set(cat, (completedByCategory.get(cat) || 0) + 1);
      }
    }

    const labels = [];
    const values = [];
    for (const [cat, count] of habitCounts.entries()) {
      const totalPossible = count * dim;
      const completed = completedByCategory.get(cat) || 0;
      const percent = totalPossible ? (completed * 100) / totalPossible : 0;
      labels.push(cat);
      values.push(clampPercent(percent));
    }

    return { labels, values };
  }

  function buildNotesSummary(entries) {
    const daysWithNotes = new Set();
    const feelCounts = new Map();
    const highlights = [];

    let noteCount = 0;

    const sorted = Array.from(entries || [])
      .slice()
      .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));

    for (const entry of sorted) {
      const iso = String(entry?.date || "");
      for (const h of entry?.habits || []) {
        const decoded = decodeNote(h.note);
        const noteText = (decoded.noteText || "").trim();
        const feel = (decoded.feel === "OTHER" ? decoded.feelOther : decoded.feel).trim();

        if (!noteText && !feel) continue;
        noteCount++;
        if (iso) daysWithNotes.add(iso);
        if (feel) feelCounts.set(feel, (feelCounts.get(feel) || 0) + 1);

        if (highlights.length < 4 && noteText) {
          highlights.push({
            date: iso,
            habitTitle: h.habitTitle || "",
            text: noteText
          });
        }
      }
    }

    const topFeels = Array.from(feelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([feel, count]) => ({ feel, count }));

    return {
      noteCount,
      daysWithNotes: daysWithNotes.size,
      topFeels,
      highlights
    };
  }

  function renderNotesSummary(container, summary) {
    if (!container) return;

    if (!summary?.noteCount) {
      container.innerHTML = `<div class="muted">No notes logged this month.</div>`;
      return;
    }

    const feelText = (summary.topFeels || [])
      .map((f) => `${escapeHtml(f.feel)} (${f.count})`)
      .join(" • ");

    const feelLine = feelText
      ? `<div class="note-line"><div class="note-k">Top feels</div><div class="note-v">${feelText}</div></div>`
      : "";

    const highlights = (summary.highlights || [])
      .map((h) => {
        const left = `${escapeHtml(h.habitTitle || "Habit")} · ${escapeHtml(h.date || "")}`;
        const right = escapeHtml(truncateText(h.text || "", 90));
        return `<div class="note-line"><div class="note-k">${left}</div><div class="note-v">${right}</div></div>`;
      })
      .join("");

    container.innerHTML = `
      <div class="note-line"><div class="note-k">Notes</div><div class="note-v">${summary.noteCount}</div></div>
      <div class="note-line"><div class="note-k">Days with notes</div><div class="note-v">${summary.daysWithNotes}</div></div>
      ${feelLine}
      ${highlights}
    `;
  }

  async function loadCompare() {
    if (!compareVisible) return;
    if (!compareYearSelect || !compareMonthSelect || !compareSection) return;
    if (!compareCategoryChartAEl || !compareCategoryChartBEl) return;

    const yA = Number(yearSelect.value);
    const mA = Number(monthSelect.value);
    const yB = Number(compareYearSelect.value);
    const mB = Number(compareMonthSelect.value);
    if (![yA, mA, yB, mB].every((n) => Number.isFinite(n))) return;

    compareSection.classList.remove("d-none");
    if (compareMonthLabelA) compareMonthLabelA.textContent = monthName(yA, mA);
    if (compareMonthLabelB) compareMonthLabelB.textContent = monthName(yB, mB);

    runCompareBtn?.classList.add("is-loading");
    if (runCompareBtn) runCompareBtn.disabled = true;

    try {
      const dimA = daysInMonth(yA, mA);
      const dimB = daysInMonth(yB, mB);
      const firstA = new Date(yA, mA - 1, 1);
      const lastA = new Date(yA, mA - 1, dimA);
      const firstB = new Date(yB, mB - 1, 1);
      const lastB = new Date(yB, mB - 1, dimB);

      const allHabits = Array.isArray(habits) && habits.length ? habits : await getMyHabits();
      const signupDate = profile?.signupDate ? fromISODate(profile.signupDate) : null;

      const [dailyA, entriesA, dailyB, entriesB] = await Promise.all([
        getDailyStats(toISODate(firstA), toISODate(lastA)),
        getEntriesForMonth(yA, mA),
        getDailyStats(toISODate(firstB), toISODate(lastB)),
        getEntriesForMonth(yB, mB)
      ]);

      const buildStrictPerDay = (dailyStats, year, month, dim) => {
        const statsMap = new Map((dailyStats || []).map((s) => [String(s.date), clampPercent(Number(s.completionPercent))]));
        const perDay = [];
        for (let day = 1; day <= dim; day++) {
          const dateObj = new Date(year, month - 1, day);
          const iso = toISODate(dateObj);
          let val = statsMap.get(iso) ?? 0;
          if (signupDate && dateObj < signupDate) val = 0;
          perDay.push(val);
        }
        return perDay;
      };

      const perDayA = buildStrictPerDay(dailyA, yA, mA, dimA);
      const perDayB = buildStrictPerDay(dailyB, yB, mB, dimB);

      const avgA = perDayA.reduce((a, b) => a + b, 0) / (perDayA.length || 1);
      const avgB = perDayB.reduce((a, b) => a + b, 0) / (perDayB.length || 1);

      setRing(compareRingA, compareRingValueA, compareRingLabelA, avgA, `${dimA} days`);
      setRing(compareRingB, compareRingValueB, compareRingLabelB, avgB, `${dimB} days`);

      const delta = avgB - avgA;
      if (compareDeltaEl) {
        const sign = delta > 0 ? "+" : "";
        compareDeltaEl.textContent = `${sign}${delta.toFixed(1)}%`;
      }

      const catA = buildCategoryBreakdown(allHabits, entriesA || [], dimA);
      const catB = buildCategoryBreakdown(allHabits, entriesB || [], dimB);

      const chartOptions = { responsive: true, plugins: { legend: { position: "bottom" } } };
      const datasetOptions = {
        backgroundColor: [
          "rgba(108, 99, 255, 0.85)",
          "rgba(16, 185, 129, 0.75)",
          "rgba(245, 158, 11, 0.75)",
          "rgba(59, 130, 246, 0.70)",
          "rgba(239, 68, 68, 0.70)",
          "rgba(17, 24, 39, 0.20)"
        ],
        borderColor: "rgba(255,255,255,0.9)",
        borderWidth: 2,
        hoverOffset: 6
      };

      destroyChart(compareCategoryChartA);
      compareCategoryChartA = new Chart(compareCategoryChartAEl, {
        type: "doughnut",
        data: {
          labels: catA.labels,
          datasets: [{ data: catA.values, ...datasetOptions }]
        },
        options: chartOptions
      });

      destroyChart(compareCategoryChartB);
      compareCategoryChartB = new Chart(compareCategoryChartBEl, {
        type: "doughnut",
        data: {
          labels: catB.labels,
          datasets: [{ data: catB.values, ...datasetOptions }]
        },
        options: chartOptions
      });

      renderNotesSummary(compareNotesA, buildNotesSummary(entriesA || []));
      renderNotesSummary(compareNotesB, buildNotesSummary(entriesB || []));
    } catch (err) {
      compareSection.classList.add("d-none");
      alert(err?.message || "Failed to compare months");
      console.error("[History] compare failed:", err);
    } finally {
      runCompareBtn?.classList.remove("is-loading");
      if (runCompareBtn) runCompareBtn.disabled = false;
    }
  }

  async function loadMonth(year, month) {
    loadBtn.disabled = true;
    loadBtn.classList.add("is-loading");

    const dim = daysInMonth(year, month);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month - 1, dim);

    try {
      promptBox.value = "Loading…";
      exportBox.value = "Loading…";

      const [dailyStats, monthHabits, entries, exportText, prompt] = await Promise.all([
        getDailyStats(toISODate(first), toISODate(last)),
        getMyHabits(),
        getEntriesForMonth(year, month),
        exportMonthText(year, month),
        getMonthlyAiPrompt(year, month)
      ]);

      habits = monthHabits || [];
      monthEntries = entries || [];

      exportBox.value = exportText.exportText || "";
      promptBox.value = prompt.prompt || "";

      // Strict month line (fill missing days)
      const statsMap = new Map((dailyStats || []).map((s) => [String(s.date), clampPercent(Number(s.completionPercent))]));
      const signupDate = profile?.signupDate ? fromISODate(profile.signupDate) : null;

      const perDay = [];
      for (let day = 1; day <= dim; day++) {
        const dateObj = new Date(year, month - 1, day);
        const iso = toISODate(dateObj);
        let val = statsMap.get(iso) ?? 0;
        if (signupDate && dateObj < signupDate) val = 0;
        perDay.push(val);
      }

      const monthAvgStrict = perDay.reduce((a, b) => a + b, 0) / (perDay.length || 1);
      setRing(ring, ringValue, ringLabel, monthAvgStrict, `${dim} days`);

      destroyChart(dailyChart);
      const ctx = dailyChartEl.getContext("2d");
      const fill = ctx.createLinearGradient(0, 0, 0, 240);
      fill.addColorStop(0, "rgba(108, 99, 255, 0.22)");
      fill.addColorStop(1, "rgba(108, 99, 255, 0.02)");
      dailyChart = new Chart(dailyChartEl, {
        type: "line",
        data: {
          labels: Array.from({ length: dim }, (_, i) => String(i + 1)),
          datasets: [{
            label: "Completion %",
            data: perDay,
            borderColor: "rgba(108, 99, 255, 0.95)",
            backgroundColor: fill,
            pointRadius: 2,
            tension: 0.28,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
          }
        }
      });

      // Category breakdown strict (active habits × days)
      const habitCounts = new Map();
      for (const h of habits || []) {
        const key = String(h.category || "OTHER");
        habitCounts.set(key, (habitCounts.get(key) || 0) + 1);
      }

      const completedByCategory = new Map();
      for (const entry of monthEntries || []) {
        for (const hs of entry.habits || []) {
          const cat = String(hs.category || "OTHER");
          if (hs.completed) completedByCategory.set(cat, (completedByCategory.get(cat) || 0) + 1);
        }
      }

      const labels = [];
      const values = [];
      for (const [cat, count] of habitCounts.entries()) {
        const totalPossible = count * dim;
        const completed = completedByCategory.get(cat) || 0;
        const percent = totalPossible ? (completed * 100) / totalPossible : 0;
        labels.push(cat);
        values.push(clampPercent(percent));
      }

      destroyChart(categoryChart);
      categoryChart = new Chart(categoryChartEl, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: [
              "rgba(108, 99, 255, 0.85)",
              "rgba(16, 185, 129, 0.75)",
              "rgba(245, 158, 11, 0.75)",
              "rgba(59, 130, 246, 0.70)",
              "rgba(239, 68, 68, 0.70)",
              "rgba(17, 24, 39, 0.20)"
            ],
            borderColor: "rgba(255,255,255,0.9)",
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } }
        }
      });

      renderCalendar(year, month);

      document.querySelectorAll(".glass-card").forEach((el, i) => {
        el.classList.add("fade-up");
        window.setTimeout(() => el.classList.add("is-visible"), 40 + i * 60);
      });
    } catch (err) {
      alert(err?.message || "Failed to load history");
      console.error("[History] month load failed:", err);
    } finally {
      loadBtn.disabled = false;
      loadBtn.classList.remove("is-loading");
    }
  }

  function stepMonth(delta) {
    const y = Number(yearSelect.value);
    const m = Number(monthSelect.value);
    const date = new Date(y, m - 1, 1);
    date.setMonth(date.getMonth() + delta);
    yearSelect.value = String(date.getFullYear());
    monthSelect.value = String(date.getMonth() + 1);
    loadMonth(date.getFullYear(), date.getMonth() + 1);
  }

  async function init() {
    try {
      profile = await getMyProfile();
    } catch (err) {
      alert(err?.message || "Failed to load profile");
      return;
    }

    buildYearOptions();
    buildMonthOptions();
    setCurrentMonth();
    setCompareDefaultMonth();

    // Date input boundaries
    if (historyDate) {
      if (profile.signupDate) historyDate.min = profile.signupDate;
      historyDate.max = toISODate(new Date());
      historyDate.value = toISODate(new Date());
    }

    // Hooks
    loadBtn?.addEventListener("click", () => loadMonth(Number(yearSelect.value), Number(monthSelect.value)));
    prevMonthBtn?.addEventListener("click", () => stepMonth(-1));
    nextMonthBtn?.addEventListener("click", () => stepMonth(1));

    goDateBtn?.addEventListener("click", () => {
      if (!historyDate?.value) return;
      selectDay(historyDate.value);
    });
    historyDate?.addEventListener("change", () => {
      if (!historyDate?.value) return;
      selectDay(historyDate.value);
    });

    yearSelect.addEventListener("change", () => loadMonth(Number(yearSelect.value), Number(monthSelect.value)));
    monthSelect.addEventListener("change", () => loadMonth(Number(yearSelect.value), Number(monthSelect.value)));

    toggleCompareBtn?.addEventListener("click", () => {
      compareVisible = !compareVisible;
      comparePicker?.classList.toggle("d-none", !compareVisible);
      compareSection?.classList.toggle("d-none", !compareVisible);
      if (compareVisible) {
        setCompareDefaultMonth();
        loadCompare();
      }
    });

    runCompareBtn?.addEventListener("click", loadCompare);
    compareYearSelect?.addEventListener("change", loadCompare);
    compareMonthSelect?.addEventListener("change", loadCompare);

    yearSelect.addEventListener("change", () => {
      if (compareVisible) loadCompare();
    });
    monthSelect.addEventListener("change", () => {
      if (compareVisible) loadCompare();
    });

    copyPromptBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(promptBox.value || "");
      } catch {
        alert("Copy failed");
      }
    });
    copyExportBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(exportBox.value || "");
      } catch {
        alert("Copy failed");
      }
    });

    // Initial load
    await loadMonth(Number(yearSelect.value), Number(monthSelect.value));
    if (historyDate?.value) await selectDay(historyDate.value);
  }

  init();
})();
