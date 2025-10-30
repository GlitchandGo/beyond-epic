/* =========================
   Beyond Epic - Core Engine
   File: game.js
   ========================= */

// ---------- Persistent State ----------
const state = {
  username: null,
  totalClicks: 0,
  points: 0,
  startTime: null,          // epoch ms when the player first starts
  lastTickTime: null,       // for UI timer updates
  timeFrozenUntil: 0,       // ms epoch until which timer is frozen (set by Time Freeze in game2.js)
  rarestFind: null,         // { name, tierIndex, points }
  finds: {},                // { rarityName: count }
  unlockedRarities: new Set(), // set of rarity names that have been seen
  achievementsUnlocked: new Set(), // managed in game2.js, tracked here for save/load
  autoClickers: 0,          // count (effect in game2.js)
  background: "White",      // current background name
  activeEffects: {},        // map: effectName -> { expiresAt, data } (populated in game2.js)
  settings: {
    musicOn: true
  }
};

// ---------- DOM Elements ----------
const el = {
  discoverBtn: null,
  resultBox: null,
  findsList: null,
  timer: null,
  shopTab: null,
  leaderboardTab: null,
  settingsTab: null,
  shopModal: null,
  leaderboardModal: null,
  settingsModal: null,

  // Settings controls
  resetBtn: null,
  exportBtn: null,
  importBtn: null,
  importFile: null,

  // Stats for Nerds
  statClicks: null,
  statPoints: null,
  statTime: null,
  statRarest: null,
  statAuto: null,
  statBG: null,
  statAchieve: null,
  rarityChancesList: null,

  // Audio
  bgMusic: null
};

// ---------- Utility ----------
function fmt(num) {
  // Compact number formatting for points
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return String(num);
}

function now() { return Date.now(); }

// ---------- Rarity Table (Base) ----------
// 50 standard rarities + placeholders for more you listed.
// Keep chances summing ~100. Secret rarities live in game2.js and only become available after unlocks.
const rarityTable = [
  // Very Common band
  { name: "Very Common", chance: 36.0, points: 0 },
  { name: "Common", chance: 24.0, points: 0 },
  { name: "Uncommon", chance: 12.0, points: 1 },
  { name: "Rare", chance: 6.0, points: 2 },
  { name: "Extra Rare", chance: 4.0, points: 4 },
  { name: "Super Rare", chance: 3.0, points: 6 },
  { name: "Ultra Rare", chance: 2.0, points: 8 },

  // Epic band
  { name: "Epic", chance: 1.2, points: 12 },
  { name: "Extra Epic", chance: 0.9, points: 20 },
  { name: "Ultra Epic", chance: 0.7, points: 30 },
  { name: "Beyond Epic", chance: 0.5, points: 50 },

  // Legendary / Mythic band
  { name: "Legendary", chance: 0.45, points: 40 },
  { name: "Ultra Legendary", chance: 0.35, points: 60 },
  { name: "Mythic", chance: 0.28, points: 80 },
  { name: "Ultra Mythic", chance: 0.22, points: 100 },
  { name: "Mystical", chance: 0.18, points: 150 },
  { name: "Magical", chance: 0.14, points: 200 },

  // Insane / Extreme band
  { name: "Insane", chance: 0.12, points: 300 },
  { name: "Ultra Insane", chance: 0.10, points: 400 },
  { name: "Extreme", chance: 0.08, points: 600 },
  { name: "Mega Extreme", chance: 0.06, points: 800 },

  // Specialty band
  { name: "Quantum", chance: 0.045, points: 1000 },
  { name: "Chroma", chance: 0.035, points: 1500 },
  { name: "Sigma", chance: 0.025, points: 2000 },

  // Endgame band
  { name: "BEYOND Epic", chance: 0.015, points: 3500 },
  { name: "Ascendant", chance: 0.010, points: 5000 },
  { name: "Transcendent", chance: 0.008, points: 6200 },
  { name: "Ethereal", chance: 0.006, points: 7500 },
  { name: "Celestial", chance: 0.004, points: 8800 },
  { name: "BEYOND", chance: 0.0005, points: 10000 } // matches True Beyond later
];
// Sum ~ 100 (slight rounding tolerated). Effects like Luck Boost / Golden Hour will reshuffle probabilities in game2.js.

// Map for quick access
const rarityIndexByName = new Map(rarityTable.map((r, i) => [r.name, i]));

// ---------- Core Roll ----------
function rollRarityBase() {
  // Build active pool (secrets may inject in game2.js)
  const pool = rarityTable.slice();

  // Compute cumulative distribution
  let totalChance = pool.reduce((sum, r) => sum + r.chance, 0);
  const roll = Math.random() * totalChance;
  let cumulative = 0;

  for (let i = 0; i < pool.length; i++) {
    cumulative += pool[i].chance;
    if (roll <= cumulative) {
      return pool[i];
    }
  }
  // Fallback (should not happen due to sums)
  return pool[pool.length - 1];
}

