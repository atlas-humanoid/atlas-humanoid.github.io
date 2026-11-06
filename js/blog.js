/* Blog: videos play while on screen; a citation shows its reference on hover or focus; margin notes never overlap; copy buttons. */
(function () {
  /* videos */
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const videos = [...document.querySelectorAll("video[data-inview]")];
  const start = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  if (reduced || !("IntersectionObserver" in window)) {
    videos.forEach(v => { v.removeAttribute("loop"); v.controls = true; });
  } else {
    const once = new WeakSet();
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      const v = e.target;
      if (!e.isIntersecting) { if (!v.paused && !v.ended) v.pause(); return; }
      if (v.hasAttribute("data-once")) { if (!once.has(v)) { once.add(v); start(v); } return; }
      start(v);
    }), { threshold: 0.4 });
    videos.forEach(v => {
      io.observe(v);
      if (!v.controls) v.addEventListener("click", () => (v.paused ? start(v) : v.pause()));
    });
  }

  /* citations */
  const pop = document.getElementById("cite-pop");
  if (pop) {
    const show = a => {
      const li = document.querySelector(a.getAttribute("href"));
      if (!li) return;
      pop.textContent = li.textContent;
      pop.hidden = false;
      const r = a.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      const x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 12);
      const above = r.top - h - 8 > 64;
      pop.style.left = x + window.scrollX + "px";
      pop.style.top = (above ? r.top - h - 8 : r.bottom + 8) + window.scrollY + "px";
    };
    const hide = () => { pop.hidden = true; };
    document.querySelectorAll("a.cite").forEach(a => {
      a.addEventListener("mouseenter", () => show(a));
      a.addEventListener("mouseleave", hide);
      a.addEventListener("focus", () => show(a));
      a.addEventListener("blur", hide);
      a.addEventListener("click", () => {          /* the list is folded until a citation points into it */
        const list = document.querySelector(".post-fold--refs");
        if (list) list.open = true;
        hide();
      });
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
  }

  /* margin notes: each starts on its citation's line and moves down only as far as it must */
  const stack = () => {
    document.querySelectorAll(".post-sec__body").forEach(body => {
      let bottom = -Infinity;
      const base = body.getBoundingClientRect().top;
      body.querySelectorAll(".side").forEach(n => {
        n.style.marginTop = "";
        if (getComputedStyle(n).display === "none") return;
        const top = n.getBoundingClientRect().top - base;
        const push = Math.max(0, bottom + 6 - top);
        n.style.marginTop = push + "px";
        bottom = top + push + n.offsetHeight;
      });
    });
  };
  stack();
  window.addEventListener("resize", stack);
  window.addEventListener("load", stack);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(stack);

  /* copy */
  const copy = (btn, text) => {
    const done = () => { const old = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = old; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
  };
  document.querySelectorAll("[data-copy-url]").forEach(b => b.addEventListener("click", () => copy(b, b.dataset.copyUrl)));
  document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
    const el = document.querySelector(b.dataset.copy);
    if (el) copy(b, el.textContent);
  }));
})();
