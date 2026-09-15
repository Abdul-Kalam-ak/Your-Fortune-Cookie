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

  /* ---------------------------------------------------------
     Share image — draws the cracked cookie + fortune onto a
     canvas so shares carry a real picture, not just an emoji.
  --------------------------------------------------------- */
  function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawCookieHalf(ctx, cx, cy, w, h, tiltDeg, colors) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((tiltDeg * Math.PI) / 180);

    ctx.shadowColor = "rgba(60, 35, 10, 0.35)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 18;

    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();

    const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.55, colors.mid);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.beginPath();
    ctx.ellipse(-w * 0.12, -h * 0.2, w * 0.28, h * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();

    ctx.restore();
  }

  async function buildCookieShareImage(fortuneText) {
    const cs = getComputedStyle(document.body);
    const v = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim();

    const colors = {
      bg: v("--bg", "#FFF6E8"),
      bgDeep: v("--bg-deep", "#FFE3B8"),
      ink: v("--ink", "#2B1E3D"),
      inkSoft: v("--ink-soft", "#6C5A80"),
      accent: v("--accent", "#FF6B5E"),
      accent2: v("--accent-2", "#FF9F1C"),
      paper: v("--paper", "#FFFDF6"),
      paperLine: v("--paper-line", "#F0E2C4"),
      cookieLight: v("--cookie-light", "#F6CC7E"),
      cookieMid: v("--cookie-mid", "#E4A430"),
      cookieDark: v("--cookie-dark", "#B0701B"),
    };

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.load('italic 500 56px "Fraunces"');
        await document.fonts.load('600 34px "Work Sans"');
        await document.fonts.ready;
      } catch (err) {
        /* fall back to system fonts below */
      }
    }

    const W = 1080;
    const H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background
    const bgGrad = ctx.createRadialGradient(W / 2, 40, 80, W / 2, H * 0.15, W);
    bgGrad.addColorStop(0, colors.bgDeep);
    bgGrad.addColorStop(1, colors.bg);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Scattered confetti dots for brand texture
    const confettiColors = [colors.accent, colors.accent2, "#14B8A6", "#7C5CFC", "#FF6FA5"];
    let seed = 42;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.fillStyle = confettiColors[i % confettiColors.length];
      ctx.globalAlpha = 0.35;
      const r = 4 + rand() * 4;
      ctx.arc(rand() * W, rand() * H * 0.85, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Wordmark
    ctx.textAlign = "center";
    ctx.fillStyle = colors.accent;
    ctx.font = '500 34px "Fraunces", Georgia, serif';
    ctx.fillText("Fortune Cookie", W / 2, 120);

    // Cracked cookie
    const cookieCy = H * 0.46;
    drawCookieHalf(ctx, W / 2 - 150, cookieCy + 20, 420, 260, -16, {
      light: colors.cookieLight,
      mid: colors.cookieMid,
      dark: colors.cookieDark,
    });
    drawCookieHalf(ctx, W / 2 + 150, cookieCy + 20, 420, 260, 16, {
      light: colors.cookieLight,
      mid: colors.cookieMid,
      dark: colors.cookieDark,
    });

    // Crumbs
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 190 + rand() * 120;
      const r = 3 + rand() * 4;
      ctx.beginPath();
      ctx.fillStyle = confettiColors[i % confettiColors.length];
      ctx.globalAlpha = 0.85;
      ctx.arc(
        W / 2 + Math.cos(angle) * dist,
        cookieCy + 40 + Math.sin(angle) * dist * 0.5,
        r,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();

    // Fortune paper
    const paperW = 620;
    const paperX = W / 2 - paperW / 2;
    const paperTopY = cookieCy - 210;
    const lineHeight = 46;
    ctx.font = 'italic 500 38px "Fraunces", Georgia, serif';
    const lines = wrapCanvasText(ctx, fortuneText, paperW - 90);
    const paperH = 90 + lines.length * lineHeight;

    ctx.save();
    ctx.shadowColor = "rgba(60, 35, 10, 0.28)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = colors.paper;
    roundRect(ctx, paperX, paperTopY, paperW, paperH, 18);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = colors.accent;
    roundRect(ctx, paperX, paperTopY, paperW, 8, 4);
    ctx.fill();

    ctx.fillStyle = colors.ink;
    ctx.textAlign = "center";
    ctx.font = 'italic 500 38px "Fraunces", Georgia, serif';
    const startY = paperTopY + 62;
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineHeight);
    });

    // Footer: brand + link
    ctx.fillStyle = colors.inkSoft;
    ctx.font = '500 26px "Work Sans", system-ui, sans-serif';
    ctx.fillText("Take this with you today.", W / 2, H - 96);

    ctx.fillStyle = colors.accent;
    ctx.font = '600 24px "Work Sans", system-ui, sans-serif';
    const siteLabel = location.href.replace(/^https?:\/\//, "").replace(/\/$/, "");
    ctx.fillText(siteLabel, W / 2, H - 56);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function shareFortune() {
    const text = els.fortuneText.textContent;
    if (!text) return;

    const pageUrl = location.href;
    const shareText = `🥠 ${text}\n\nFortune Cookie — ${pageUrl}`;

    let blob = null;
    try {
      blob = await buildCookieShareImage(text);
    } catch (err) {
      // Drawing failed (e.g. canvas restrictions) — fall back to text-only share below.
    }

    const file = blob ? new File([blob], "fortune-cookie.png", { type: "image/png" }) : null;

    // 1) Native share sheet with the cookie image attached, when supported.
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Fortune Cookie",
          text: shareText,
          url: pageUrl,
        });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // user cancelled
        // fall through to the next option
      }
    }

    // 2) Native share sheet without a file (some browsers support share() but not files).
    if (navigator.share) {
      try {
        await navigator.share({ title: "Fortune Cookie", text: shareText, url: pageUrl });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        // fall through to the download fallback
      }
    }

    // 3) No share API at all (most desktop browsers): download the image and
    //    copy the fortune + link so the person can attach both by hand.
    if (blob) downloadBlob(blob, "fortune-cookie.png");
    try {
      await navigator.clipboard.writeText(shareText);
      showToast(blob ? "Image downloaded & fortune copied." : "Copied to your clipboard.");
    } catch (err) {
      showToast(blob ? "Image downloaded — copy the fortune above to share it." : "Couldn't copy automatically — select the text above.");
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
