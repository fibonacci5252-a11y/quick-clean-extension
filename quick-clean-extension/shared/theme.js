(function () {
  var KEY = "qc-theme";

  function apply(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function remember(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }

  try { apply(localStorage.getItem(KEY)); } catch (e) {}

  window.QCTheme = {
    apply: apply,
    set: function (theme) {
      apply(theme);
      remember(theme);
      chrome.storage.sync.set({ theme: theme });
    },
    effective: function () {
      var explicit = document.documentElement.dataset.theme;
      if (explicit) return explicit;
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
  };

  chrome.storage.sync.get({ theme: "auto" }, function (data) {
    apply(data.theme);
    remember(data.theme);
  });
})();
