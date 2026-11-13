// ============================================================
// Quick Clean — Service Worker
// Keyboard shortcut, startup cleanup and background cleaning
// ============================================================

const t = (key, subs) => chrome.i18n.getMessage(key, subs);

const DEFAULT_SETTINGS = {
  clearHistory:      true,
  clearCookies:      true,
  clearCache:        true,
  clearDownloads:    false,
  clearFormData:     true,
  clearPasswords:    false,
  clearLocalStorage: false,
  timeRange:         "hour",   // hour | day | week | all
  closeTabs:         false,
  whitelist:         [],
  notifications:     true,
  cleanOnStartup:    false
};

const DEFAULT_STATS = { cleanups: 0, sites: 0, history: 0 };

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve);
  });
}

function getSinceTimestamp(timeRange) {
  const now = Date.now();
  switch (timeRange) {
    case "hour":  return now - 1000 * 60 * 60;
    case "day":   return now - 1000 * 60 * 60 * 24;
    case "week":  return now - 1000 * 60 * 60 * 24 * 7;
    case "all":   return 0;
    default:      return now - 1000 * 60 * 60;
  }
}

async function addStats(delta) {
  const { stats } = await chrome.storage.local.get({ stats: DEFAULT_STATS });
  await chrome.storage.local.set({
    stats: {
      cleanups: (stats.cleanups || 0) + 1,
      sites:    (stats.sites || 0) + (delta.sites || 0),
      history:  (stats.history || 0) + (delta.history || 0)
    }
  });
}

async function countHistory(since) {
  const items = await chrome.history.search({
    text: "",
    startTime: since,
    maxResults: 1000000
  });
  return items.length;
}

// A protected domain keeps its data on the bare domain and on www.
function whitelistToOrigins(whitelist) {
  const origins = [];
  for (const domain of whitelist) {
    for (const host of [domain, `www.${domain}`]) {
      origins.push(`https://${host}`, `http://${host}`);
    }
  }
  return origins;
}

async function closeAllTabs() {
  const tabs = await chrome.tabs.query({});
  const ids = tabs.filter((tab) => !tab.active).map((tab) => tab.id);
  if (ids.length > 0) await chrome.tabs.remove(ids);
}

async function runCleanup(source = "manual") {
  const settings = await getSettings();
  const since = getSinceTimestamp(settings.timeRange);
  const report = [];
  const counts = { history: 0 };

  // Data types that cannot be scoped by origin
  const globalTypes = {};
  if (settings.clearHistory)   globalTypes.history   = true;
  if (settings.clearDownloads) globalTypes.downloads = true;
  if (settings.clearFormData)  globalTypes.formData  = true;
  if (settings.clearPasswords) globalTypes.passwords = true;

  // Data types where protected sites can be excluded
  const siteTypes = {};
  if (settings.clearCookies)      siteTypes.cookies      = true;
  if (settings.clearCache)        siteTypes.cache        = true;
  if (settings.clearLocalStorage) {
    siteTypes.localStorage = true;
    siteTypes.indexedDB    = true;
  }

  if (settings.clearHistory) counts.history = await countHistory(since);

  if (Object.keys(globalTypes).length > 0) {
    await chrome.browsingData.remove({ since }, globalTypes);
  }
  if (Object.keys(siteTypes).length > 0) {
    const options = { since };
    if (settings.whitelist.length > 0) {
      options.excludeOrigins = whitelistToOrigins(settings.whitelist);
    }
    await chrome.browsingData.remove(options, siteTypes);
  }

  if (settings.clearHistory)      report.push(`${t("rHistory")} (${counts.history})`);
  if (settings.clearCookies)      report.push(t("rCookies"));
  if (settings.clearCache)        report.push(t("rCache"));
  if (settings.clearDownloads)    report.push(t("rDownloads"));
  if (settings.clearFormData)     report.push(t("rForms"));
  if (settings.clearPasswords)    report.push(t("rPasswords"));
  if (settings.clearLocalStorage) report.push(t("rLocalStorage"));

  if (settings.closeTabs) {
    await closeAllTabs();
    report.push(t("rTabs"));
  }

  if (settings.notifications && report.length > 0) {
    chrome.notifications.create("cleanup-done", {
      type:    "basic",
      iconUrl: "icons/icon48.png",
      title:   t("notifTitle"),
      message: t("notifMessage", [report.join(", ")])
    });
  }

  if (report.length > 0) await addStats(counts);
  await chrome.storage.local.set({ lastClean: Date.now(), lastReport: report });

  return { success: true, report, counts };
}

async function cleanSite(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { success: false };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { success: false };
  }
  const host = parsed.hostname;

  await chrome.browsingData.remove(
    { origins: [parsed.origin] },
    { cookies: true, localStorage: true, indexedDB: true, cacheStorage: true }
  );

  const entries = await chrome.history.search({ text: host, startTime: 0, maxResults: 100000 });
  const siteEntries = entries.filter((entry) => {
    try { return new URL(entry.url).hostname === host; } catch (e) { return false; }
  });
  await Promise.all(siteEntries.map((entry) => chrome.history.deleteUrl({ url: entry.url })));

  const counts = { sites: 1, history: siteEntries.length };
  await addStats(counts);
  await chrome.storage.local.set({ lastClean: Date.now() });

  return { success: true, host, counts };
}

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (settings.cleanOnStartup) {
    runCleanup("startup");
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-clean") {
    runCleanup("shortcut");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "runCleanup") {
    runCleanup("popup").then(sendResponse).catch(() => sendResponse({ success: false }));
    return true;
  }
  if (message.action === "cleanSite") {
    cleanSite(message.url).then(sendResponse).catch(() => sendResponse({ success: false }));
    return true;
  }
});
