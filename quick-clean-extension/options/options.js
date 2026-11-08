// ============================================================
// Quick Clean — Options Page Logic
// ============================================================

const DEFAULT_SETTINGS = {
  notifications:    true,
  cleanOnStartup:   false,
  whitelist:        []
};

let whitelist = [];

// --- Éléments ---
const domainInput  = document.getElementById("domainInput");
const btnAdd       = document.getElementById("btnAdd");
const domainList   = document.getElementById("domainList");
const emptyMsg     = document.getElementById("emptyMsg");
const btnSave      = document.getElementById("btnSave");
const saveFeedback = document.getElementById("saveFeedback");
const btnShortcut  = document.getElementById("btnShortcut");

// --- Charge les paramètres ---
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    document.getElementById("notifications").checked  = settings.notifications;
    document.getElementById("cleanOnStartup").checked = settings.cleanOnStartup;
    whitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
    renderWhitelist();
  });
}

// --- Affiche la whitelist ---
function renderWhitelist() {
  domainList.innerHTML = "";
  emptyMsg.style.display = whitelist.length === 0 ? "block" : "none";

  whitelist.forEach((domain, i) => {
    const li = document.createElement("li");
    li.textContent = domain;

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.title = "Supprimer";
    btn.addEventListener("click", () => {
      whitelist.splice(i, 1);
      renderWhitelist();
    });

    li.appendChild(btn);
    domainList.appendChild(li);
  });
}

// --- Ajoute un domaine ---
function addDomain() {
  const raw    = domainInput.value.trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    domainInput.style.borderColor = "#ff6b6b";
    setTimeout(() => { domainInput.style.borderColor = ""; }, 1500);
    return;
  }

  if (!whitelist.includes(domain)) {
    whitelist.push(domain);
    renderWhitelist();
  }

  domainInput.value = "";
  domainInput.focus();
}

// --- Sauvegarde ---
function saveSettings() {
  const settings = {
    notifications:  document.getElementById("notifications").checked,
    cleanOnStartup: document.getElementById("cleanOnStartup").checked,
    whitelist
  };

  chrome.storage.sync.set(settings, () => {
    saveFeedback.textContent = "✓ Enregistré";
    setTimeout(() => { saveFeedback.textContent = ""; }, 2500);
  });
}

// --- Listeners ---
btnAdd.addEventListener("click", addDomain);
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

btnSave.addEventListener("click", saveSettings);

btnShortcut.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// --- Init ---
loadSettings();
