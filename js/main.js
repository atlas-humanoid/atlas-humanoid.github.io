/* ATLAS project page, early release. Swap the links here when the paper and code are public. */
const PAPER_URL = "";   // "" leaves the Paper button disabled
const CODE_URL = "";    // "" leaves the Code button disabled

const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function play(v) { if (REDUCED) return; const p = v.play(); if (p && p.catch) p.catch(() => {}); }

/* the Paper and Code buttons: a real link, or disabled until there is one */
function setupLinks() {
  [["btn-paper", PAPER_URL], ["btn-code", CODE_URL]].forEach(([id, url]) => {
    const a = document.getElementById(id);
    if (!a) return;
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; return; }
    a.setAttribute("aria-disabled", "true");
    a.title = "On its way";
    a.addEventListener("click", e => e.preventDefault());
  });
}

/* looping clips play while on screen; the whole session plays once when it comes into view */
function setupClips() {
  const session = document.getElementById("session");
  const loops = [...document.querySelectorAll("video[loop]:not(#run)")];
  if (REDUCED) {
    loops.forEach(v => { v.removeAttribute("autoplay"); v.pause(); v.setAttribute("controls", ""); });
    return;
  }
  if (!("IntersectionObserver" in window)) { loops.forEach(play); return; }
  let sessionStarted = false;
  const onVisibility = es => es.forEach(e => {
    const v = e.target;
    if (v === session) {
      if (e.isIntersecting && !sessionStarted) { sessionStarted = true; play(v); }
      else if (!e.isIntersecting && !v.paused && !v.ended) v.pause();
      return;
    }
    if (e.isIntersecting) play(v); else v.pause();
  });
  const io = new IntersectionObserver(onVisibility, { threshold: 0.4 });
  // The title can leave only a sliver of the hero visible on shorter screens.
  const heroIO = new IntersectionObserver(onVisibility, { threshold: 0.01 });
  loops.forEach(v => {
    (v.closest(".film") ? heroIO : io).observe(v);
    v.addEventListener("click", () => (v.paused ? play(v) : v.pause()));
  });
  if (session) io.observe(session);
}

document.addEventListener("DOMContentLoaded", () => {
  setupLinks();
  setupClips();
});

