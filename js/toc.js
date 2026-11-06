/* "On this page": marks the section being read. Used by the project page and the blog. */
(function () {
  const nav = document.getElementById("toc");
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const items = links.map(a => ({ a, el: document.getElementById(a.getAttribute("href").slice(1)) })).filter(x => x.el);
  let current = null, queued = false;
  const update = () => {
    queued = false;
    const line = window.innerHeight * 0.3;
    let active = null;
    for (const it of items) if (it.el.getBoundingClientRect().top <= line) active = it;
    nav.classList.toggle("is-reading", !!active);
    if (active === current) return;
    if (current) { current.a.classList.remove("is-active"); current.a.removeAttribute("aria-current"); }
    if (active) { active.a.classList.add("is-active"); active.a.setAttribute("aria-current", "location"); }
    current = active;
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  update();
})();
