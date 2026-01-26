(() => {
  const listEl = document.getElementById("exerciseList");
  const form = document.getElementById("createExerciseForm");
  const nameEl = document.getElementById("newExerciseName");
  const typeEl = document.getElementById("newExerciseType");

  const bulkExercisesEl = document.getElementById("bulkExercises");
  const bulkTypeEl = document.getElementById("bulkExerciseType");
  const bulkAddBtn = document.getElementById("bulkAddExercisesBtn");

  const state = { exercises: [] };

  function normalizeType(inputType) {
    const t = String(inputType || "").trim();
    return t || "General";
  }

  function render() {
    if (!state.exercises.length) {
      listEl.innerHTML = `<div class="gym-helper">No exercises yet.</div>`;
      return;
    }

    listEl.innerHTML = state.exercises.map((ex) => `
      <div class="gym-row" data-exercise-id="${ex.id}">
        <div>
          <div class="gym-row__title">${ex.name}</div>
          <div class="gym-row__meta">${ex.type}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm gym-edit" type="button">
            <i class="bi bi-pencil me-2" aria-hidden="true"></i>Edit
          </button>
          <button class="btn btn-outline-secondary btn-sm gym-deactivate" type="button">
            <i class="bi bi-x-circle me-2" aria-hidden="true"></i>Deactivate
          </button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".gym-edit").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".gym-row");
        const id = row.getAttribute("data-exercise-id");
        const ex = state.exercises.find((x) => String(x.id) === String(id));
        const nextName = prompt("Exercise name:", ex?.name || "");
        if (nextName == null) return;
        const nextType = prompt("Exercise type (optional):", ex?.type || "");
        if (nextType == null) return;
        try {
          await updateGymExercise(id, {
            name: String(nextName || "").trim() || ex?.name || "",
            type: normalizeType(nextType != null ? nextType : ex?.type)
          });
          await load();
        } catch (e) {
          alert(e?.message || "Update failed");
        }
      });
    });

    listEl.querySelectorAll(".gym-deactivate").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".gym-row");
        const id = row.getAttribute("data-exercise-id");
        if (!confirm("Deactivate this exercise? It will stop showing in future plans.")) return;
        try {
          await deactivateGymExercise(id);
          await load();
        } catch (e) {
          alert(e?.message || "Deactivate failed");
        }
      });
    });
  }

  async function load() {
    listEl.innerHTML = `<div class="gym-skeleton" style="height: 76px;"></div>`;
    state.exercises = await getGymExercises();
    render();
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = String(nameEl.value || "").trim();
    const type = normalizeType(typeEl.value);
    if (!name) return;
    try {
      await createGymExercise({ name, type });
      nameEl.value = "";
      typeEl.value = "";
      await load();
    } catch (err) {
      alert(err?.message || "Create failed");
    }
  });

  bulkAddBtn?.addEventListener("click", async () => {
    const raw = String(bulkExercisesEl?.value || "");
    const lines = raw
      .split(/\r?\n/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    if (!lines.length) return;

    const type = normalizeType(bulkTypeEl?.value);
    bulkAddBtn.disabled = true;

    try {
      for (const name of lines) {
        try {
          await createGymExercise({ name, type });
        } catch (e) {
          // Best-effort: skip failures (e.g., duplicates).
          console.warn("Bulk add failed for exercise:", name, e);
        }
      }
      bulkExercisesEl.value = "";
      bulkTypeEl.value = "";
      await load();
    } finally {
      bulkAddBtn.disabled = false;
    }
  });

  async function init() {
    await gymRenderWelcomeName();
    gymStartClock();
    await load();
  }

  init();
})();
