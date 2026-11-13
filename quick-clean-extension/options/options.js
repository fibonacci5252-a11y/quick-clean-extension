// ============================================================
// Quick Clean — Options Page Logic
// ============================================================

const DEFAULT_SETTINGS = {
  notifications:  true,
  cleanOnStartup: false,
  whitelist:      [],
  theme:          "auto"
};

const DEFAULT_STATS = { cleanups: 0, sites: 0, history: 0 };

let whitelist = [];

const domainInput   = document.getElementById("domainInput");
const btnAdd        = document.getElementById("btnAdd");
const domainList    = document.getElementById("domainList");
const emptyMsg      = document.getElementById("emptyMsg");
const btnSave       = document.getElementById("btnSave");
const saveFeedback  = document.getElementById("saveFeedback");
const btnShortcut   = document.getElementById("btnShortcut");
const themeSelect   = document.getElementById("themeSelect");
const btnResetStats = document.getElementById("btnResetStats");

function renderStats(stats) {
  const s = Object.assign({}, DEFAULT_STATS, stats);
  document.getElementById("statCleanups").textContent = s.cleanups.toLocaleString();
  document.getElementById("statSites").textContent    = s.sites.toLocaleString();
  document.getElementById("statHistory").textContent  = s.history.toLocaleString();
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    document.getElementById("notifications").checked  = settings.notifications;
    document.getElementById("cleanOnStartup").checked = settings.cleanOnStartup;
    themeSelect.value = settings.theme;
    whitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
    renderWhitelist();
  });

  chrome.storage.local.get({ stats: DEFAULT_STATS }, (data) => renderStats(data.stats));
}

function renderWhitelist() {
  domainList.innerHTML = "";
  emptyMsg.style.display = whitelist.length === 0 ? "block" : "none";

  whitelist.forEach((domain, i) => {
    const li = document.createElement("li");
    li.textContent = domain;

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.title = qcT("remove");
    btn.addEventListener("click", () => {
      whitelist.splice(i, 1);
      renderWhitelist();
    });

    li.appendChild(btn);
    domainList.appendChild(li);
  });
}

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

function saveSettings() {
  const settings = {
    notifications:  document.getElementById("notifications").checked,
    cleanOnStartup: document.getElementById("cleanOnStartup").checked,
    whitelist
  };

  chrome.storage.sync.set(settings, () => {
    saveFeedback.textContent = "✓ " + qcT("saved");
    setTimeout(() => { saveFeedback.textContent = ""; }, 2500);
  });
}

btnAdd.addEventListener("click", addDomain);
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

btnSave.addEventListener("click", saveSettings);

themeSelect.addEventListener("change", () => QCTheme.set(themeSelect.value));

btnResetStats.addEventListener("click", () => {
  chrome.storage.local.set({ stats: DEFAULT_STATS });
});

btnShortcut.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.stats) renderStats(changes.stats.newValue);
});

loadSettings();
