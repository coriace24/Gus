/* grammar-scroll.js — scroll preservation for the FLE/ESL grammar-map pages.
   Saves the scroll position per page in sessionStorage and restores it on the
   next full load (refresh, or the lx-build auto-reload after a deploy), so the
   reader returns to where they were instead of being thrown back to the top.
   First visits in a session have no saved value and start at the top as before. */
(function () {
  var KEY = 'gramscroll:' + location.pathname;

  function save() {
    try { sessionStorage.setItem(KEY, String(window.scrollY || window.pageYOffset || 0)); } catch (e) {}
  }

  if ('scrollRestoration' in history) { try { history.scrollRestoration = 'manual'; } catch (e) {} }

  var t = null;
  window.addEventListener('scroll', function () {
    if (t) return;
    t = setTimeout(function () { t = null; save(); }, 150);
  }, { passive: true });
  window.addEventListener('pagehide', save);

  window.addEventListener('load', function () {
    var y = 0;
    try { y = parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0; } catch (e) {}
    if (y > 0) window.scrollTo(0, y);
  });
})();
