(() => {
  const form = document.getElementById("weightForm");
  const weightEl = document.getElementById("weightKg");
  const statusEl = document.getElementById("weightStatus");
  const targetsBlockEl = document.getElementById("targetsBlock");

  function renderTargets(profile) {
    if (!profile) {
      targetsBlockEl.innerHTML = `<div class="gym-helper">No body weight set yet.</div>`;
      return;
    }
    const t = profile.targets || {};
    targetsBlockEl.innerHTML = `
      <div class="gym-row">
        <div>
          <div class="gym-row__title">${Number(profile.weightKg).toFixed(1)} kg</div>
          <div class="gym-row__meta">Effective from ${profile.effectiveFrom || ""}</div>
        </div>
      </div>
      <div class="gym-divider"></div>
      <div class="gym-grid-2">
        <div class="gym-row"><div><div class="gym-row__title">${t.proteinG ?? "—"} g</div><div class="gym-row__meta">Protein</div></div></div>
        <div class="gym-row"><div><div class="gym-row__title">${t.carbsG ?? "—"} g</div><div class="gym-row__meta">Carbs</div></div></div>
        <div class="gym-row"><div><div class="gym-row__title">${t.fatsG ?? "—"} g</div><div class="gym-row__meta">Fats</div></div></div>
        <div class="gym-row"><div><div class="gym-row__title">${t.caloriesKcal ?? "—"} kcal</div><div class="gym-row__meta">Calories</div></div></div>
      </div>
    `;
  }

  async function load() {
    targetsBlockEl.innerHTML = `<div class="gym-skeleton" style="height: 170px;"></div>`;
    try {
      const profile = await getGymBody();
      if (profile?.weightKg != null) {
        weightEl.value = Number(profile.weightKg).toFixed(1);
      }
      renderTargets(profile);
    } catch (err) {
      targetsBlockEl.innerHTML = `<div class="gym-helper">Failed to load body settings.</div>`;
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    gymClearStatus(statusEl);
    const weight = Number(String(weightEl.value || "").trim());
    if (!Number.isFinite(weight) || weight < 20) {
      return gymSetStatus(statusEl, "Enter a valid weight (>= 20 kg).", "err");
    }
    try {
      const profile = await setGymBodyWeight(weight);
      gymSetStatus(statusEl, "Saved.", "ok");
      renderTargets(profile);
      setTimeout(() => gymClearStatus(statusEl), 1500);
    } catch (err) {
      gymSetStatus(statusEl, err?.message || "Save failed.", "err");
    }
  });

  async function init() {
    await gymRenderWelcomeName();
    gymStartClock();
    await load();
  }

  init();
})();

