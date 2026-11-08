// ============================================================
// Quick Clean — Service Worker
// Gère le raccourci clavier et le nettoyage en arrière-plan
// ============================================================

// --- Paramètres par défaut ---
const DEFAULT_SETTINGS = {
  clearHistory:   true,
  clearCookies:   true,
  clearCache:     true,
  clearDownloads: false,
  clearFormData:  true,
  clearPasswords: false,
  clearLocalStorage: false,
  timeRange:      "hour",   // hour | day | week | all
  closeTabs:      false,
  whitelist:      [],       // domaines à protéger
  notifications:  true,
  cleanOnStartup: false
};

// --- Récupère les paramètres depuis le storage ---
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      resolve(settings);
    });
  });
}

// --- Calcule le timestamp "depuis" selon la plage choisie ---
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

// --- Supprime les cookies en respectant la whitelist ---
async function clearCookiesWithWhitelist(whitelist) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({}, async (cookies) => {
      const toDelete = cookies.filter(cookie => {
        const domain = cookie.domain.replace(/^\./, "");
        return !whitelist.some(w => domain === w || domain.endsWith("." + w));
      });

      for (const cookie of toDelete) {
        const protocol = cookie.secure ? "https" : "http";
        const cookieDomain = cookie.domain.startsWith(".")
          ? cookie.domain.slice(1)
          : cookie.domain;
        const url = `${protocol}://${cookieDomain}${cookie.path}`;
        await new Promise(r => chrome.cookies.remove({ url, name: cookie.name }, r));
      }
      resolve(toDelete.length);
    });
  });
}

// --- Ferme tous les onglets sauf le nouvel onglet actif ---
async function closeAllTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const toClose = tabs.filter(t => !t.active);
      const ids = toClose.map(t => t.id);
      if (ids.length > 0) {
        chrome.tabs.remove(ids, resolve);
      } else {
        resolve();
      }
    });
  });
}

// --- Fonction principale de nettoyage ---
async function runCleanup(source = "manual") {
  const settings = await getSettings();
  const since    = getSinceTimestamp(settings.timeRange);
  const dataTypes = {};
  let   report   = [];

  if (settings.clearHistory)      dataTypes.history      = true;
  if (settings.clearCache)        dataTypes.cache        = true;
  if (settings.clearDownloads)    dataTypes.downloads    = true;
  if (settings.clearFormData)     dataTypes.formData     = true;
  if (settings.clearPasswords)    dataTypes.passwords    = true;
  if (settings.clearLocalStorage) dataTypes.localStorage = true;
  if (settings.clearLocalStorage) dataTypes.indexedDB    = true;

  // Nettoyage browsingData standard
  await new Promise((resolve) => {
    chrome.browsingData.remove({ since }, dataTypes, resolve);
  });

  if (settings.clearHistory)      report.push("historique");
  if (settings.clearCache)        report.push("cache");
  if (settings.clearDownloads)    report.push("téléchargements");
  if (settings.clearFormData)     report.push("formulaires");
  if (settings.clearPasswords)    report.push("mots de passe");
  if (settings.clearLocalStorage) report.push("stockage local");

  // Cookies avec whitelist
  if (settings.clearCookies) {
    const count = await clearCookiesWithWhitelist(settings.whitelist);
    report.push(`cookies (${count})`);
  }

  // Fermer les onglets
  if (settings.closeTabs) {
    await closeAllTabs();
    report.push("onglets");
  }

  // Notification
  if (settings.notifications && report.length > 0) {
    chrome.notifications.create("cleanup-done", {
      type:    "basic",
      iconUrl: "icons/icon48.png",
      title:   "Quick Clean ✓",
      message: `Nettoyé : ${report.join(", ")}.`
    });
  }

  // Met à jour la date du dernier nettoyage
  chrome.storage.local.set({ lastClean: Date.now(), lastReport: report });

  return { success: true, report };
}

// --- Nettoyage automatique au démarrage de Chrome ---
chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (settings.cleanOnStartup) {
    runCleanup("startup");
  }
});

// --- Écoute le raccourci clavier ---
chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-clean") {
    runCleanup("shortcut");
  }
});

// --- Écoute les messages du popup ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "runCleanup") {
    runCleanup("popup").then(sendResponse);
    return true; // réponse asynchrone
  }
});
