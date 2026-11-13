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

const DEFAULT_STATS = { cleanups: 0, cookies: 0, history: 0 };

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
      cleanups: stats.cleanups + 1,
      cookies:  stats.cookies + (delta.cookies || 0),
      history:  stats.history + (delta.history || 0)
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

function removeCookie(cookie) {
  const protocol = cookie.secure ? "https" : "http";
  const domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
  const url = `${protocol}://${domain}${cookie.path}`;
  return new Promise((resolve) => chrome.cookies.remove({ url, name: cookie.name }, resolve));
}

async function clearCookiesWithWhitelist(whitelist) {
  const cookies = await chrome.cookies.getAll({});
  const toDelete = cookies.filter((cookie) => {
    const domain = cookie.domain.replace(/^\./, "");
    return !whitelist.some((w) => domain === w || domain.endsWith("." + w));
  });
  for (const cookie of toDelete) {
    await removeCookie(cookie);
  }
  return toDelete.length;
}

async function closeAllTabs() {
  const tabs = await chrome.tabs.query({});
  const ids = tabs.filter((tab) => !tab.active).map((tab) => tab.id);
  if (ids.length > 0) await chrome.tabs.remove(ids);
}

async function runCleanup(source = "manual") {
  const settings = await getSettings();
  const since = getSinceTimestamp(settings.timeRange);
  const dataTypes = {};
  const report = [];
  const counts = { cookies: 0, history: 0 };

  if (settings.clearHistory)      dataTypes.history      = true;
  if (settings.clearCache)        dataTypes.cache        = true;
  if (settings.clearDownloads)    dataTypes.downloads    = true;
  if (settings.clearFormData)     dataTypes.formData     = true;
  if (settings.clearPasswords)    dataTypes.passwords    = true;
  if (settings.clearLocalStorage) {
    dataTypes.localStorage = true;
    dataTypes.indexedDB    = true;
  }

  if (settings.clearHistory) counts.history = await countHistory(since);

  await chrome.browsingData.remove({ since }, dataTypes);

  if (settings.clearHistory)      report.push(`${t("rHistory")} (${counts.history})`);
  if (settings.clearCache)        report.push(t("rCache"));
  if (settings.clearDownloads)    report.push(t("rDownloads"));
  if (settings.clearFormData)     report.push(t("rForms"));
  if (settings.clearPasswords)    report.push(t("rPasswords"));
  if (settings.clearLocalStorage) report.push(t("rLocalStorage"));

  if (settings.clearCookies) {
    counts.cookies = await clearCookiesWithWhitelist(settings.whitelist);
    report.push(`${t("rCookies")} (${counts.cookies})`);
  }

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

  const cookies = await chrome.cookies.getAll({ url: parsed.href });
  for (const cookie of cookies) {
    await removeCookie(cookie);
  }

  await chrome.browsingData.remove(
    { origins: [parsed.origin] },
    { localStorage: true, indexedDB: true, cacheStorage: true }
  );

  const entries = await chrome.history.search({ text: host, startTime: 0, maxResults: 100000 });
  const siteEntries = entries.filter((entry) => {
    try { return new URL(entry.url).hostname === host; } catch (e) { return false; }
  });
  await Promise.all(siteEntries.map((entry) => chrome.history.deleteUrl({ url: entry.url })));

  const counts = { cookies: cookies.length, history: siteEntries.length };
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
