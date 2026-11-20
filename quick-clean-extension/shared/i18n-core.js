(function (root) {
  var SUPPORTED = ["en", "fr", "es", "pt_BR", "pt_PT", "de", "it", "ru", "tr", "ar", "hi", "zh_CN", "ja", "ko", "id"];

  var NAMES = {
    en: "English",
    fr: "Français",
    es: "Español",
    pt_BR: "Português (Brasil)",
    pt_PT: "Português (Portugal)",
    de: "Deutsch",
    it: "Italiano",
    ru: "Русский",
    tr: "Türkçe",
    ar: "العربية",
    hi: "हिन्दी",
    zh_CN: "中文 (简体)",
    ja: "日本語",
    ko: "한국어",
    id: "Bahasa Indonesia"
  };

  var RTL = ["ar", "he", "fa", "ur"];
  var cache = {};
  var state = { lang: "en", messages: {}, fallback: {} };

  function detectBrowserLanguage() {
    var ui = (chrome.i18n.getUILanguage() || "en").replace("-", "_").toLowerCase();
    var exact = SUPPORTED.filter(function (l) { return l.toLowerCase() === ui; })[0];
    if (exact) return exact;
    var base = ui.split("_")[0];
    var sameBase = SUPPORTED.filter(function (l) { return l.split("_")[0].toLowerCase() === base; })[0];
    return sameBase || "en";
  }

  function fetchMessages(lang) {
    if (!cache[lang]) {
      cache[lang] = fetch(chrome.runtime.getURL("_locales/" + lang + "/messages.json"))
        .then(function (response) { return response.json(); });
    }
    return cache[lang];
  }

  function load(preference) {
    var lang = preference && preference !== "auto" && SUPPORTED.indexOf(preference) !== -1
      ? preference
      : detectBrowserLanguage();
    return Promise.all([
      fetchMessages(lang),
      lang === "en" ? null : fetchMessages("en")
    ]).then(function (results) {
      state.lang = lang;
      state.messages = results[0];
      state.fallback = results[1] || results[0];
      return lang;
    });
  }

  function format(entry, substitutions) {
    var text = entry.message;
    if (entry.placeholders) {
      Object.keys(entry.placeholders).forEach(function (name) {
        var index = parseInt(entry.placeholders[name].content.slice(1), 10) - 1;
        var value = substitutions[index] === undefined ? "" : String(substitutions[index]);
        text = text.replace(new RegExp("\\$" + name + "\\$", "gi"), function () { return value; });
      });
    }
    return text;
  }

  function t(key, substitutions) {
    var entry = state.messages[key] || state.fallback[key];
    return entry ? format(entry, substitutions || []) : "";
  }

  root.QCI18n = {
    SUPPORTED: SUPPORTED,
    NAMES: NAMES,
    load: load,
    t: t,
    isRtl: function () { return RTL.indexOf(state.lang.split("_")[0]) !== -1; },
    get lang() { return state.lang; }
  };
})(typeof self !== "undefined" ? self : window);