// ---------- Result Handling ----------
function applyResult(r) {
  state.totalClicks += 1;
  state.points += r.points;

  // Track finds
  if (!state.finds[r.name]) state.finds[r.name] = 0;
  state.finds[r.name] += 1;
  state.unlockedRarities.add(r.name);

  // Rarest find determination by points, tie-breaker: first occurrence remains
  if (!state.rarestFind || r.points > state.rarestFind.points) {
    state.rarestFind = { name: r.name, tierIndex: rarityIndexByName.get(r.name), points: r.points };
  }

  // UI update: result box
  el.resultBox.innerHTML = `
    <div class="result">
      You got ${r.name}!<br/>
      +${fmt(r.points)} points
    </div>
  `;

  // UI update: finds list
  const list = Object.keys(state.finds)
    .sort((a, b) => (rarityIndexByName.get(a) ?? 999) - (rarityIndexByName.get(b) ?? 999))
    .map(name => `${name} (${state.finds[name]})`)
    .join(", ");
  el.findsList.innerHTML = `<strong>Finds:</strong> ${list}`;

  // Stats for Nerds
  renderStatsForNerds();

  // Achievements (handled in game2.js, but we emit a simple event for the secondary file to hook)
  document.dispatchEvent(new CustomEvent("be:onDiscover", { detail: { rarity: r, state } }));
}

// ---------- Discover Click ----------
function onDiscoverClick() {
  // Effects (Golden Hour / Lucky Click / etc.) will adjust rolls inside game2.js via event listeners.
  const rarity = rollRarityBase();
  applyResult(rarity);
}

