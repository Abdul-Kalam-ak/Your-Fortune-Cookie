/* ---------------------------------------------------------
   Fortune Cookie — app logic
   Loads fortunes.json, walks the moment -> preference flow,
   and runs the crack-open reveal.
--------------------------------------------------------- */

(() => {
  "use strict";

  const STORAGE_KEY = "fortuneCookie.lastChoice";

  const state = {
    fortunes: null,
    moment: null,       // "morning" | "bad_day"
    preference: null,   // "male" | "female" | "general"
    lastIndex: null,    // avoid immediate repeats within a category
    cracked: false,
  };

  const els = {
    app: document.getElementById("app"),
    screens: Array.from(document.querySelectorAll(".screen")),
    cookie: document.getElementById("cookie"),
    crumbs: document.getElementById("crumbs"),
    crackBtn: document.getElementById("crackBtn"),
    fortuneText: document.getElementById("fortuneText"),
    revealActions: document.getElementById("revealActions"),
    againBtn: document.getElementById("againBtn"),
    shareBtn: document.getElementById("shareBtn"),
    startOverBtn: document.getElementById("startOverBtn"),
    toast: document.getElementById("toast"),
  };

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------------- data loading ---------------- */

  async function loadFortunes() {
    const res = await fetch("fortunes.json");
    if (!res.ok) throw new Error("Could not load fortunes.json");
    return res.json();
  }

  function categoryFor(moment, preference) {
    return state.fortunes?.[moment]?.[preference] ?? [];
  }

  function pickFortune() {
    const list = categoryFor(state.moment, state.preference);
    if (!list.length) return "Good things are still being written for you.";

    if (list.length === 1) {
      state.lastIndex = 0;
      return list[0].trim();
    }

    let index;
    do {
      index = Math.floor(Math.random() * list.length);
    } while (index === state.lastIndex);

    state.lastIndex = index;
    return list[index].trim();
  }

  /* ---------------- screen navigation ---------------- */

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
      resetCookie();
    }
  }

  function startOver() {
    history.length = 1;
    state.moment = null;
    state.preference = null;
    state.lastIndex = null;
    resetCookie();
    showScreen("landing");
  }

  /* ---------------- cookie animation ---------------- */

  function resetCookie() {
    state.cracked = false;
    els.cookie.classList.remove("cracked", "shaking");
    els.crackBtn.disabled = false;
    els.crackBtn.classList.remove("is-hidden");
    els.crackBtn.textContent = "Crack My Cookie";
    els.revealActions.hidden = true;
    els.fortuneText.textContent = "";
    els.crumbs.innerHTML = "";
  }

  function spawnCrumbs() {
    if (prefersReducedMotion) return;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const c = document.createElement("span");
      c.className = "crumb";
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      c.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      c.style.setProperty("--dy", `${Math.sin(angle) * dist - 20}px`);
      els.crumbs.appendChild(c);
      requestAnimationFrame(() => c.classList.add("pop"));
      setTimeout(() => c.remove(), 700);
    }
  }

  function crackCookie() {
    if (state.cracked) return;
    els.crackBtn.disabled = true;

    const fortune = pickFortune();
    els.fortuneText.textContent = fortune;

    const shakeTime = prefersReducedMotion ? 0 : 420;

    els.cookie.classList.add("shaking");

    setTimeout(() => {
      els.cookie.classList.remove("shaking");
      els.cookie.classList.add("cracked");
      state.cracked = true;
      spawnCrumbs();
      els.crackBtn.classList.add("is-hidden");

      setTimeout(() => {
        els.revealActions.hidden = false;
      }, prefersReducedMotion ? 0 : 500);
    }, shakeTime);
  }

  function crackAnother() {
    els.cookie.classList.remove("cracked");
    els.revealActions.hidden = true;
    els.crackBtn.classList.remove("is-hidden");
    els.crackBtn.disabled = false;
    state.cracked = false;
    els.fortuneText.textContent = "";
    // small delay so the re-close registers as a fresh state before cracking again
    requestAnimationFrame(() => crackCookie());
  }

  /* ---------------- share / toast ---------------- */

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
        await navigator.share({ text, title: "Fortune Cookie" });
      } catch (err) {
        // user cancelled share — no action needed
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to your clipboard.");
    } catch (err) {
      showToast("Couldn't copy automatically — select the text above.");
    }
  }

  /* ---------------- preference / memory ---------------- */

  function rememberChoice() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ moment: state.moment, preference: state.preference })
      );
    } catch (err) {
      // localStorage unavailable — safe to ignore
    }
  }

  /* ---------------- wiring ---------------- */

  function init(fortuneData) {
    state.fortunes = fortuneData;

    els.app.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;

      if (action === "choose-moment") {
        state.moment = target.dataset.value;
        goTo("preference");
      } else if (action === "choose-pref") {
        state.preference = target.dataset.value;
        rememberChoice();
        resetCookie();
        goTo("cookie");
      } else if (action === "back") {
        goBack();
      }
    });

    els.crackBtn.addEventListener("click", crackCookie);
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
