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
  const loops = [...document.querySelectorAll("video[loop]")];
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

/* the retry figure: one run; the video moves from slot to slot as the attempts go by, each slot it leaves keeps that attempt's last frame; the cursor on the rail and the phase chip follow the video */
function setupRun() {
  const strip = document.getElementById("runstrip"), v = document.getElementById("run"), mover = document.getElementById("runmover");
  const chip = document.getElementById("runphase"), cur = document.getElementById("runcur");
  if (!strip || !v || !mover || !chip) return;
  const slots = [...strip.querySelectorAll(".slot")], spans = [...document.querySelectorAll(".fig--retry .axis .span")];
  const pans = [...document.querySelectorAll(".fig--retry .schem .pan")], loops = [...document.querySelectorAll(".fig--retry .schem .loop")];
  const light = k => { pans.forEach((p, i) => p.classList.toggle("on", i <= k)); loops.forEach((l, i) => l.classList.toggle("on", i < k)); };
  const ATT = [[3.4, 8.0], [8.4, 13.0], [13.4, 19.8]];          /* each attempt's window in the clip, s (the clip opens with the climb) */
  const PHASES = [
    [0.0, "climbing the stairs"], [3.4, "attempt 1 · <i>π</i><sub>φ</sub> from zero"], [5.5, "attempt 1 · miss"],
    [8.0, "fit <i>f</i><sub>ψ</sub> · update <i>π</i><sub>φ</sub>"], [8.4, "attempt 2 · <i>π</i><sub>φ</sub> updated"], [10.7, "attempt 2 · miss"],
    [13.0, "fit <i>f</i><sub>ψ</sub> · update <i>π</i><sub>φ</sub>"], [13.4, "attempt 3 · <i>π</i><sub>φ</sub> updated again"], [16.2, "attempt 3 · grasp"],
  ];
  let slot = 0, phase = -1;
  const place = (k, jump) => {
    mover.classList.toggle("jump", !!jump);
    mover.style.left = slots[k].offsetLeft + "px";
    if (jump) requestAnimationFrame(() => mover.classList.remove("jump"));
  };
  const freeze = k => { const c = slots[k].querySelector("canvas"); try { c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); } catch (e) {} };
  const clear = () => slots.forEach(s => { const c = s.querySelector("canvas"); c.getContext("2d").clearRect(0, 0, c.width, c.height); });
  let holdTimer = 0;
  const hold = ms => { if (v.paused) return; v.pause(); clearTimeout(holdTimer); holdTimer = setTimeout(() => { v.play().catch(() => {}); }, ms); };
  const fit = () => { mover.style.width = slots[0].offsetWidth + "px"; place(slot, true); };
  window.addEventListener("resize", fit); fit();
  light(0);
  const update = () => {
    const t = v.currentTime;
    if (v.duration) {
      let k = 0; for (let i = 0; i < ATT.length; i++) if (t >= ATT[i][0]) k = i;
      if (k < slot) { clear(); slot = k; place(k, true); light(k); hold(500); }    /* the clip looped */
      else if (k > slot) { for (let i = slot; i < k; i++) freeze(i); slot = k; place(k, false); light(k); hold(1300); }   /* the move (0.8 s) + 0.5 s still, so the two actions read as one take */
      const [a, b] = ATT[k], f = Math.max(0, Math.min(1, (t - a) / (b - a)));
      if (cur && spans[k]) { if (cur.parentNode !== spans[k]) spans[k].appendChild(cur); cur.style.left = (100 * f).toFixed(2) + "%"; }
      let p = 0; for (let i = 0; i < PHASES.length; i++) if (t >= PHASES[i][0]) p = i;
      if (p !== phase) { chip.innerHTML = PHASES[p][1]; phase = p; }
    }
  };
  const step = () => { update(); requestAnimationFrame(step); };
  v.addEventListener("timeupdate", update);           /* keeps the state right while the page is hidden, where animation frames pause */
  requestAnimationFrame(step);
}
setupRun();