// ---------- Timer Logic ----------
function initTimer() {
  if (!state.startTime) {
    state.startTime = now();
    state.lastTickTime = state.startTime;
  }
  function tick() {
    const current = now();
    let elapsedMs;
    if (current < state.timeFrozenUntil) {
      // Timer frozen
      elapsedMs = state.lastTickTime - state.startTime;
    } else {
      // Normal ticking
      elapsedMs = current - state.startTime;
      state.lastTickTime = current;
    }
    const seconds = elapsedMs / 1000;
    el.timer.textContent = `${seconds.toFixed(1)}s`;
    // Update stats panel time
    el.statTime.textContent = `${seconds.toFixed(1)}s`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- Stats for Nerds Rendering ----------
function renderStatsForNerds() {
  el.statClicks.textContent = state.totalClicks;
  el.statPoints.textContent = fmt(state.points);
  el.statRarest.textContent = state.rarestFind ? state.rarestFind.name : "None";
  el.statAuto.textContent = state.autoClickers;
  el.statBG.textContent = state.background;
  el.statAchieve.textContent = `${state.achievementsUnlocked.size}/60`;

  // Unlocked rarity chances: derived from empirical frequency (only those found)
  const totalFinds = Object.values(state.finds).reduce((a, b) => a + b, 0);
  el.rarityChancesList.innerHTML = "";
  if (totalFinds > 0) {
    Object.keys(state.finds)
      .sort((a, b) => (rarityIndexByName.get(a) ?? 999) - (rarityIndexByName.get(b) ?? 999))
      .forEach(name => {
        const count = state.finds[name];
        const pct = ((count / totalFinds) * 100).toFixed(2);
        const li = document.createElement("li");
        li.textContent = `${name}: ${pct}%`;
        el.rarityChancesList.appendChild(li);
      });
  }
}

// ---------- Save / Load ----------
function makeSave() {
  const save = {
    username: state.username,
    totalClicks: state.totalClicks,
    points: state.points,
    startTime: state.startTime,
    timeFrozenUntil: state.timeFrozenUntil,
    rarestFind: state.rarestFind,
    finds: state.finds,
    unlockedRarities: Array.from(state.unlockedRarities),
    achievementsUnlocked: Array.from(state.achievementsUnlocked),
    autoClickers: state.autoClickers,
    background: state.background,
    activeEffects: state.activeEffects,
    settings: state.settings
  };
  return JSON.stringify(save);
}

function loadSave(jsonStr) {
  try {
    const save = JSON.parse(jsonStr);
    state.username = save.username ?? state.username;
    state.totalClicks = save.totalClicks ?? 0;
    state.points = save.points ?? 0;
    state.startTime = save.startTime ?? state.startTime ?? now();
    state.timeFrozenUntil = save.timeFrozenUntil ?? 0;
    state.rarestFind = save.rarestFind ?? null;
    state.finds = save.finds ?? {};
    state.unlockedRarities = new Set(save.unlockedRarities ?? []);
    state.achievementsUnlocked = new Set(save.achievementsUnlocked ?? []);
    state.autoClickers = save.autoClickers ?? 0;
    state.background = save.background ?? "White";
    state.activeEffects = save.activeEffects ?? {};
    state.settings = save.settings ?? { musicOn: true };

    // Re-render UI pieces
    renderStatsForNerds();
    const list = Object.keys(state.finds)
      .sort((a, b) => (rarityIndexByName.get(a) ?? 999) - (rarityIndexByName.get(b) ?? 999))
      .map(name => `${name} (${state.finds[name]})`)
      .join(", ");
    el.findsList.innerHTML = `<strong>Finds:</strong> ${list}`;
  } catch (e) {
    alert("Import failed: invalid save data.");
  }
}

function exportSaveToFile() {
  const blob = new Blob([makeSave()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "beyond-epic-save.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importSaveFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => loadSave(reader.result);
  reader.readAsText(file);
}

// ---------- Modal Controls ----------
function toggleModal(modal, show) {
  modal.classList.toggle("hidden", !show);
}

function hideAllModals() {
  toggleModal(el.shopModal, false);
  toggleModal(el.leaderboardModal, false);
  toggleModal(el.settingsModal, false);
}

// ---------- Audio ----------
function initAudio() {
  if (el.bgMusic) {
    el.bgMusic.volume = 0.6;
    // Respect saved setting
    el.bgMusic.muted = !state.settings.musicOn;
    // Simple click to resume audio context if needed (mobile autoplay policies)
    document.addEventListener("click", () => {
      el.bgMusic.play().catch(() => {});
    }, { once: true });
  }
}

// ---------- Init ----------
function bindDOM() {
  el.discoverBtn = document.getElementById("discoverBtn");
  el.resultBox = document.getElementById("resultBox");
  el.findsList = document.getElementById("findsList");
  el.timer = document.getElementById("timer");

  el.shopTab = document.getElementById("shopTab");
  el.leaderboardTab = document.getElementById("leaderboardTab");
  el.settingsTab = document.getElementById("settingsTab");

  el.shopModal = document.getElementById("shopModal");
  el.leaderboardModal = document.getElementById("leaderboardModal");
  el.settingsModal = document.getElementById("settingsModal");

  el.resetBtn = document.getElementById("resetBtn");
  el.exportBtn = document.getElementById("exportBtn");
  el.importBtn = document.getElementById("importBtn");
  el.importFile = document.getElementById("importFile");

  el.statClicks = document.getElementById("statClicks");
  el.statPoints = document.getElementById("statPoints");
  el.statTime = document.getElementById("statTime");
  el.statRarest = document.getElementById("statRarest");
  el.statAuto = document.getElementById("statAuto");
  el.statBG = document.getElementById("statBG");
  el.statAchieve = document.getElementById("statAchieve");
  el.rarityChancesList = document.getElementById("rarityChancesList");

  el.bgMusic = document.getElementById("bgMusic");
}

function bindEvents() {
  // Discover
  el.discoverBtn.addEventListener("click", onDiscoverClick);

  // Tabs -> open modals
  el.shopTab.addEventListener("click", () => {
    hideAllModals();
    toggleModal(el.shopModal, true);
    // Notify game2.js to render shop items
    document.dispatchEvent(new CustomEvent("be:onOpenShop", { detail: { state } }));
  });

  el.leaderboardTab.addEventListener("click", () => {
    hideAllModals();
    toggleModal(el.leaderboardModal, true);
    // Notify game2.js to fetch/render leaderboard
    document.dispatchEvent(new CustomEvent("be:onOpenLeaderboard", { detail: { state } }));
  });

  el.settingsTab.addEventListener("click", () => {
    hideAllModals();
    toggleModal(el.settingsModal, true);
    renderStatsForNerds();
  });

  // Settings controls
  el.resetBtn.addEventListener("click", () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      const keepUsername = state.username;
      const keepStartTime = state.startTime ?? now();
      Object.assign(state, {
        username: keepUsername,
        totalClicks: 0,
        points: 0,
        startTime: keepStartTime,
        lastTickTime: keepStartTime,
        timeFrozenUntil: 0,
        rarestFind: null,
        finds: {},
        unlockedRarities: new Set(),
        achievementsUnlocked: new Set(),
        autoClickers: 0,
        background: "White",
        activeEffects: {},
        settings: { musicOn: true }
      });
      el.resultBox.innerHTML = "";
      el.findsList.innerHTML = "<strong>Finds:</strong>";
      renderStatsForNerds();
    }
  });

  el.exportBtn.addEventListener("click", exportSaveToFile);

  el.importBtn.addEventListener("click", () => {
    el.importFile.click();
  });
  el.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importSaveFromFile(file);
    e.target.value = "";
  });
}

// Prompt username once (permanent unless changed in settings; change UI later in game2.js)
function ensureUsername() {
  if (!state.username) {
    const uname = prompt("Choose a permanent username:");
    if (uname && uname.trim().length > 0) {
      state.username = uname.trim();
    } else {
      state.username = "Player";
    }
  }
}

// ---------- Boot ----------
(function boot() {
  bindDOM();
  ensureUsername();
  initAudio();
  initTimer();
  bindEvents();
  renderStatsForNerds();

  // Initial UI
  el.findsList.innerHTML = "<strong>Finds:</strong>";
})();
    
