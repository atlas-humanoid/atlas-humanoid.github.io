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
  const loops = [...document.querySelectorAll("video[loop]:not(#learning-video):not([data-showcase-video])")];
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

/* The opening demos loop independently while visible. */
function setupShowcase() {
  const videos = [...document.querySelectorAll("#opening-showcase video[data-showcase-video]")];
  if (!videos.length) return;
  const hasObserver = "IntersectionObserver" in window;
  const visible = new Set(hasObserver ? [] : videos);
  const applyPlayback = () => videos.forEach(v => {
    if (!visible.has(v) || document.hidden) v.pause();
    else if (!v.paused || REDUCED) return;
    else play(v);
  });
  videos.forEach(v => {
    if (REDUCED) { v.removeAttribute("autoplay"); v.pause(); }
    v.addEventListener("loadedmetadata", applyPlayback);
  });
  if (hasObserver) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= 0.01) visible.add(e.target);
        else visible.delete(e.target);
      });
      applyPlayback();
    }, { threshold: 0.01 });
    videos.forEach(v => observer.observe(v));
  }
  document.addEventListener("visibilitychange", applyPlayback);
  applyPlayback();
}

document.addEventListener("DOMContentLoaded", () => {
  setupLinks();
  setupClips();
  setupShowcase();
});

/* One rendered film contains the real attempts and their learning illustrations. */
function setupLearningLoop() {
  const v = document.getElementById("learning-video"), media = document.getElementById("learning-media");
  if (!v || !media) return;
  const card = v.closest(".learning-loop"), mobile = window.matchMedia("(max-width: 800px)");
  let inView = !("IntersectionObserver" in window);
  let sourceChanging = false, restoreTime = null, hasStarted = false;
  const resume = () => {
    if (!inView || document.hidden || sourceChanging) return;
    play(v);
  };
  const suspend = () => v.pause();
  const revealFrame = () => {
    if (hasStarted && !sourceChanging && v.readyState >= 2) media.classList.add("is-started");
  };
  v.addEventListener("playing", () => { hasStarted = true; revealFrame(); });
  v.addEventListener("loadedmetadata", () => {
    if (restoreTime === null) return;
    const t = Math.min(restoreTime, Math.max(0, v.duration - 1 / 30));
    restoreTime = null;
    if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
    else { sourceChanging = false; revealFrame(); resume(); }
  });
  v.addEventListener("loadeddata", revealFrame);
  v.addEventListener("seeked", () => {
    const restoring = sourceChanging;
    sourceChanging = false;
    revealFrame();
    if (restoring) resume();
  });
  v.addEventListener("error", () => { sourceChanging = false; restoreTime = null; });
  const chooseSource = () => {
    const source = mobile.matches ? v.dataset.mobile : v.dataset.desktop;
    v.poster = mobile.matches ? v.dataset.mobilePoster : v.dataset.desktopPoster;
    v.width = mobile.matches ? 960 : 1920;
    v.height = mobile.matches ? 1400 : 880;
    if (v.getAttribute("src") === source) return;
    restoreTime = restoreTime === null ? v.currentTime : restoreTime;
    sourceChanging = true;
    v.pause();
    media.classList.remove("is-started");
    v.src = source;
    v.load();
  };
  if (mobile.addEventListener) mobile.addEventListener("change", chooseSource);
  else mobile.addListener(chooseSource);
  chooseSource();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) resume(); else suspend();
    }, { threshold: 0.08 }).observe(card);
  } else resume();
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else resume(); });
}
setupLearningLoop();
