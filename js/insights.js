(() => {
  const yearSelect = document.getElementById("insightsYear");
  const monthSelect = document.getElementById("insightsMonth");
  const reloadBtn = document.getElementById("reloadInsightsBtn");

  const monthRing = document.getElementById("monthRing");
  const monthRingValue = document.getElementById("monthRingValue");
  const monthRingLabel = document.getElementById("monthRingLabel");
  const signupDateEl = document.getElementById("signupDate");
  const recordedDaysEl = document.getElementById("recordedDays");
  const streakLineEl = document.getElementById("streakLine");

  const monthlyAvgEl = document.getElementById("monthlyAvg");
  const monthlyTasksEl = document.getElementById("monthlyTasks");
  const monthlyBestEl = document.getElementById("monthlyBest");
  const monthlyWorstEl = document.getElementById("monthlyWorst");

  const weeklyChartEl = document.getElementById("weeklyChart");
  const dailyLineChartEl = document.getElementById("dailyLineChart");
  const categoryChartEl = document.getElementById("categoryChart");

  if (!yearSelect || !monthSelect) return;

  let weeklyChart = null;
  let dailyChart = null;
  let categoryChart = null;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
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
  }

  function buildYearOptions() {
    yearSelect.innerHTML = "";
    const now = new Date();
    const current = now.getFullYear();
    for (let y = current - 2; y <= current + 1; y++) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = String(current);
  }

  function setDefaultMonth() {
    const now = new Date();
    monthSelect.value = String(now.getMonth() + 1);
  }

  function destroyChart(chart) {
    try {
      chart?.destroy();
    } catch {
      // ignore
    }
  }

  function safeNumber(n, fallback) {
    return Number.isFinite(n) ? n : fallback;
  }

  function formatPercent(n) {
    const v = safeNumber(n, 0);
    return `${v.toFixed(1)}%`;
  }

  function clampPercent(n) {
    const v = safeNumber(n, 0);
    return Math.max(0, Math.min(100, v));
  }

  function setRing(percent, label) {
    const p = Math.round(clampPercent(percent));
    monthRing?.style.setProperty("--p", String(p));
    if (monthRingValue) monthRingValue.textContent = `${p}%`;
    if (monthRingLabel) monthRingLabel.textContent = label;
  }

  function segmentWeekAverages(perDay) {
    const segments = [
      { key: "W1", start: 1, end: 7 },
      { key: "W2", start: 8, end: 14 },
      { key: "W3", start: 15, end: 21 },
      { key: "W4", start: 22, end: perDay.length }
    ];

    return segments.map((seg) => {
      const slice = perDay.slice(seg.start - 1, seg.end);
      const avg = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
      return { label: seg.key, value: avg };
    });
  }

  async function load() {
    reloadBtn.disabled = true;
    reloadBtn.classList.add("is-loading");

    const year = Number(yearSelect.value);
    const month = Number(monthSelect.value);
    const dim = daysInMonth(year, month);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month - 1, dim);

    try {
      const [profile, streak, dailyStats, monthStats, habits, monthEntries] = await Promise.all([
        getMyProfile(),
        getStreakStats(),
        getDailyStats(toISODate(first), toISODate(last)),
        getMonthlyStats(year, month),
        getMyHabits(),
        getEntriesForMonth(year, month)
      ]);

      signupDateEl.textContent = profile.signupDate || "—";
      streakLineEl.textContent = `${streak.currentStreakDays} days (best ${streak.longestStreakDays})`;

      const signupDate = profile.signupDate ? new Date(`${profile.signupDate}T00:00:00`) : null;

      const statsMap = new Map((dailyStats || []).map((d) => [String(d.date), safeNumber(d.completionPercent, 0)]));

      const perDay = [];
      let recordedDays = 0;
      for (let day = 1; day <= dim; day++) {
        const dateObj = new Date(year, month - 1, day);
        const iso = toISODate(dateObj);
        let val = statsMap.get(iso) ?? 0;

        if (signupDate && dateObj < signupDate) val = 0;
        if (statsMap.has(iso)) recordedDays++;

        perDay.push(clampPercent(val));
      }

      recordedDaysEl.textContent = `${recordedDays}/${dim}`;

      const monthAvgStrict = perDay.reduce((a, b) => a + b, 0) / (perDay.length || 1);
      setRing(monthAvgStrict, `${recordedDays}/${dim} days`);

      // Weekly chart
      destroyChart(weeklyChart);
      const weekly = segmentWeekAverages(perDay);
      weeklyChart = new Chart(weeklyChartEl, {
        type: "bar",
        data: {
          labels: weekly.map((w) => w.label),
          datasets: [{
            label: "Avg %",
            data: weekly.map((w) => w.value),
            backgroundColor: "rgba(108, 99, 255, 0.78)",
            borderRadius: 10
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue}%` } }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
          }
        }
      });

      // Daily line chart (strict)
      destroyChart(dailyChart);
      const ctx = dailyLineChartEl.getContext("2d");
      const fill = ctx.createLinearGradient(0, 0, 0, 240);
      fill.addColorStop(0, "rgba(108, 99, 255, 0.22)");
      fill.addColorStop(1, "rgba(108, 99, 255, 0.02)");
      dailyChart = new Chart(dailyLineChartEl, {
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

      // Monthly stats (backend recorded)
      monthlyAvgEl.textContent = formatPercent(monthStats.averageCompletionPercent);
      monthlyTasksEl.textContent = `${monthStats.completedTasks}/${monthStats.totalTasks}`;
      monthlyBestEl.textContent = monthStats.bestDay ? `${monthStats.bestDay} (${formatPercent(monthStats.bestDayPercent)})` : "—";
      monthlyWorstEl.textContent = monthStats.worstDay ? `${monthStats.worstDay} (${formatPercent(monthStats.worstDayPercent)})` : "—";

      // Categories (calendar-strict based on active habits)
      const habitCounts = new Map();
      for (const h of habits || []) {
        const key = String(h.category || "OTHER");
        habitCounts.set(key, (habitCounts.get(key) || 0) + 1);
      }

      const completedByCategory = new Map();
      for (const entry of monthEntries || []) {
        for (const hs of entry.habits || []) {
          const cat = String(hs.category || "OTHER");
          if (hs.completed) {
            completedByCategory.set(cat, (completedByCategory.get(cat) || 0) + 1);
          }
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
          plugins: {
            legend: { position: "bottom" },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.formattedValue}%` } }
          }
        }
      });

      document.querySelectorAll(".glass-card").forEach((el, i) => {
        el.classList.add("fade-up");
        window.setTimeout(() => el.classList.add("is-visible"), 40 + i * 60);
      });
    } catch (err) {
      alert(err?.message || "Failed to load insights");
    } finally {
      reloadBtn.disabled = false;
      reloadBtn.classList.remove("is-loading");
    }
  }

  buildYearOptions();
  buildMonthOptions();
  setDefaultMonth();

  reloadBtn?.addEventListener("click", load);
  yearSelect.addEventListener("change", load);
  monthSelect.addEventListener("change", load);

  load();
})();