/* The real run is the only clock for the retry figure and its rendered illustration. */
function setupRun() {
  const strip = document.getElementById("runstrip"), v = document.getElementById("run"), mover = document.getElementById("runmover");
  const chip = document.getElementById("runphase"), illustration = document.getElementById("learning-video");
  const media = document.getElementById("learning-media"), toggle = document.getElementById("run-toggle"), replay = document.getElementById("run-replay");
  if (!strip || !v || !mover || !chip) return;
  const figure = strip.closest(".fig--retry"), slots = [...strip.querySelectorAll(".slot")];
  const ATT = [[3.4, 8.0], [8.4, 13.0], [13.4, 19.8]];          /* each attempt's window in the clip, s (the clip opens with the climb) */
  const PHASES = [
    [0.0, "climbing the stairs"], [3.4, "attempt 1 · <i>π</i><sub>φ</sub> from zero"], [5.5, "attempt 1 · miss"],
    [8.0, "fit <i>f</i><sub>ψ</sub> · update <i>π</i><sub>φ</sub>"], [8.4, "attempt 2 · <i>π</i><sub>φ</sub> updated"], [10.7, "attempt 2 · miss"],
    [13.0, "fit <i>f</i><sub>ψ</sub> · update <i>π</i><sub>φ</sub>"], [13.4, "attempt 3 · <i>π</i><sub>φ</sub> updated again"], [16.2, "attempt 3 · grasp"],
  ];
  let slot = 0, phase = -1, holdTimer = 0;
  let wantsPlayback = !REDUCED, inView = !("IntersectionObserver" in window), waiting = false;
  let illustrationPending = false, hasStarted = false;
  const showControls = () => {
    if (!toggle) return;
    const active = !v.paused || !!holdTimer;
    toggle.textContent = active ? "Pause" : "Play";
    toggle.setAttribute("aria-label", `${active ? "Pause" : "Play"} real attempts and illustration`);
  };
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
  const syncIllustration = (force = false) => {
    if (!illustration || illustration.readyState < 1) return;
    const t = Math.min(v.currentTime, Math.max(0, illustration.duration - 1 / 30));
    if (force || Math.abs(illustration.currentTime - t) > 0.12) illustration.currentTime = t;
    illustration.playbackRate = v.playbackRate;
    if (v.paused || v.seeking || waiting || v.readyState < 3 || document.hidden) {
      illustration.pause();
    } else if (illustration.paused && !illustrationPending) {
      illustrationPending = true;
      const p = illustration.play();
      if (p && p.then) p.catch(() => {}).finally(() => { illustrationPending = false; });
      else illustrationPending = false;
    }
  };
  const resume = () => {
    if (!wantsPlayback || !inView || document.hidden || holdTimer) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => { showControls(); });
  };
  const suspend = () => {
    cancelHold();
    v.pause();
    if (illustration) illustration.pause();
    showControls();
  };
  const manualPlay = () => { wantsPlayback = true; inView = true; cancelHold(); resume(); };
  const manualPause = () => { wantsPlayback = false; suspend(); };
  const togglePlayback = () => ((!v.paused || holdTimer) ? manualPause() : manualPlay());
  const place = (k, jump) => {
    mover.classList.toggle("jump", !!jump);
    mover.style.left = slots[k].offsetLeft + "px";
    if (jump) {
      // Commit the new position before restoring transitions, including on resize.
      void mover.offsetWidth;
      requestAnimationFrame(() => mover.classList.remove("jump"));
    }
  };
  const freeze = k => { const c = slots[k].querySelector("canvas"); try { c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); } catch (e) {} };
  const clear = () => slots.forEach(s => { const c = s.querySelector("canvas"); c.getContext("2d").clearRect(0, 0, c.width, c.height); });
  const hold = ms => {
    if (v.paused || !wantsPlayback) return;
    cancelHold();
    holdTimer = setTimeout(() => { holdTimer = 0; resume(); showControls(); }, ms);
    v.pause();
    syncIllustration(true);
    showControls();
  };
  const fit = () => { mover.style.width = slots[0].offsetWidth + "px"; place(slot, true); };
  window.addEventListener("resize", fit); fit();
  const update = (seek = false) => {
    const t = v.currentTime;
    if (v.duration) {
      let k = 0; for (let i = 0; i < ATT.length; i++) if (t >= ATT[i][0]) k = i;
      if (k < slot) {
        clear(); slot = k; place(k, true);
        if (!seek && !v.seeking) hold(500);
      } else if (k > slot) {
        if (!seek && !v.seeking) for (let i = slot; i < k; i++) freeze(i);
        else clear();
        slot = k; place(k, seek || v.seeking);
        // Preserve the real video's 0.8 s move plus 0.5 s hold; both videos pause.
        if (!seek && !v.seeking) hold(1300);
      }
      let p = 0; for (let i = 0; i < PHASES.length; i++) if (t >= PHASES[i][0]) p = i;
      if (p !== phase) { chip.innerHTML = PHASES[p][1]; phase = p; }
    }
  };
  v.addEventListener("play", () => { wantsPlayback = true; hasStarted = true; showControls(); syncIllustration(true); });
  v.addEventListener("playing", () => { waiting = false; syncIllustration(true); });
  v.addEventListener("pause", () => {
    if (!holdTimer && inView && !document.hidden) wantsPlayback = false;
    syncIllustration(true); showControls();
  });
  v.addEventListener("waiting", () => { waiting = true; if (illustration) illustration.pause(); });
  v.addEventListener("seeking", () => { cancelHold(); update(true); syncIllustration(true); });
  v.addEventListener("seeked", () => { waiting = false; update(true); syncIllustration(true); showControls(); });
  v.addEventListener("ratechange", () => syncIllustration(true));
  v.addEventListener("timeupdate", () => { update(); syncIllustration(); });
  v.addEventListener("click", togglePlayback);
  if (toggle) toggle.addEventListener("click", togglePlayback);
  if (replay) replay.addEventListener("click", () => {
    cancelHold(); clear(); slot = 0; phase = -1; place(0, true);
    v.currentTime = 0; update(true); syncIllustration(true); manualPlay();
  });
  if (illustration) {
    illustration.addEventListener("playing", () => { if (media) media.classList.add("is-started"); });
    illustration.addEventListener("loadedmetadata", () => syncIllustration(true));
    illustration.addEventListener("seeked", () => {
      if (hasStarted && media) media.classList.add("is-started");
      syncIllustration();
    });
    const mobile = window.matchMedia("(max-width: 640px)");
    const chooseSource = () => {
      const source = mobile.matches ? illustration.dataset.mobile : illustration.dataset.desktop;
      illustration.poster = mobile.matches ? "media/learning_loop_mobile.jpg" : "media/learning_loop.jpg";
      if (illustration.getAttribute("src") === source) return;
      illustration.pause();
      if (media) media.classList.remove("is-started");
      illustration.src = source; illustration.load();
    };
    if (mobile.addEventListener) mobile.addEventListener("change", chooseSource);
    else mobile.addListener(chooseSource);
    chooseSource();
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) resume(); else suspend();
    }, { threshold: 0.08 }).observe(figure);
  } else resume();
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else resume(); });
  const step = () => { update(); syncIllustration(); requestAnimationFrame(step); };
  showControls();
  requestAnimationFrame(step);
}
setupRun();
