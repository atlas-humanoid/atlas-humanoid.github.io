/* Scroll motion for the project page.
   - Blocks marked .rv, and each child of a .rv-kids container, rise and fade into place as they come into view; what
     comes into view together follows in reading order, a short step apart (eyebrow, heading, text, then media).
     A block that leaves through the bottom (the reader scrolled back up past it) is reset while out of sight, so it
     rises again on the way down; blocks above the screen stay shown, so scrolling up never makes content blink.
     How blocks enter is in style.css ("motion"); the opening film settles as one card, from a touch smaller.
   - The learning card (the online-RL highlight) opens out of a slight inset as it scrolls into the upper half of the
     screen: --shut on .learning-loop, 1 with its top at the bottom edge, 0 (and .is-opening dropped) once halfway up.
   - The top bar turns to frosted glass over a hairline as soon as the page is scrolled.
   Nothing is hidden unless this script sets html.motion, which it skips under prefers-reduced-motion or without
   IntersectionObserver; style.css repeats the reduced-motion guard. It is loaded in <head> so the start state is in
   place before the first paint (no flash of content that then hides); the rest waits for DOMContentLoaded. */
(function () {
  "use strict";
  var root = document.documentElement;
  var rm = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var motion = "IntersectionObserver" in window && !!root.classList && !(rm && rm.matches);
  if (motion) root.classList.add("motion");

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    try { setup(); }
    catch (err) { root.classList.remove("motion"); }   // never leave content hidden
  });

  function setup() {
    var bar = document.querySelector(".bar");
    var card = motion ? document.querySelector(".fig--retry .learning-loop") : null;

    /* 1. from the scroll position, at most once per frame: the bar state, and how far the learning card has opened */
    var stuck = null, shut = -1, queued = false;
    var update = function () {
      queued = false;
      if (bar) {
        var s = (window.pageYOffset || root.scrollTop || 0) > 4;
        if (s !== stuck) { stuck = s; bar.classList.toggle("is-stuck", s); }
      }
      if (card) {
        // p: 0 with the card's top at the bottom edge of the screen, 1 once it is halfway up; the opening eases out,
        // e = 1 - (1 - p)^2, and what is left of it is shut = 1 - e
        var vh = window.innerHeight || root.clientHeight;
        var p = Math.min(1, Math.max(0, (vh - card.getBoundingClientRect().top) / (0.5 * vh)));
        var k = Math.round((1 - p) * (1 - p) * 1000) / 1000;
        if (k !== shut) {
          shut = k;
          card.style.setProperty("--shut", String(k));
          card.classList.toggle("is-opening", k > 0);
        }
      }
    };
    var queue = function () { if (!queued) { queued = true; requestAnimationFrame(update); } };
    // the opening ends on the card's own corner radius (24 px; 20 px on narrow screens)
    var radius = function () { card.style.setProperty("--r0", getComputedStyle(card).borderTopLeftRadius); };
    if (card) radius();
    update();
    window.addEventListener("scroll", queue, { passive: true });
    if (card) {
      window.addEventListener("resize", function () { radius(); queue(); });
      window.addEventListener("load", queue);   // late fonts or images can move the card after the first update
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue, function () {});
    }

    if (!motion) return;

    /* 2. reveal */
    var items = [].slice.call(document.querySelectorAll(".rv, .rv-kids > *"));
    var STEP = 70, SPAN = 280;   // ms between blocks that arrive together; the last one starts at most SPAN ms late
    var show = function (list) {
      var n = list.length, step = n > 1 ? Math.min(STEP, SPAN / (n - 1)) : 0;
      list.forEach(function (el, k) {
        el.style.setProperty("--d", Math.round(k * step) + "ms");
        el.classList.add("in");
      });
    };
    // a block that is already above the screen (passed over by a jump) is simply put in place, without an entrance
    var place = function (el) {
      el.style.transition = "none";
      el.style.setProperty("--d", "0ms");
      el.classList.add("in");
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.removeProperty("transition"); }); });
    };
    var byDocument = function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; };
    // in: once a block is a little way into the screen. The root reaches far above the screen, so a block that a jump
    // carries from below that line to wholly above the screen (an anchor, a restored scroll position, a fast scrollbar
    // drag) also crosses into it, and is put in place instead
    var enter = new IntersectionObserver(function (entries) {
      var list = [];
      entries.forEach(function (e) {
        if (!e.isIntersecting || e.target.classList.contains("in")) return;
        if (e.boundingClientRect.bottom <= 0) place(e.target); else list.push(e.target);
      });
      if (list.length) show(list.sort(byDocument));
    }, { rootMargin: "100000px 0px -8% 0px" });
    // out of sight: a block is outside this root only when wholly below the screen, and is reset there
    var edge = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var el = e.target;
        if (!e.isIntersecting && el.classList.contains("in")) { el.classList.remove("in"); el.style.removeProperty("--d"); }
      });
    }, { rootMargin: "100000px 0px 0px 0px" });
    items.forEach(function (el) { enter.observe(el); edge.observe(el); });

    // keyboard focus inside a block that has not arrived yet brings it in at once
    document.addEventListener("focusin", function (e) {
      var el = e.target && e.target.closest ? e.target.closest(".rv, .rv-kids > *") : null;
      if (el && !el.classList.contains("in")) show([el]);
    });

    // switching reduced motion on while the page is open shows everything as it is
    if (rm) {
      var off = function () { if (rm.matches) root.classList.remove("motion"); };
      if (rm.addEventListener) rm.addEventListener("change", off); else if (rm.addListener) rm.addListener(off);
    }
  }
})();
