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
  timeRange:         "hour"
};

const DEFAULT_STATS = { cleanups: 0, sites: 0, history: 0 };

const btnClean   = document.getElementById("btnClean");
const btnText    = document.getElementById("btnText");
const btnSite    = document.getElementById("btnSite");
const btnTheme   = document.getElementById("btnTheme");
const btnOptions = document.getElementById("btnOptions");
const siteHost   = document.getElementById("siteHost");
const siteUnavailable = document.getElementById("siteUnavailable");
const statusBar  = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");
const lastClean  = document.getElementById("lastClean");
const pills      = document.querySelectorAll(".pill");

const checkboxIds = [
  "clearHistory", "clearCookies", "clearCache",
  "clearDownloads", "clearFormData", "clearPasswords",
  "clearLocalStorage", "closeTabs"
];

let currentSiteUrl = null;

function formatLastClean(ts) {
  if (!ts) return "";
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return qcT("lastNow");
  if (mins < 60)  return qcT("lastMinutes", [String(mins)]);
  if (hours < 24) return qcT("lastHours", [String(hours)]);
  return qcT("lastDays", [String(days)]);
}

function renderStats(stats) {
  const s = Object.assign({}, DEFAULT_STATS, stats);
  document.getElementById("statCleanups").textContent = s.cleanups.toLocaleString();
  document.getElementById("statSites").textContent    = s.sites.toLocaleString();
  document.getElementById("statHistory").textContent  = s.history.toLocaleString();
}

function showStatus(text, isError) {
  statusText.textContent = text;
  statusBar.classList.toggle("error", !!isError);
  statusBar.hidden = false;
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    checkboxIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!settings[id];
    });
    pills.forEach((p) => {
      p.classList.toggle("active", p.dataset.value === settings.timeRange);
    });
  });

  chrome.storage.local.get({ lastClean: null, stats: DEFAULT_STATS }, (data) => {
    lastClean.textContent = formatLastClean(data.lastClean);
    renderStats(data.stats);
  });
}

function getActiveTimeRange() {
  const active = document.querySelector(".pill.active");
  return active ? active.dataset.value : "hour";
}

function saveSettings() {
  const settings = { timeRange: getActiveTimeRange() };
  checkboxIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) settings[id] = el.checked;
  });
  chrome.storage.sync.set(settings);
}

function handleClean() {
  saveSettings();

  btnClean.classList.add("loading");
  btnClean.disabled = true;
  btnText.textContent = qcT("btnCleaning");
  statusBar.hidden = true;

  chrome.runtime.sendMessage({ action: "runCleanup" }, (response) => {
    btnClean.classList.remove("loading");
    btnClean.disabled = false;
    btnText.textContent = qcT("btnClean");

    if (response && response.success) {
      const report = response.report || [];
      showStatus(
        report.length > 0 ? qcT("statusRemoved", [report.join(", ")]) : qcT("statusNothing"),
        false
      );
      lastClean.textContent = formatLastClean(Date.now());
    } else {
      showStatus(qcT("statusError"), true);
    }
  });
}

function handleCleanSite() {
  if (!currentSiteUrl) return;
  btnSite.disabled = true;
  statusBar.hidden = true;

  chrome.runtime.sendMessage({ action: "cleanSite", url: currentSiteUrl }, (response) => {
    btnSite.disabled = false;
    if (response && response.success) {
      showStatus(
        qcT("siteDone", [response.host, String(response.counts.history)]),
        false
      );
      lastClean.textContent = formatLastClean(Date.now());
    } else {
      showStatus(qcT("statusError"), true);
    }
  });
}

async function initSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      currentSiteUrl = url.href;
      siteHost.textContent = url.hostname;
      btnSite.hidden = false;
      return;
    }
  } catch (e) {}
  siteHost.hidden = true;
  siteUnavailable.hidden = false;
}

btnClean.addEventListener("click", handleClean);
btnSite.addEventListener("click", handleCleanSite);

pills.forEach((pill) => {
  pill.addEventListener("click", () => {
    pills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    saveSettings();
  });
});

checkboxIds.forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", saveSettings);
});

btnTheme.addEventListener("click", () => {
  QCTheme.set(QCTheme.effective() === "dark" ? "light" : "dark");
});

btnOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.stats) renderStats(changes.stats.newValue);
});

loadSettings();
initSite();
