(function () {
  var t = function (key, subs) { return chrome.i18n.getMessage(key, subs); };

  document.documentElement.lang = chrome.i18n.getUILanguage().split("-")[0];

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var text = t(el.dataset.i18n);
    if (text) el.textContent = text;
  });
  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    var text = t(el.dataset.i18nTitle);
    if (text) el.title = text;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    var text = t(el.dataset.i18nPlaceholder);
    if (text) el.placeholder = text;
  });

  window.qcT = t;
})();
