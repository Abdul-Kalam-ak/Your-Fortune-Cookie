/* ---------------------------------------------------------
   Fortune Cookie — app logic V2
   Visible flow: moment -> preference -> crack.
   Hidden layer: emotional category -> random fortune.
--------------------------------------------------------- */

(() => {
  "use strict";

  const STORAGE_KEY = "fortuneCookie.lastChoice";

  const CATEGORY_WEIGHTS = {
    morning: {
      confidence: 20,
      motivation: 25,
      calm: 15,
      hope: 20,
      curiosity: 15,
      humor: 5,
    },
    bad_day: {
      comfort: 30,
      hope: 18,
      self_worth: 14,
      calm: 14,
      perspective: 12,
      encouragement: 8,
      humor: 4,
    },
  };

  const state = {
    fortunes: null,
    moment: null,
    preference: null,
    lastFortuneKey: null,
    lastCategory: null,
    cracked: false,
  };

  const els = {
    app: document.getElementById("app"),
    screens: Array.from(document.querySelectorAll(".screen")),
    cookie: document.getElementById("cookie"),
    cookieHalfLeft: document.querySelector(".cookie-half--left"),
    cookieHalfRight: document.querySelector(".cookie-half--right"),
    crackLine: document.querySelector(".crack-line"),
    crumbs: document.getElementById("crumbs"),
    tapHint: document.getElementById("tapHint"),
    fortuneText: document.getElementById("fortuneText"),
    revealActions: document.getElementById("revealActions"),
    againBtn: document.getElementById("againBtn"),
    shareBtn: document.getElementById("shareBtn"),
    startOverBtn: document.getElementById("startOverBtn"),
    toast: document.getElementById("toast"),
  };

  // Colors cycled through for the crumb burst — keeps the crack moment playful.
  const CRUMB_COLORS = ["#FF6B5E", "#FF9F1C", "#FFC53D", "#14B8A6", "#7C5CFC", "#FF6FA5"];

  // Drag-to-crack tuning.
  const DRAG_THRESHOLD = 56; // px of horizontal pull before the cookie snaps open
  const TAP_MOVE_LIMIT = 8; // px — below this, a release counts as a tap, not a drag

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  async function loadFortunes() {
    const res = await fetch("fortunes.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load fortunes.json");
    return res.json();
  }

  function getPool() {
    return state.fortunes?.[state.moment]?.[state.preference] ?? {};
  }

  function weightedCategory(excludeCategory = null) {
    const pool = getPool();
    const available = Object.keys(pool).filter(
      (category) => Array.isArray(pool[category]) && pool[category].length
    );

    if (!available.length) return null;

    const weights = CATEGORY_WEIGHTS[state.moment] || {};
    const candidates = available.filter((c) => c !== excludeCategory);
    const usable = candidates.length ? candidates : available;
    const total = usable.reduce((sum, c) => sum + (weights[c] || 1), 0);
    let cursor = Math.random() * total;

    for (const category of usable) {
      cursor -= weights[category] || 1;
      if (cursor <= 0) return category;
    }
    return usable[usable.length - 1];
  }

  function pickFortune() {
    const pool = getPool();
    const category = weightedCategory(state.lastCategory);

    if (!category) {
      return {
        text: "Good things are still being written for you.",
        category: "fallback",
        key: "fallback",
      };
    }

    const list = pool[category];
    let index = Math.floor(Math.random() * list.length);
    let item = list[index];

    // Avoid the exact previous fortune even when the category changes.
    if (list.length > 1) {
      let attempts = 0;
      while (`${category}:${index}` === state.lastFortuneKey && attempts < 8) {
        index = Math.floor(Math.random() * list.length);
        item = list[index];
        attempts++;
      }
    }

    state.lastCategory = category;
    state.lastFortuneKey = `${category}:${index}`;

    return {
      text: typeof item === "string" ? item.trim() : item.text.trim(),
      category,
      intensity: typeof item === "string" ? "gentle" : item.intensity,
      key: state.lastFortuneKey,
    };
  }

  const history = ["landing"];

  function showScreen(name) {
    els.screens.forEach((s) => {
      s.classList.toggle("active", s.dataset.screen === name);
    });
  }

  function goTo(name) {
    history.push(name);
    showScreen(name);
  }

  function goBack() {
    if (history.length <= 1) return;
    history.pop();
    const previous = history[history.length - 1];
    showScreen(previous);
    if (previous === "landing") {
      delete document.body.dataset.moment;
      resetCookie();
    }
  }

  function startOver() {
    history.length = 1;
    state.moment = null;
    state.preference = null;
    state.lastFortuneKey = null;
    state.lastCategory = null;
    delete document.body.dataset.moment;
    resetCookie();
    showScreen("landing");
  }

  function resetCookie() {
    state.cracked = false;
    state.cracking = false;
    els.cookie.classList.remove("cracked", "shaking", "dragging", "pressed");
    clearDragStyles();
    els.tapHint.classList.remove("is-hidden");
    els.revealActions.hidden = true;
    els.fortuneText.textContent = "";
    els.crumbs.innerHTML = "";
  }

  function clearDragStyles() {
    els.cookieHalfLeft.style.transform = "";
    els.cookieHalfRight.style.transform = "";
    els.crackLine.style.opacity = "";
    els.crackLine.style.transform = "";
  }

  function spawnCrumbs() {
    if (prefersReducedMotion) return;
    const count = 12;
    for (let i = 0; i < count; i++) {
      const c = document.createElement("span");
      c.className = "crumb";
      c.style.setProperty("--crumb-color", CRUMB_COLORS[i % CRUMB_COLORS.length]);
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      c.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      c.style.setProperty("--dy", `${Math.sin(angle) * dist - 20}px`);
      els.crumbs.appendChild(c);
      requestAnimationFrame(() => c.classList.add("pop"));
      setTimeout(() => c.remove(), 700);
    }
  }

  // Finishes the crack: picks a fortune and plays the open animation.
  // `skipShake` is used when the person has already dragged the cookie apart.
  function finishCrack(skipShake) {
    if (state.cracked || state.cracking) return;
    state.cracking = true;

    els.cookie.classList.remove("dragging", "pressed");
    clearDragStyles();
    els.tapHint.classList.add("is-hidden");

    const fortune = pickFortune();
    els.fortuneText.textContent = fortune.text;

    const shakeTime = prefersReducedMotion || skipShake ? 0 : 420;
    if (shakeTime) els.cookie.classList.add("shaking");

    setTimeout(() => {
      els.cookie.classList.remove("shaking");
      els.cookie.classList.add("cracked");
      state.cracked = true;
      state.cracking = false;
      spawnCrumbs();

      setTimeout(() => {
        els.revealActions.hidden = false;
      }, prefersReducedMotion ? 0 : 500);
    }, shakeTime);
  }

  function crackAnother() {
    els.cookie.classList.remove("cracked");
    els.revealActions.hidden = true;
    els.tapHint.classList.remove("is-hidden");
    state.cracked = false;
    els.fortuneText.textContent = "";
    requestAnimationFrame(() => finishCrack(false));
  }

  /* ---------------------------------------------------------
     Touch/drag: pull the cookie apart with a finger, or tap it.
  --------------------------------------------------------- */
  let dragState = null;

  function onCookiePointerDown(event) {
    if (state.cracked || state.cracking) return;
    if (event.button !== undefined && event.button !== 0) return;

    dragState = { startX: event.clientX, startY: event.clientY, moved: false };
    els.cookie.classList.add("pressed");
    try {
      els.cookie.setPointerCapture(event.pointerId);
    } catch (err) {
      /* ignore — not all pointer types support capture */
    }
  }

  function onCookiePointerMove(event) {
    if (!dragState || state.cracked || state.cracking) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;

    if (Math.abs(dx) > TAP_MOVE_LIMIT || Math.abs(dy) > TAP_MOVE_LIMIT) {
      dragState.moved = true;
    }
    if (!dragState.moved) return;

    els.cookie.classList.add("dragging");
    els.cookie.classList.remove("pressed");

    const pull = Math.max(-DRAG_THRESHOLD, Math.min(DRAG_THRESHOLD, dx));
    const progress = Math.abs(pull) / DRAG_THRESHOLD;

    els.cookieHalfLeft.style.transform = `translate(${pull * 0.9}px, ${progress * 6}px) rotate(${pull * -0.14}deg)`;
    els.cookieHalfRight.style.transform = `translate(${pull * 0.9}px, ${progress * 6}px) rotate(${pull * -0.14}deg)`;
    els.crackLine.style.opacity = String(Math.min(1, progress * 1.6));

    if (Math.abs(dx) >= DRAG_THRESHOLD) {
      dragState = null;
      finishCrack(true);
    }
  }

  function onCookiePointerUp(event) {
    if (!dragState) return;
    const wasTap = !dragState.moved;
    dragState = null;

    els.cookie.classList.remove("pressed", "dragging");
    clearDragStyles();

    if (wasTap) {
      finishCrack(false);
    }
    // If it was a drag that didn't cross the threshold, the cookie just
    // snaps back into place (styles already cleared above).
  }

  function onCookiePointerCancel() {
    dragState = null;
    els.cookie.classList.remove("pressed", "dragging");
    clearDragStyles();
  }

  function onCookieKeydown(event) {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      finishCrack(false);
    }
  }

  let toastTimer;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  async function shareFortune() {
    const text = els.fortuneText.textContent;
    if (!text) return;

    if (navigator.share) {
      try {
        await navigator.share({
          text: `🥠 ${text}\n\nFortune Cookie`,
          title: "Fortune Cookie",
        });
      } catch (err) {
        // User cancelled the share sheet.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`🥠 ${text}`);
      showToast("Copied to your clipboard.");
    } catch (err) {
      showToast("Couldn't copy automatically — select the text above.");
    }
  }

  function rememberChoice() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ moment: state.moment, preference: state.preference })
      );
    } catch (err) {
      // localStorage unavailable — safe to ignore.
    }
  }

  function init(fortuneData) {
    state.fortunes = fortuneData;

    els.app.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;

      if (action === "choose-moment") {
        state.moment = target.dataset.value;
        state.lastCategory = null;
        state.lastFortuneKey = null;
        document.body.dataset.moment = state.moment;
        goTo("preference");
      } else if (action === "choose-pref") {
        state.preference = target.dataset.value;
        state.lastCategory = null;
        state.lastFortuneKey = null;
        rememberChoice();
        resetCookie();
        goTo("cookie");
      } else if (action === "back") {
        goBack();
      }
    });

    els.cookie.addEventListener("pointerdown", onCookiePointerDown);
    els.cookie.addEventListener("pointermove", onCookiePointerMove);
    els.cookie.addEventListener("pointerup", onCookiePointerUp);
    els.cookie.addEventListener("pointercancel", onCookiePointerCancel);
    els.cookie.addEventListener("keydown", onCookieKeydown);
    els.againBtn.addEventListener("click", crackAnother);
    els.shareBtn.addEventListener("click", shareFortune);
    els.startOverBtn.addEventListener("click", startOver);

    showScreen("landing");
  }

  loadFortunes()
    .then(init)
    .catch((err) => {
      console.error(err);
      document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 2rem; text-align: center;">' +
        "This page needs to be run from a local web server so it can load " +
        "<code>fortunes.json</code>. See the README for a one-line command.</p>";
    });
})();
