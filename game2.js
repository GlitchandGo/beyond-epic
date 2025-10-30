/* =========================
   Beyond Epic - Extended Systems
   File: game2.js
   ========================= */

// ---------- Shop Items ----------
const shopItems = [
  {
    id: "autoClicker",
    name: "Auto-Clicker",
    baseCost: 50,
    description: "Automatically clicks every 2s. Stacks up to 10, doubling speed each time.",
    max: 10
  },
  {
    id: "doublePoints",
    name: "Double Points",
    cost: 200,
    duration: 30 * 1000,
    description: "Doubles all points for 30 seconds."
  },
  {
    id: "triplePoints",
    name: "Triple Points",
    cost: 500,
    duration: 30 * 1000,
    description: "Triples all points for 30 seconds."
  },
  {
    id: "goldenHour",
    name: "Golden Hour",
    cost: 2000,
    duration: 10 * 1000,
    description: "Guarantees Epic+ for 10 seconds."
  },
  {
    id: "luckBoost",
    name: "Luck Boost",
    cost: 250,
    duration: 60 * 1000,
    description: "Removes Very Common for 60 seconds."
  },
  {
    id: "luckyDay",
    name: "Lucky Day",
    cost: 5000,
    duration: 24 * 60 * 60 * 1000,
    description: "Removes Very Common for 24 hours."
  },
  {
    id: "timeFreeze",
    name: "Time Freeze",
    cost: 100,
    duration: 30 * 1000,
    description: "Freezes the timer for 30 seconds."
  },
  {
    id: "luckyClick",
    name: "Lucky Click",
    cost: 500,
    description: "Guarantees Legendary+ on next click."
  }
];

// ---------- Shop Rendering ----------
function renderShop() {
  const container = document.getElementById("shopItems");
  container.innerHTML = "";
  shopItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "shop-item";
    let cost = item.cost ?? item.baseCost;
    if (item.id === "autoClicker") {
      cost = item.baseCost * Math.pow(2, state.autoClickers);
    }
    div.innerHTML = `
      <h4>${item.name}</h4>
      <p>${item.description}</p>
      <p>Cost: ${fmt(cost)} pts</p>
      <button ${state.points < cost ? "disabled" : ""}>Buy</button>
    `;
    div.querySelector("button").addEventListener("click", () => buyItem(item));
    container.appendChild(div);
  });
}

function buyItem(item) {
  let cost = item.cost ?? item.baseCost;
  if (item.id === "autoClicker") {
    cost = item.baseCost * Math.pow(2, state.autoClickers);
    if (state.autoClickers >= item.max) {
      alert("Max Auto-Clickers reached!");
      return;
    }
  }
  if (state.points < cost) return;

  state.points -= cost;

  if (item.id === "autoClicker") {
    state.autoClickers++;
    startAutoClicker();
  } else {
    activateEffect(item);
  }

  renderShop();
  renderStatsForNerds();
}

// ---------- Auto-Clicker ----------
function startAutoClicker() {
  const interval = 2000 / state.autoClickers; // stacks speed
  if (state.autoClickers > 0) {
    setInterval(() => {
      const rarity = rollRarityBase();
      applyResult(rarity);
    }, interval);
  }
}

// ---------- Effects ----------
function activateEffect(item) {
  const expiresAt = now() + (item.duration ?? 0);
  state.activeEffects[item.id] = { expiresAt };

  if (item.id === "timeFreeze") {
    state.timeFrozenUntil = expiresAt;
  }
  if (item.id === "luckyClick") {
    // Next click override
    document.addEventListener("be:onDiscover", luckyClickHandler, { once: true });
  }
}

function luckyClickHandler(e) {
  // Force Legendary+ rarity
  const highTier = rarityTable.filter(r => r.points >= 40);
  const forced = highTier[Math.floor(Math.random() * highTier.length)];
  applyResult(forced);
}

// ---------- Achievements ----------
const achievements = [
  { id: "firstClick", name: "First Click", condition: s => s.totalClicks >= 1 },
  { id: "oneMillion", name: "One in a Million", condition: s => s.totalClicks >= 1_000_000 },
  { id: "beyondPerfect", name: "Beyond Perfect", condition: s => s.unlockedRarities.size >= 57 && s.achievementsUnlocked.size >= 59 },
  { id: "perfectCompletion", name: "Perfect Completion", condition: s => s.unlockedRarities.size >= 50 && s.autoClickers === 0 },
  { id: "unlucky", name: "Unlucky", condition: s => checkStreak("Very Common", 5) },
  { id: "lucky", name: "Lucky!", condition: s => checkStreakEpic(5) }
  // ... add more until 60
];

function checkStreak(rarityName, length) {
  // Placeholder: track last finds in a buffer
  return false;
}
function checkStreakEpic(length) {
  return false;
}

function checkAchievements() {
  achievements.forEach(a => {
    if (!state.achievementsUnlocked.has(a.id) && a.condition(state)) {
      state.achievementsUnlocked.add(a.id);
      showAchievementPopup(a.name);
    }
  });
}

function showAchievementPopup(title) {
  const popup = document.createElement("div");
  popup.className = "achievement-popup";
  popup.textContent = `⭐ Achievement Unlocked! ${title}`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 4000);
}

// Hook into discover event
document.addEventListener("be:onDiscover", () => {
  checkAchievements();
});

// ---------- Leaderboard ----------
function fetchLeaderboard() {
  // Placeholder: would call your Node.js server
  const container = document.getElementById("leaderboardContent");
  container.innerHTML = "<p>Leaderboard integration pending server hookup.</p>";
}

// ---------- Settings Extras ----------
function addSettingsExtras() {
  // Username change
  const btn = document.createElement("button");
  btn.textContent = "Change Username";
  btn.addEventListener("click", () => {
    const uname = prompt("Enter new username:");
    if (uname && uname.trim().length > 0) {
      state.username = uname.trim();
    }
  });
  el.settingsModal.appendChild(btn);

  // Music toggle
  const musicBtn = document.createElement("button");
  musicBtn.textContent = "Toggle Music";
  musicBtn.addEventListener("click", () => {
    state.settings.musicOn = !state.settings.musicOn;
    el.bgMusic.muted = !state.settings.musicOn;
  });
  el.settingsModal.appendChild(musicBtn);
}

// ---------- Event Hooks ----------
document.addEventListener("be:onOpenShop", renderShop);
document.addEventListener("be:onOpenLeaderboard", fetchLeaderboard);

// Initialize extras
addSettingsExtras();
