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

  var DEFAULT_QUESTION = 'Explain quantum computing';
  var USERS_KEY = 'llmrouter_users';
  var SESSION_KEY = 'llmrouter_session';

  var announcer = document.getElementById('route-announcer');
  var toast = document.getElementById('toast');
  var navLinks = document.querySelectorAll('.primary-nav a[data-route]');
  var screens = {};
  ROUTES.forEach(function (name) {
    screens[name] = document.getElementById('screen-' + name);
  });

  var isFirstRoute = true;
  var currentComparison = null;

  // ========== Router ==========

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
      el.hidden = route !== name;
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

  // ========== Toast (visible + announced) ==========

  var toastTimer = null;

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.classList.remove('is-visible');
    toast.textContent = '';
    window.setTimeout(function () {
      toast.textContent = message;
      toast.classList.add('is-visible');
      toastTimer = window.setTimeout(function () {
        toast.classList.remove('is-visible');
      }, 2600);
    }, 30);
  }

  // ========== Clipboard (with legacy fallback) ==========

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      var succeeded = false;
      try {
        succeeded = document.execCommand('copy');
      } catch (e) {
        succeeded = false;
      }
      document.body.removeChild(textarea);
      if (succeeded) {
        resolve();
      } else {
        reject(new Error('execCommand copy failed'));
      }
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  // ========== Mock comparison generator ==========

  function hashString(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    return Math.abs(hash);
  }

  var MODELS = [
    { key: 'gpt4o', name: 'GPT-4o' },
    { key: 'claude', name: 'Claude' },
    { key: 'gemini', name: 'Gemini' }
  ];

  var RESPONSE_TEMPLATES = {
    gpt4o: [
      function (q) { return 'Here’s a direct answer on “' + q + '”: focus on the core idea first, then layer in detail as needed — a fast, practical starting point without extra padding.'; },
      function (q) { return 'Quick take on “' + q + '” — get the fundamentals straight, then build from there. Efficient, no filler.'; },
      function (q) { return 'Short version of “' + q + '”: here’s what matters most, stated plainly so you can act on it right away.'; }
    ],
    claude: [
      function (q) { return 'Let’s break down “' + q + '” properly. There are a few core ideas worth understanding, each explained with a real-world analogy so the concepts stick — plus a practical way to apply them.'; },
      function (q) { return 'Here’s a thorough look at “' + q + '”: I’ll walk through the underlying concepts step by step, with an analogy for each, so you leave with both the reasoning and a way to use it.'; },
      function (q) { return 'On “' + q + '” — rather than a one-line answer, here’s the full picture: the key concepts, how they connect, and a concrete example to anchor it all.'; }
    ],
    gemini: [
      function (q) { return 'At its core, “' + q + '” comes down to a handful of key facts. Here’s a structured rundown of what matters most, with the important points front and center.'; },
      function (q) { return 'Quick facts on “' + q + '”: here are the essentials, organized so the most important points stand out first.'; },
      function (q) { return 'Here’s “' + q + '” distilled into its key facts, laid out so you can scan and compare at a glance.'; }
    ]
  };

  var FULL_RESPONSE_TEMPLATES = {
    gpt4o: function (q) {
      return 'Here’s a direct answer on “' + q + '.”\n\n' +
        'The key point: focus on the core mechanism first — once that clicks, the rest follows naturally.\n\n' +
        '1. Start with the fundamental idea behind “' + q + '.”\n' +
        '2. Note the most common misconception people run into.\n' +
        '3. Apply it to a simple, everyday example to make it concrete.\n\n' +
        'That’s the fast, practical path — no extra padding.';
    },
    claude: function (q) {
      return 'Let’s break down “' + q + '” properly.\n\n' +
        'There are a few core ideas worth understanding here, so I’ll walk through them one at a time, with a real-world analogy for each so the concepts stick:\n\n' +
        '1. The foundational concept — what’s actually going on.\n' +
        '2. Why it matters — the practical implication.\n' +
        '3. How to apply it — a concrete next step.\n\n' +
        'Put together, that gives you both the reasoning behind “' + q + '” and a way to use it.';
    },
    gemini: function (q) {
      return 'At its core, “' + q + '” comes down to a handful of key facts.\n\n' +
        'Here’s a structured rundown:\n\n' +
        '• The essential fact most people need to know first.\n' +
        '• A second point that’s often overlooked.\n' +
        '• The most actionable takeaway.\n\n' +
        'That’s the core of “' + q + '”, organized so the most important points stand out.';
    }
  };

  function generateComparison(rawQuestion) {
    var question = (rawQuestion || '').trim() || DEFAULT_QUESTION;
    var hash = hashString(question.toLowerCase());
    var winnerIndex = hash % 3;
    var confidence = 74 + (hash % 22);
    var variantSeed = Math.floor(hash / 3);

    var responses = MODELS.map(function (model, i) {
      var variants = RESPONSE_TEMPLATES[model.key];
      var variant = variants[(variantSeed + i) % variants.length];
      return {
        key: model.key,
        name: model.name,
        snippet: variant(question),
        full: FULL_RESPONSE_TEMPLATES[model.key](question),
        isWinner: i === winnerIndex
      };
    });

    return {
      question: question,
      responses: responses,
      winnerName: MODELS[winnerIndex].name,
      winnerKey: MODELS[winnerIndex].key,
      confidence: confidence
    };
  }

  function renderComparison(comparison) {
    currentComparison = comparison;

    document.getElementById('question-text').textContent = '“' + comparison.question + '”';
    document.getElementById('table-caption').textContent = 'Model responses for “' + comparison.question + '”';

    comparison.responses.forEach(function (r) {
      var card = document.getElementById('card-' + r.key);
      var snippet = document.getElementById('snippet-' + r.key);
      var badge = document.getElementById('badge-' + r.key);
      var td = document.getElementById('td-' + r.key);
      var tag = document.getElementById('tag-' + r.key);

      snippet.textContent = r.snippet;
      td.textContent = r.snippet;
      card.classList.toggle('is-winner', r.isWinner);
      badge.hidden = !r.isWinner;
      tag.hidden = !r.isWinner;
    });

    document.getElementById('banner-winner-name').textContent = comparison.winnerName;
    document.getElementById('verdict-winner-name').textContent = comparison.winnerName;

    var track = document.getElementById('confidence-track');
    var fill = document.getElementById('confidence-fill');
    var value = document.getElementById('confidence-value');
    track.setAttribute('aria-valuenow', String(comparison.confidence));
    track.setAttribute('aria-valuetext', comparison.confidence + '%');
    fill.style.width = comparison.confidence + '%';
    value.textContent = comparison.confidence + '%';
  }

  renderComparison(generateComparison(DEFAULT_QUESTION));
  showRoute(currentRoute());

  // ========== Landing: query form + example chips ==========

  var queryInput = document.getElementById('query-input');
  var queryForm = document.getElementById('query-form');

  queryForm.addEventListener('submit', function (e) {
    e.preventDefault();
    renderComparison(generateComparison(queryInput.value));
    navigate('compare');
  });

  document.querySelectorAll('.chip[data-example]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      queryInput.value = chip.getAttribute('data-example');
      queryInput.focus();
    });
  });

  // ========== Per-model "Open full response" modal ==========

  var appRoot = document.getElementById('app-root');
  var modalOverlay = document.getElementById('response-modal-overlay');
  var modalTitle = document.getElementById('response-modal-title');
  var modalBody = document.getElementById('response-modal-body');
  var modalClose = document.getElementById('response-modal-close');
  var modalTriggerEl = null;

  function getFocusable(container) {
    var selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(selector));
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') {
      closeResponseModal();
      return;
    }
    if (e.key === 'Tab') {
      var focusable = getFocusable(modalOverlay.querySelector('.modal'));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openResponseModal(modelKey) {
    var match = currentComparison.responses.filter(function (r) {
      return r.key === modelKey;
    });
    if (!match.length) return;
    var r = match[0];

    modalTriggerEl = document.activeElement;
    modalTitle.textContent = r.name + '’s full response';
    modalBody.textContent = r.full;
    modalOverlay.hidden = false;
    appRoot.setAttribute('aria-hidden', 'true');
    document.addEventListener('keydown', onModalKeydown);
    modalClose.focus();
  }

  function closeResponseModal() {
    modalOverlay.hidden = true;
    appRoot.removeAttribute('aria-hidden');
    document.removeEventListener('keydown', onModalKeydown);
    if (modalTriggerEl) modalTriggerEl.focus();
  }

  modalClose.addEventListener('click', closeResponseModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeResponseModal();
  });

  document.querySelectorAll('[data-open-response]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openResponseModal(btn.getAttribute('data-open-response'));
    });
  });

  // ========== "View full verdict" button ==========

  document.querySelectorAll('[data-open-verdict]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigate('verdict');
    });
  });

  // ========== Generic ARIA tabs widget ==========

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

  // ========== Auth "switch tab" links ==========

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

  // ========== Auth: localStorage-backed accounts ==========

  function getUsers() {
    try {
      return JSON.parse(window.localStorage.getItem(USERS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveUsers(users) {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getSession() {
    return window.localStorage.getItem(SESSION_KEY);
  }

  function setSession(username) {
    window.localStorage.setItem(SESSION_KEY, username);
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
  }

  function signUp(username, password) {
    var users = getUsers();
    var key = username.toLowerCase();
    if (users[key]) {
      return { ok: false, message: 'That username is already taken.' };
    }
    users[key] = { username: username, password: password };
    saveUsers(users);
    setSession(username);
    return { ok: true, message: 'Account created — signed in as ' + username + '.' };
  }

  function signIn(username, password) {
    var users = getUsers();
    var key = username.toLowerCase();
    var record = users[key];
    if (!record) {
      return { ok: false, message: 'No account found with that username.' };
    }
    if (record.password !== password) {
      return { ok: false, message: 'Incorrect password.' };
    }
    setSession(record.username);
    return { ok: true, message: 'Signed in as ' + record.username + '.' };
  }

  function initials(name) {
    var trimmed = (name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'R';
  }

  var brandMark = document.getElementById('brand-mark');
  var navAuthLabel = document.getElementById('nav-auth-label');
  var headerAccount = document.getElementById('header-account');
  var authTabs = document.getElementById('auth-tabs');
  var panelSignin = document.getElementById('panel-signin');
  var panelSignup = document.getElementById('panel-signup');
  var panelAccount = document.getElementById('panel-account');
  var accountStatusText = document.getElementById('account-status-text');
  var tabSignin = document.getElementById('tab-signin');
  var tabSignup = document.getElementById('tab-signup');

  function handleLogout() {
    clearSession();
    updateAuthUI();
    showToast('Logged out');
    navigate('landing');
  }

  function updateAuthUI() {
    var session = getSession();
    headerAccount.innerHTML = '';

    if (session) {
      brandMark.textContent = initials(session);
      navAuthLabel.textContent = session;

      var logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'header-account-btn';
      logoutBtn.textContent = 'Log out';
      logoutBtn.addEventListener('click', handleLogout);
      headerAccount.appendChild(logoutBtn);

      authTabs.hidden = true;
      panelSignin.hidden = true;
      panelSignup.hidden = true;
      panelAccount.hidden = false;
      accountStatusText.textContent = 'Signed in as ' + session + '.';
    } else {
      brandMark.textContent = 'R';
      navAuthLabel.textContent = 'Sign in';

      authTabs.hidden = false;
      panelAccount.hidden = true;
      tabSignin.setAttribute('aria-selected', 'true');
      tabSignin.tabIndex = 0;
      tabSignup.setAttribute('aria-selected', 'false');
      tabSignup.tabIndex = -1;
      panelSignin.hidden = false;
      panelSignup.hidden = true;
    }
  }

  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('[data-auth-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kind = form.getAttribute('data-auth-form');
      var usernameInput = form.querySelector('input[name="username"]');
      var passwordInput = form.querySelector('input[name="password"]');
      var errorEl = document.getElementById(kind + '-error');
      var username = usernameInput.value.trim();
      var password = passwordInput.value;

      function showError(message) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }

      if (!username || !password) {
        showError('Please enter both a username and password.');
        return;
      }

      var result = kind === 'signup' ? signUp(username, password) : signIn(username, password);
      if (!result.ok) {
        showError(result.message);
        return;
      }

      errorEl.textContent = '';
      errorEl.hidden = true;
      form.reset();
      updateAuthUI();
      showToast(result.message);
      navigate('landing');
    });
  });

  updateAuthUI();

  // ========== Verdict actions: copy / share ==========

  var copyVerdictBtn = document.getElementById('copy-verdict-btn');
  if (copyVerdictBtn) {
    copyVerdictBtn.addEventListener('click', function () {
      var c = currentComparison;
      var text = 'Winner: ' + c.winnerName + ' — for “' + c.question + '”. Confidence: ' + c.confidence + '%.';
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

  // ========== "Ask another question" resets the query ==========

  var askAnotherBtn = document.getElementById('ask-another-btn');
  if (askAnotherBtn) {
    askAnotherBtn.addEventListener('click', function () {
      queryInput.value = '';
    });
  }
})();
