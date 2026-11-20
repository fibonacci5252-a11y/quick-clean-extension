(function () {
  var html = document.documentElement;

  function apply() {
    html.lang = QCI18n.lang.split("_")[0];
    html.dir = QCI18n.isRtl() ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var text = QCI18n.t(el.dataset.i18n);
      if (text) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var text = QCI18n.t(el.dataset.i18nTitle);
      if (text) el.title = text;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var text = QCI18n.t(el.dataset.i18nPlaceholder);
      if (text) el.placeholder = text;
    });
  }

  window.qcT = QCI18n.t;
  window.qcApply = apply;
  window.qcSetLanguage = function (preference) {
    return QCI18n.load(preference).then(apply);
  };

  window.qcReady = new Promise(function (resolve) {
    chrome.storage.sync.get({ language: "auto" }, function (data) { resolve(data.language); });
  })
    .then(function (preference) { return QCI18n.load(preference); })
    .then(apply)
    .catch(function () {})
    .then(function () { html.classList.remove("i18n-pending"); });
})();
