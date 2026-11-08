// ============================================================
// Quick Clean — Popup Logic
// ============================================================

const DEFAULT_SETTINGS = {
  clearHistory:      true,
  clearCookies:      true,
  clearCache:        true,
  clearDownloads:    false,
  clearFormData:     true,
  clearPasswords:    false,
  clearLocalStorage: false,
  closeTabs:         false,
  timeRange:         "hour",
  whitelist:         [],
  notifications:     true
};

// --- Éléments DOM ---
const btnClean   = document.getElementById("btnClean");
const btnText    = document.getElementById("btnText");
const statusBar  = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");
const lastClean  = document.getElementById("lastClean");
const btnOptions = document.getElementById("btnOptions");
const pills      = document.querySelectorAll(".pill");

// Checkboxes
const checkboxIds = [
  "clearHistory", "clearCookies", "clearCache",
  "clearDownloads", "clearFormData", "clearPasswords",
  "clearLocalStorage", "closeTabs"
];

// --- Formate la date du dernier nettoyage ---
function formatLastClean(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)    return "Dernier nettoyage : à l'instant";
  if (mins < 60)   return `Dernier nettoyage : il y a ${mins} min`;
  if (hours < 24)  return `Dernier nettoyage : il y a ${hours}h`;
  return `Dernier nettoyage : il y a ${days} jour(s)`;
}

// --- Charge les paramètres depuis le storage ---
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    // Checkboxes
    checkboxIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!settings[id];
    });

    // Pills de durée
    pills.forEach(p => {
      p.classList.toggle("active", p.dataset.value === settings.timeRange);
    });
  });

  // Dernier nettoyage
  chrome.storage.local.get(["lastClean"], (data) => {
    lastClean.textContent = formatLastClean(data.lastClean);
  });
}

// --- Sauvegarde les paramètres ---
function saveSettings() {
  const settings = { timeRange: getActiveTimeRange() };
  checkboxIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) settings[id] = el.checked;
  });
  chrome.storage.sync.set(settings);
}

// --- Récupère la plage de temps sélectionnée ---
function getActiveTimeRange() {
  const active = document.querySelector(".pill.active");
  return active ? active.dataset.value : "hour";
}

// --- Lance le nettoyage ---
async function handleClean() {
  saveSettings();

  // État "chargement"
  btnClean.classList.add("loading");
  btnClean.disabled = true;
  btnText.textContent = "Nettoyage en cours…";
  statusBar.hidden = true;

  chrome.runtime.sendMessage({ action: "runCleanup" }, (response) => {
    btnClean.classList.remove("loading");
    btnClean.classList.add("success");
    btnClean.disabled = false;
    btnText.textContent = "Nettoyer maintenant";

    if (response && response.success) {
      const report = response.report || [];
      statusText.textContent = report.length > 0
        ? `Supprimé : ${report.join(", ")}`
        : "Rien à nettoyer.";
      statusBar.classList.remove("error");
      statusBar.hidden = false;
      lastClean.textContent = "Dernier nettoyage : à l'instant";
    } else {
      statusText.textContent = "Erreur lors du nettoyage.";
      statusBar.classList.add("error");
      statusBar.hidden = false;
    }

    // Retire l'état "success" après 2s
    setTimeout(() => {
      btnClean.classList.remove("success");
    }, 2000);
  });
}

// --- Listeners ---

// Bouton Nettoyer
btnClean.addEventListener("click", handleClean);

// Pills de durée
pills.forEach(pill => {
  pill.addEventListener("click", () => {
    pills.forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    saveSettings();
  });
});

// Checkboxes — sauvegarde automatique
checkboxIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", saveSettings);
});

// Bouton Options
btnOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// --- Init ---
loadSettings();
