(() => {
  const workoutListEl = document.getElementById("workoutList");
  const createForm = document.getElementById("createWorkoutForm");
  const newWorkoutNameEl = document.getElementById("newWorkoutName");
  const workoutSearchEl = document.getElementById("workoutSearchInput");

  const builderHintEl = document.getElementById("builderHint");
  const builderWorkoutSelectEl = document.getElementById("builderWorkoutSelect");
  const renameWorkoutBtn = document.getElementById("renameWorkoutBtn");
  const deactivateWorkoutBtn = document.getElementById("deactivateWorkoutBtn");
  const builderToolsEl = document.getElementById("builderTools");
  const exerciseSearchEl = document.getElementById("exerciseSearchInput");
  const builderListEl = document.getElementById("builderList");

  const quickLinkForm = document.getElementById("quickLinkExerciseForm");
  const quickLinkNameEl = document.getElementById("quickLinkExerciseName");
  const quickLinkTypeEl = document.getElementById("quickLinkExerciseType");

  const weekPlanEl = document.getElementById("weekPlanEditor");
  const planStatusEl = document.getElementById("planStatus");
  const savePlanBtn = document.getElementById("savePlanBtn");
  const copyMondayBtn = document.getElementById("copyMondayBtn");
  const restAllBtn = document.getElementById("restAllBtn");

  const state = {
    workouts: [],
    exercises: [],
    assignments: new Map(), // weekday -> workoutId (string or "")
    workoutExercises: new Map(), // workoutId -> Array(exerciseId string) in order
    selectedWorkoutId: "",
    workoutSearch: "",
    exerciseSearch: "",
    dirty: false
  };

  function normalizeExerciseType(type) {
    const t = String(type || "").trim();
    return t || "General";
  }

  function markDirty() {
    if (state.dirty) return;
    state.dirty = true;
    gymSetStatus(planStatusEl, "Unsaved changes. Click “Save Plan”.", "warn");
  }

  function clearDirty() {
    state.dirty = false;
    gymClearStatus(planStatusEl);
  }

  function workoutById(id) {
    if (id == null) return null;
    return state.workouts.find((w) => String(w.id) === String(id)) || null;
  }

  function exerciseById(id) {
    if (id == null) return null;
    return state.exercises.find((e) => String(e.id) === String(id)) || null;
  }

  function normalizePlan(plan) {
    state.assignments.clear();
    for (let i = 0; i < 7; i++) state.assignments.set(String(i), "");
    (plan?.assignments || []).forEach((a) => {
      state.assignments.set(String(a.weekday), a.workoutId == null ? "" : String(a.workoutId));
    });

    state.workoutExercises.clear();
    (plan?.workoutExercises || []).forEach((m) => {
      const ids = (m.exerciseIds || []).map((x) => String(x));
      state.workoutExercises.set(String(m.workoutId), ids);
    });
  }

  function sanitizeAgainstActiveLists() {
    const activeWorkoutIds = new Set(state.workouts.map((w) => String(w.id)));
    const activeExerciseIds = new Set(state.exercises.map((e) => String(e.id)));

    for (let weekday = 0; weekday < 7; weekday++) {
      const id = state.assignments.get(String(weekday)) || "";
      if (id && !activeWorkoutIds.has(String(id))) {
        state.assignments.set(String(weekday), "");
      }
    }

    for (const [workoutId, exerciseIds] of Array.from(state.workoutExercises.entries())) {
      if (!activeWorkoutIds.has(String(workoutId))) {
        state.workoutExercises.delete(String(workoutId));
        continue;
      }
      state.workoutExercises.set(
        String(workoutId),
        (exerciseIds || []).map(String).filter((x) => activeExerciseIds.has(String(x)))
      );
    }

    if (state.selectedWorkoutId && !activeWorkoutIds.has(String(state.selectedWorkoutId))) {
      state.selectedWorkoutId = "";
    }
  }

  function ensureWorkoutExerciseList(workoutId) {
    const key = String(workoutId);
    if (!state.workoutExercises.has(key)) state.workoutExercises.set(key, []);
    return state.workoutExercises.get(key);
  }

  function addExerciseToWorkout(workoutId, exerciseId) {
    const list = ensureWorkoutExerciseList(workoutId);
    const id = String(exerciseId);
    if (list.includes(id)) return;
    list.push(id);
    markDirty();
  }

  function removeExerciseFromWorkout(workoutId, exerciseId) {
    const list = ensureWorkoutExerciseList(workoutId);
    const id = String(exerciseId);
    const idx = list.indexOf(id);
    if (idx < 0) return;
    list.splice(idx, 1);
    markDirty();
  }

  function moveExercise(workoutId, exerciseId, dir) {
    const list = ensureWorkoutExerciseList(workoutId);
    const id = String(exerciseId);
    const idx = list.indexOf(id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    const tmp = list[nextIdx];
    list[nextIdx] = list[idx];
    list[idx] = tmp;
    markDirty();
  }

  function getWorkoutUsageDays(workoutId) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const assigned = state.assignments.get(String(i)) || "";
      if (assigned && String(assigned) === String(workoutId)) days.push(i);
    }
    return days;
  }

  function workoutOptionsHtml(selectedId) {
    const opts = [`<option value="">Rest day</option>`];
    state.workouts.forEach((w) => {
      opts.push(`<option value="${w.id}" ${String(w.id) === String(selectedId) ? "selected" : ""}>${w.name}</option>`);
    });
    return opts.join("");
  }

  function renderWorkoutSelect() {
    const current = state.selectedWorkoutId || "";
    builderWorkoutSelectEl.innerHTML = `<option value="">Select workout…</option>` + state.workouts
      .map((w) => `<option value="${w.id}" ${String(w.id) === String(current) ? "selected" : ""}>${w.name}</option>`)
      .join("");
  }

  function renderWorkouts() {
    const q = String(state.workoutSearch || "").trim().toLowerCase();
    const filtered = state.workouts.filter((w) => {
      if (!q) return true;
      return String(w.name || "").toLowerCase().includes(q);
    });

    if (!filtered.length) {
      workoutListEl.innerHTML = `<div class="gym-helper">${state.workouts.length ? "No matches." : "No workouts yet."}</div>`;
      return;
    }

    workoutListEl.innerHTML = filtered.map((w) => {
      const exCount = (state.workoutExercises.get(String(w.id)) || []).length;
      const usedDays = getWorkoutUsageDays(w.id);
      const usedLabel = usedDays.length ? `Used: ${usedDays.map(gymDOWLabel).join(", ")}` : "Not in plan yet";
      const isSelected = state.selectedWorkoutId && String(state.selectedWorkoutId) === String(w.id);
      return `
        <button type="button" class="gym-row gym-click-row ${isSelected ? "is-selected" : ""}" data-workout-id="${w.id}">
          <div style="min-width: 0;">
            <div class="gym-row__title">${w.name}</div>
            <div class="gym-row__meta">${exCount} exercise${exCount === 1 ? "" : "s"} · ${usedLabel}</div>
          </div>
          <div class="gym-badge is-today" style="flex-shrink: 0;">
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
            <span>Edit</span>
          </div>
        </button>
      `;
    }).join("");

    workoutListEl.querySelectorAll(".gym-click-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-workout-id");
        if (!id) return;
        state.selectedWorkoutId = String(id);
        renderWorkoutSelect();
        renderWorkouts();
        renderBuilder();
        renderWeekPlan();
      });
    });
  }

  function renderBuilder() {
    const workoutId = state.selectedWorkoutId || "";
    const w = workoutById(workoutId);

    const canEdit = Boolean(workoutId && w);
    renameWorkoutBtn.disabled = !canEdit;
    deactivateWorkoutBtn.disabled = !canEdit;

    if (!canEdit) {
      if (builderHintEl) builderHintEl.textContent = "Select a workout to add exercises.";
      if (builderToolsEl) builderToolsEl.classList.add("d-none");
      builderListEl.innerHTML = `<div class="gym-helper">Pick a workout from the left (or from the dropdown) to start building it.</div>`;
      return;
    }

    const usedDays = getWorkoutUsageDays(workoutId);
    const usedText = usedDays.length ? `Used on: ${usedDays.map(gymDOWLabel).join(", ")}` : "Not used in weekly plan yet.";
    if (builderHintEl) builderHintEl.textContent = `${w.name} · ${usedText}`;
    if (builderToolsEl) builderToolsEl.classList.remove("d-none");

    if (!state.exercises.length) {
      builderListEl.innerHTML = `<div class="gym-helper">No exercises yet. Create exercises first in <a href="exercise-setup.html">Exercise Setup</a>.</div>`;
      return;
    }

    const q = String(state.exerciseSearch || "").trim().toLowerCase();
    const matches = (ex) => {
      if (!q) return true;
      const hay = `${ex.name || ""} ${ex.type || ""}`.toLowerCase();
      return hay.includes(q);
    };

    const selectedIds = ensureWorkoutExerciseList(workoutId);
    const selectedExercises = selectedIds
      .map((id) => exerciseById(id))
      .filter(Boolean)
      .filter(matches);

    const selectedSet = new Set(selectedIds.map(String));
    const available = state.exercises
      .filter((ex) => !selectedSet.has(String(ex.id)))
      .filter(matches);

    function selectedRowHtml(ex) {
      const id = String(ex.id);
      const order = selectedIds.indexOf(id);
      const upDisabled = order <= 0 ? "disabled" : "";
      const downDisabled = order >= selectedIds.length - 1 ? "disabled" : "";

      return `
        <div class="gym-row" data-exercise-id="${ex.id}" style="align-items: center;">
          <div style="min-width: 0;">
            <div class="gym-row__title">${ex.name}</div>
            <div class="gym-row__meta">${ex.type}</div>
          </div>
          <div class="d-flex gap-2" style="flex-shrink: 0;">
            <button class="btn btn-outline-secondary btn-sm gym-move-up" type="button" ${upDisabled} title="Move up">
              <i class="bi bi-arrow-up" aria-hidden="true"></i>
            </button>
            <button class="btn btn-outline-secondary btn-sm gym-move-down" type="button" ${downDisabled} title="Move down">
              <i class="bi bi-arrow-down" aria-hidden="true"></i>
            </button>
            <button class="btn btn-outline-secondary btn-sm gym-unlink" type="button">
              <i class="bi bi-dash-lg me-2" aria-hidden="true"></i>
              Remove
            </button>
          </div>
        </div>
      `;
    }

    function availableRowHtml(ex) {
      return `
        <div class="gym-row" data-exercise-id="${ex.id}" style="align-items: center;">
          <div style="min-width: 0;">
            <div class="gym-row__title">${ex.name}</div>
            <div class="gym-row__meta">${ex.type}</div>
          </div>
          <div class="d-flex gap-2" style="flex-shrink: 0;">
            <button class="btn btn-outline-secondary btn-sm gym-link" type="button">
              <i class="bi bi-plus-lg me-2" aria-hidden="true"></i>
              Add
            </button>
          </div>
        </div>
      `;
    }

    builderListEl.innerHTML = `
      <div class="gym-grid-2 gym-link-grid">
        <div>
          <div class="section-title" style="font-size: 14px;">In this workout (${selectedIds.length})</div>
          <div class="gym-helper mb-2">${selectedIds.length ? "Reorder or remove exercises." : "Nothing linked yet."}</div>
          ${(selectedExercises.length ? selectedExercises.map(selectedRowHtml).join("") : (q ? `<div class="gym-helper">No matches.</div>` : ""))}
        </div>
        <div>
          <div class="section-title" style="font-size: 14px;">All exercises</div>
          <div class="gym-helper mb-2">${q ? `Filtered by “${state.exerciseSearch}”.` : "Search and add."}</div>
          ${(available.length ? available.map(availableRowHtml).join("") : `<div class="gym-helper">No matches.</div>`)}
        </div>
      </div>
    `;

    builderListEl.querySelectorAll(".gym-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".gym-row");
        const exId = row?.getAttribute("data-exercise-id");
        if (!exId) return;
        addExerciseToWorkout(workoutId, exId);
        renderWorkouts();
        renderBuilder();
        renderWeekPlan();
      });
    });

    builderListEl.querySelectorAll(".gym-unlink").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".gym-row");
        const exId = row?.getAttribute("data-exercise-id");
        if (!exId) return;
        removeExerciseFromWorkout(workoutId, exId);
        renderWorkouts();
        renderBuilder();
        renderWeekPlan();
      });
    });

    builderListEl.querySelectorAll(".gym-move-up").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".gym-row");
        const exId = row?.getAttribute("data-exercise-id");
        if (!exId) return;
        moveExercise(workoutId, exId, -1);
        renderBuilder();
        renderWeekPlan();
      });
    });

    builderListEl.querySelectorAll(".gym-move-down").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".gym-row");
        const exId = row?.getAttribute("data-exercise-id");
        if (!exId) return;
        moveExercise(workoutId, exId, +1);
        renderBuilder();
        renderWeekPlan();
      });
    });
  }

  function previewExercisesHtml(workoutId) {
    if (!workoutId) return `<span class="gym-helper">Rest day.</span>`;
    const ids = state.workoutExercises.get(String(workoutId)) || [];
    if (!ids.length) return `<span class="gym-helper">No exercises linked.</span>`;

    const names = ids
      .map((id) => exerciseById(id))
      .filter(Boolean)
      .map((ex) => ex.name);

    if (!names.length) return `<span class="gym-helper">No exercises linked.</span>`;

    const shown = names.slice(0, 5);
    const remaining = names.length - shown.length;
    const more = remaining > 0 ? `<li class="gym-helper">+ ${remaining} more</li>` : "";
    return `
      <ul class="gym-mini-list">
        ${shown.map((n) => `<li>${n}</li>`).join("")}
        ${more}
      </ul>
    `;
  }

  function renderWeekPlan() {
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const workoutId = state.assignments.get(String(i)) || "";
      const w = workoutById(workoutId);
      const workoutName = workoutId ? (w?.name || "Workout") : "Rest";

      const editBtnDisabled = workoutId ? "" : "disabled";
      rows.push(`
        <div class="gym-row gym-plan-row" data-weekday="${i}" style="align-items: flex-start;">
          <div style="min-width: 0;">
            <div class="gym-row__title">${gymDOWLabel(i)}</div>
            <div class="gym-row__meta">${workoutName}</div>
            <div class="mt-2">${previewExercisesHtml(workoutId)}</div>
          </div>
          <div style="flex-shrink: 0; width: min(360px, 46vw);">
            <select class="form-select form-select-sm gym-weekday-select" data-weekday="${i}">
              ${workoutOptionsHtml(workoutId)}
            </select>
            <div class="d-flex gap-2 mt-2">
              <button type="button" class="btn btn-outline-secondary btn-sm gym-edit-workout" data-workout-id="${workoutId}" ${editBtnDisabled}>
                <i class="bi bi-sliders me-2" aria-hidden="true"></i>
                Edit exercises
              </button>
            </div>
          </div>
        </div>
      `);
    }
    weekPlanEl.innerHTML = rows.join("");

    weekPlanEl.querySelectorAll(".gym-weekday-select").forEach((select) => {
      select.addEventListener("change", () => {
        const weekday = select.getAttribute("data-weekday");
        state.assignments.set(String(weekday), select.value || "");
        markDirty();
        renderWorkouts();
        renderBuilder();
        renderWeekPlan();
      });
    });

    weekPlanEl.querySelectorAll(".gym-edit-workout").forEach((btn) => {
      btn.addEventListener("click", () => {
        const workoutId = btn.getAttribute("data-workout-id") || "";
        if (!workoutId) return;
        state.selectedWorkoutId = String(workoutId);
        renderWorkoutSelect();
        renderWorkouts();
        renderBuilder();
        renderWeekPlan();
        builderWorkoutSelectEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  createForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = String(newWorkoutNameEl.value || "").trim();
    if (!name) return;
    try {
      const created = await createGymWorkout({ name });
      if (created?.id != null) {
        state.workouts = [...state.workouts, created];
        state.selectedWorkoutId = String(created.id);
        newWorkoutNameEl.value = "";
        renderWorkoutSelect();
        renderWorkouts();
        renderBuilder();
        renderWeekPlan();
      }
    } catch (err) {
      alert(err?.message || "Create failed");
    }
  });

  workoutSearchEl?.addEventListener("input", () => {
    state.workoutSearch = workoutSearchEl.value || "";
    renderWorkouts();
  });

  builderWorkoutSelectEl?.addEventListener("change", () => {
    state.selectedWorkoutId = builderWorkoutSelectEl.value || "";
    state.exerciseSearch = "";
    if (exerciseSearchEl) exerciseSearchEl.value = "";
    renderWorkouts();
    renderBuilder();
    renderWeekPlan();
  });

  exerciseSearchEl?.addEventListener("input", () => {
    state.exerciseSearch = exerciseSearchEl.value || "";
    renderBuilder();
  });

  renameWorkoutBtn?.addEventListener("click", async () => {
    const id = state.selectedWorkoutId || "";
    const w = workoutById(id);
    if (!id || !w) return;
    const next = prompt("Rename workout:", w?.name || "");
    if (!next) return;
    try {
      await updateGymWorkout(id, { name: next });
      const idx = state.workouts.findIndex((x) => String(x.id) === String(id));
      if (idx >= 0) state.workouts[idx] = { ...state.workouts[idx], name: next };
      renderWorkoutSelect();
      renderWorkouts();
      renderBuilder();
      renderWeekPlan();
    } catch (err) {
      alert(err?.message || "Rename failed");
    }
  });

  deactivateWorkoutBtn?.addEventListener("click", async () => {
    const id = state.selectedWorkoutId || "";
    const w = workoutById(id);
    if (!id || !w) return;
    if (!confirm("Deactivate this workout? It will stop showing in future plans.")) return;
    try {
      await deactivateGymWorkout(id);

      const wasAssigned = getWorkoutUsageDays(id).length > 0;
      if (wasAssigned) {
        for (let i = 0; i < 7; i++) {
          const assigned = state.assignments.get(String(i)) || "";
          if (String(assigned) === String(id)) state.assignments.set(String(i), "");
        }
      }
      if (state.workoutExercises.has(String(id))) {
        state.workoutExercises.delete(String(id));
        markDirty();
      }
      if (wasAssigned) markDirty();

      state.workouts = state.workouts.filter((x) => String(x.id) !== String(id));
      state.selectedWorkoutId = "";

      renderWorkoutSelect();
      renderWorkouts();
      renderBuilder();
      renderWeekPlan();
    } catch (err) {
      alert(err?.message || "Deactivate failed");
    }
  });

  quickLinkForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const workoutId = state.selectedWorkoutId || "";
    if (!workoutId) return;
    const name = String(quickLinkNameEl?.value || "").trim();
    if (!name) return;
    const type = normalizeExerciseType(quickLinkTypeEl?.value);

    try {
      const created = await createGymExercise({ name, type });
      if (created?.id != null) {
        state.exercises = [...state.exercises, created];
        addExerciseToWorkout(workoutId, created.id);
      }
      quickLinkNameEl.value = "";
      quickLinkTypeEl.value = "";
      renderBuilder();
      renderWorkouts();
      renderWeekPlan();
    } catch (err) {
      alert(err?.message || "Create failed");
    }
  });

  copyMondayBtn?.addEventListener("click", () => {
    const mon = state.assignments.get("1") || "";
    for (let i = 0; i < 7; i++) state.assignments.set(String(i), mon);
    markDirty();
    renderWorkouts();
    renderBuilder();
    renderWeekPlan();
  });

  restAllBtn?.addEventListener("click", () => {
    for (let i = 0; i < 7; i++) state.assignments.set(String(i), "");
    markDirty();
    renderWorkouts();
    renderBuilder();
    renderWeekPlan();
  });

  savePlanBtn?.addEventListener("click", async () => {
    gymClearStatus(planStatusEl);

    const assignments = [];
    for (let i = 0; i < 7; i++) {
      const workoutId = state.assignments.get(String(i)) || "";
      assignments.push({
        weekday: i,
        workoutId: workoutId ? Number(workoutId) : null
      });
    }

    const activeWorkoutIds = new Set(state.workouts.map((w) => String(w.id)));
    const usedWorkoutIds = new Set(assignments.map((a) => a.workoutId).filter(Boolean).map((x) => String(x)));
    for (const workoutId of state.workoutExercises.keys()) {
      if (activeWorkoutIds.has(String(workoutId))) usedWorkoutIds.add(String(workoutId));
    }

    const workoutExercises = Array.from(usedWorkoutIds).map((workoutId) => {
      const list = state.workoutExercises.get(String(workoutId)) || [];
      return { workoutId: Number(workoutId), exerciseIds: list.map((x) => Number(x)) };
    });

    try {
      const saved = await saveGymPlan({ assignments, workoutExercises });
      normalizePlan(saved);
      sanitizeAgainstActiveLists();
      clearDirty();
      gymSetStatus(planStatusEl, "Plan saved (effective today).", "ok");
      renderWorkouts();
      renderWorkoutSelect();
      renderBuilder();
      renderWeekPlan();
      setTimeout(() => {
        if (!state.dirty) gymClearStatus(planStatusEl);
      }, 2000);
    } catch (err) {
      gymSetStatus(planStatusEl, err?.message || "Save failed.", "err");
    }
  });

  async function loadAll() {
    document.body.classList.add("gym-is-loading");
    workoutListEl.innerHTML = `<div class="gym-skeleton" style="height: 76px;"></div>`;
    builderListEl.innerHTML = `<div class="gym-skeleton" style="height: 120px;"></div>`;
    weekPlanEl.innerHTML = `<div class="gym-skeleton" style="height: 220px;"></div>`;
    if (builderToolsEl) builderToolsEl.classList.add("d-none");
    clearDirty();

    const [workouts, exercises, plan] = await Promise.all([
      getGymWorkouts(),
      getGymExercises(),
      getGymPlanCurrent()
    ]);

    state.workouts = workouts || [];
    state.exercises = exercises || [];
    normalizePlan(plan);
    sanitizeAgainstActiveLists();

    if (!state.selectedWorkoutId && state.workouts.length) {
      state.selectedWorkoutId = String(state.workouts[0].id);
    }

    renderWorkoutSelect();
    renderWorkouts();
    renderBuilder();
    renderWeekPlan();
    document.body.classList.remove("gym-is-loading");
  }

  async function init() {
    await gymRenderWelcomeName();
    gymStartClock();
    await loadAll();
  }

  init();
})();

