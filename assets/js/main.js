/* Octovix / BlueLog landing page.
   No dependencies. Every behaviour degrades to a usable static page. */
(function () {
  'use strict';

  // Tells the inline head guard that this file loaded, so it leaves the `js`
  // class in place. If this never runs, the guard drops the class after 2.5s
  // and every [data-reveal] element falls back to plain visible content.
  window.__blueLogReady = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Theme toggle --------------------------------------------------
     The inline script in <head> already applies any saved choice before
     first paint (avoids a flash of the wrong theme). This just wires up
     the button, persists changes, and keeps the address-bar colour and
     aria-label in sync. With no saved choice the site follows the
     system's prefers-color-scheme, same as before this control existed. */
  var THEME_KEY = 'octovix-theme';
  var themeButtons = document.querySelectorAll('[data-theme-toggle]');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  var metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
  var metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');

  function isDark() {
    var explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'dark') return true;
    if (explicit === 'light') return false;
    return systemDark.matches;
  }

  function syncThemeUI() {
    var dark = isDark();
    themeButtons.forEach(function (btn) {
      btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    });
    // Address-bar colour: the two <meta theme-color> tags only react to the
    // system setting, so an explicit override needs to move the dark colour
    // onto whichever tag currently matches, and vice versa when clearing it.
    if (metaLight && metaDark) {
      var explicit = document.documentElement.getAttribute('data-theme');
      if (explicit) {
        var color = dark ? metaDark.content : metaLight.content;
        metaLight.setAttribute('media', explicit === 'light' ? 'all' : 'not all');
        metaDark.setAttribute('media', explicit === 'dark' ? 'all' : 'not all');
        metaLight.content = color;
        metaDark.content = color;
      } else {
        metaLight.setAttribute('media', '(prefers-color-scheme: light)');
        metaDark.setAttribute('media', '(prefers-color-scheme: dark)');
      }
    }
  }
  syncThemeUI();
  systemDark.addEventListener('change', syncThemeUI);

  themeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
      syncThemeUI();
    });
  });

  /* --- Current year in the footer ---------------------------------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --- Sticky nav: hairline appears once the page has moved ---------
     IntersectionObserver on a sentinel rather than a scroll listener. */
  var nav = document.querySelector('.nav');
  if (nav && 'IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* --- Mobile menu -------------------------------------------------- */
  var toggle = document.querySelector('.nav__toggle');
  var panel = document.getElementById('nav-panel');
  if (toggle && panel) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* --- Scroll reveal ------------------------------------------------ */
  var revealables = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { revealer.observe(el); });
  }

  /* --- Email signup -------------------------------------------------
     Set data-endpoint on each <form data-signup> to a POST URL that
     accepts JSON {email}. Works as-is with Formspree, Buttondown,
     ConvertKit and most form backends. See README.md. */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.querySelectorAll('[data-signup]').forEach(function (form) {
    var note = form.querySelector('[data-signup-note]');
    var input = form.querySelector('input[type="email"]');
    var idleText = note ? note.textContent : '';

    var say = function (message, state) {
      if (!note) return;
      note.textContent = message;
      if (state) note.setAttribute('data-state', state);
      else note.removeAttribute('data-state');
    };

    input.addEventListener('input', function () {
      if (note && note.getAttribute('data-state') === 'error') {
        input.removeAttribute('aria-invalid');
        say(idleText, null);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();

      if (!EMAIL_RE.test(email)) {
        input.setAttribute('aria-invalid', 'true');
        say('Please enter a valid email address.', 'error');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');

      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) {
        say('Email signup is not connected yet. Check back soon.', 'error');
        if (window.console) {
          console.warn(
            'BlueLog signup: no data-endpoint set on the form. ' +
            'Add one in index.html to start collecting addresses.'
          );
        }
        return;
      }

      form.classList.add('is-busy');
      say('Adding you to the list...', null);

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed with ' + res.status);
          form.reset();
          say('You are on the list. We will email you at launch.', 'success');
        })
        .catch(function () {
          say('That did not go through. Please try again in a moment.', 'error');
        })
        .then(function () {
          form.classList.remove('is-busy');
        });
    });
  });
})();
