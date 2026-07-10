(function () {
  'use strict';

  var ROUTES = ['landing', 'compare', 'verdict', 'auth'];
  var ROUTE_TITLES = {
    landing: 'LLM Router — Compare AI responses',
    compare: 'Compare responses — LLM Router',
    verdict: 'Verdict — LLM Router',
    auth: 'Sign in — LLM Router'
  };
  var ROUTE_ANNOUNCE = {
    landing: 'Landing page',
    compare: 'Compare page, showing responses',
    verdict: 'Verdict page',
    auth: 'Sign in page'
  };

  var announcer = document.getElementById('route-announcer');
  var toast = document.getElementById('toast');
  var navLinks = document.querySelectorAll('.primary-nav a[data-route]');
  var screens = {};
  ROUTES.forEach(function (name) {
    screens[name] = document.getElementById('screen-' + name);
  });

  var isFirstRoute = true;

  function parseRoute(hash) {
    var name = hash.replace(/^#\/?/, '');
    return ROUTES.indexOf(name) !== -1 ? name : null;
  }

  function currentRoute() {
    return parseRoute(window.location.hash) || 'landing';
  }

  function showRoute(name) {
    ROUTES.forEach(function (route) {
      var el = screens[route];
      if (!el) return;
      if (route === name) {
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    });

    navLinks.forEach(function (link) {
      if (link.getAttribute('data-route') === name) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    document.title = ROUTE_TITLES[name] || 'LLM Router';

    if (!isFirstRoute) {
      announcer.textContent = ROUTE_ANNOUNCE[name] || '';
      var target = screens[name];
      if (target) {
        target.focus({ preventScroll: false });
      }
      window.scrollTo(0, 0);
    }
    isFirstRoute = false;
  }

  function navigate(name) {
    if (currentRoute() === name) {
      showRoute(name);
    } else {
      window.location.hash = '/' + name;
    }
  }

  window.addEventListener('hashchange', function () {
    // Ignore in-page anchors that aren't app routes (e.g. the skip link's
    // #main-content) so they don't hijack focus/announcements meant for them.
    var name = parseRoute(window.location.hash);
    if (name) {
      showRoute(name);
    }
  });

  showRoute(currentRoute());

  // ---- Landing: query form + example chips ----
  var queryInput = document.getElementById('query-input');
  var queryForm = document.getElementById('query-form');
  var questionText = document.getElementById('question-text');

  queryForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = queryInput.value.trim();
    if (value) {
      questionText.textContent = '“' + value + '”';
    }
    navigate('compare');
  });

  document.querySelectorAll('.chip[data-example]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      queryInput.value = chip.getAttribute('data-example');
      queryInput.focus();
    });
  });

  // ---- "Open full response" / "View full verdict" buttons ----
  document.querySelectorAll('[data-open-verdict]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigate('verdict');
    });
  });

  // ---- Generic ARIA tabs widget ----
  function initTabs(tablistSelector) {
    var tablist = document.querySelector(tablistSelector);
    if (!tablist) return;
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));

    function activate(tab, moveFocus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        t.tabIndex = selected ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      if (moveFocus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        activate(tab, false);
      });
      tab.addEventListener('keydown', function (e) {
        var newIndex = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          newIndex = (i + 1) % tabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          newIndex = (i - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
          newIndex = 0;
        } else if (e.key === 'End') {
          newIndex = tabs.length - 1;
        }
        if (newIndex !== null) {
          e.preventDefault();
          activate(tabs[newIndex], true);
        }
      });
    });
  }

  initTabs('.view-tabs');
  initTabs('.auth-tabs');

  // ---- Auth "switch tab" links ----
  document.querySelectorAll('[data-switch-tab]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var name = link.getAttribute('data-switch-tab');
      var tab = document.getElementById('tab-' + name);
      if (tab) tab.click();
      var panel = document.getElementById('panel-' + name);
      var heading = panel && panel.querySelector('h1');
      if (heading) heading.focus();
    });
  });

  // ---- Auth forms: mocked submit, route to landing ----
  document.querySelectorAll('[data-auth-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showToast('Signed in successfully');
      navigate('landing');
    });
  });

  // ---- Verdict actions: copy / share ----
  function showToast(message) {
    toast.textContent = '';
    window.setTimeout(function () {
      toast.textContent = message;
    }, 30);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('Clipboard API unavailable'));
  }

  var copyVerdictBtn = document.getElementById('copy-verdict-btn');
  if (copyVerdictBtn) {
    copyVerdictBtn.addEventListener('click', function () {
      var text = 'Winner: Claude — Provides the most comprehensive, actionable, and well-structured answer among the three models compared. Confidence: 87%.';
      copyToClipboard(text).then(function () {
        showToast('Verdict copied to clipboard');
      }, function () {
        showToast('Could not copy verdict');
      });
    });
  }

  function shareCurrentLink() {
    copyToClipboard(window.location.href).then(function () {
      showToast('Link copied to clipboard');
    }, function () {
      showToast('Could not copy link');
    });
  }

  var shareVerdictBtn = document.getElementById('share-verdict-btn');
  if (shareVerdictBtn) {
    shareVerdictBtn.addEventListener('click', shareCurrentLink);
  }

  var shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', shareCurrentLink);
  }

  // ---- "Ask another question" resets the query ----
  var askAnotherBtn = document.getElementById('ask-another-btn');
  if (askAnotherBtn) {
    askAnotherBtn.addEventListener('click', function () {
      queryInput.value = '';
    });
  }
})();
