// Bottom-Sheet im Stil von Apple Karten
// Drei Raststufen: klein (nur Suchleiste bzw. Ortsname), mittel, voll.
// Ziehen am Griff, an der Suchleiste, am Ortsnamen oder (außer im Vollbild) an beliebiger Stelle.
// Im Vollbild scrollt der Inhalt; ganz oben nach unten ziehen schiebt das Menü wieder herunter.
import { $ } from './ui.js';

const sheet = $('sheet'), grab = $('grabber'), scroller = $('sheetBody'), head = $('sheetHead'),
  q = $('q'), side = $('side'), mapEl = $('map');
const TOP_GAP = 8;                     // Abstand zur Oberkante im Vollbild (zusätzlich zur Statusleiste)
const ORDER = ['full', 'half', 'peek']; // von oben nach unten
// Wohin das Menü fährt, wenn die Ansicht wechselt
const VIEW_STOP = { home: 'peek', search: 'full', place: 'half', route: 'half', options: 'full' };
// Wie hoch die mittlere Stufe höchstens werden darf (Anteil der Bildschirmhöhe)
const HALF_MAX = { route: 0.66 };

// Sichere Bereiche (Notch / Home-Indikator) auslesen
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
document.body.append(probe);
const safe = () => { const c = getComputedStyle(probe); return { t: parseFloat(c.paddingTop) || 0, b: parseFloat(c.paddingBottom) || 0 }; };

let H = 0;                              // Höhe des Menüs im Vollbild
let Y = { full: 0, half: 0, peek: 0 };  // Verschiebung (px von oben) je Raststufe
let stop = 'peek', saved = 'peek', y = 0, g = null, shown = false, didDrag = false;
let sideBottom = 0, bottomEdge = 0, lastView = '';

const viewNow = () => sheet.dataset.view || 'home';

function setY(v) {
  y = v;
  sheet.style.transform = 'translate3d(0,' + v + 'px,0)';
  // Kartenknöpfe ausblenden, sobald das Menü sie überdeckt
  const top = bottomEdge - H + v;
  document.body.classList.toggle('sheet-over', shown && top < sideBottom + 8);
}

function place(animate) {
  sheet.dataset.stop = stop;
  sheet.classList.toggle('anim', !!animate);
  setY(Y[stop]);
}

function measure(animate = true) {
  const first = !shown;
  shown = getComputedStyle(sheet).display !== 'none';
  if (!shown) return;

  const s = safe(), vv = window.visualViewport;
  const vh = vv ? vv.height : innerHeight;
  const gap = vv ? Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) : 0; // Tastatur
  const kbd = gap > 80;

  const view = viewNow();

  H = Math.round(vh - (kbd ? 0 : s.t) - TOP_GAP);
  bottomEdge = innerHeight - gap;
  sheet.style.setProperty('--sh', H + 'px');
  sheet.style.bottom = gap + 'px';

  // Kleine Stufe: Griff + Kopfleiste der aktuellen Ansicht
  const top = sheet.getBoundingClientRect().top;
  const peekH = Math.ceil(head.getBoundingClientRect().bottom - top + s.b + 2);

  // Mittlere Stufe: passt sich dem Inhalt an (zwischen 38 % und 56/66 % der Bildschirmhöhe)
  let contentBottom = 0;
  Array.from(scroller.children).forEach(el => {
    if (el.offsetHeight > 0) contentBottom = Math.max(contentBottom, el.getBoundingClientRect().bottom - top + scroller.scrollTop);
  });
  const contentH = contentBottom + 22 + s.b;
  let halfH = Math.min(Math.max(contentH, vh * 0.38), vh * (HALF_MAX[view] || 0.56));
  halfH = Math.max(halfH, peekH + 90);
  halfH = Math.min(halfH, H - 60);
  if (halfH < peekH + 40) halfH = (peekH + H) / 2;

  Y = { full: 0, half: Math.round(H - halfH), peek: Math.round(H - peekH) };
  sideBottom = side.getBoundingClientRect().bottom;

  if (first) {
    stop = VIEW_STOP[view] || 'peek';
    lastView = view;
    animate = false;
  } else if (view !== lastView) {
    const prev = lastView;
    lastView = view;
    scroller.scrollTop = 0;
    if (!g) {
      if (view === 'search' && stop !== 'full') saved = stop;
      if (view === 'home' && prev === 'search') stop = saved === 'full' ? 'peek' : saved;
      else stop = VIEW_STOP[view] || 'peek';
    }
  }
  if (!g) place(animate);
}

// ---------- Ziehen ----------
function start(cx, cy, target) {
  if (!shown) return;
  // laufende Animation anhalten und aktuelle Position übernehmen
  if (sheet.classList.contains('anim')) {
    try { y = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42; } catch {}
    sheet.classList.remove('anim');
    setY(y);
  }
  if (target.closest && target.closest('input[type=range], .nodrag')) { g = null; return; }   // Regler bleiben bedienbar
  const onHead = grab.contains(target) || head.contains(target);
  g = { x0: cx, y0: cy, yStart: y, mode: onHead ? 'drag' : null, head: onHead, horiz: false, lastY: cy, startStop: stop, samples: [{ t: performance.now(), y: cy }] };
  didDrag = false;
}

function move(cx, cy, e) {
  if (!g) return;
  const dy = cy - g.y0, dx = cx - g.x0;

  if (g.mode === null) {
    if (Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
    if (Math.abs(dx) > Math.abs(dy)) { g.mode = 'native'; g.horiz = true; return; }  // z. B. Chips seitlich wischen
    if (stop !== 'full') g.mode = 'drag';
    else if (scroller.scrollTop <= 0 && dy > 0) g.mode = 'drag';
    else g.mode = 'native';
    if (g.mode === 'drag') { g.y0 = cy; g.yStart = y; }
  }

  if (g.mode === 'native') {
    // Im Vollbild ganz oben und weiter nach unten gezogen: Menü mitnehmen
    if (!g.horiz && stop === 'full' && scroller.scrollTop <= 0 && cy > g.lastY && e && e.cancelable) {
      g.mode = 'drag'; g.y0 = cy; g.yStart = y; g.samples = [];
    } else { g.lastY = cy; return; }
  }

  if (e && e.cancelable) e.preventDefault();
  if (!didDrag && dy > 0 && document.activeElement === q) q.blur();   // Tastatur wegwischen
  didDrag = true;
  g.lastY = cy;

  let ny = g.yStart + (cy - g.y0);
  if (ny < 0) ny = 0;
  else if (ny > Y.peek) ny = Y.peek + Math.min(60, (ny - Y.peek) * 0.3);   // sanfter Widerstand ganz unten
  setY(ny);
  g.samples.push({ t: performance.now(), y: cy });
  if (g.samples.length > 12) g.samples.shift();
}

function end() {
  if (!g) return;
  const d = g;
  g = null;
  if (d.mode !== 'drag') return;

  // Wischgeschwindigkeit der letzten ~120 ms
  const now = performance.now();
  const sm = d.samples.filter(p => now - p.t < 120);
  let v = 0;
  if (sm.length >= 2) {
    const a = sm[0], b = sm[sm.length - 1];
    if (b.t > a.t) v = (b.y - a.y) / (b.t - a.t);   // px/ms, positiv = nach unten
  }
  const proj = y + v * 180;                         // wohin das Menü ausrollen würde
  let best = ORDER.reduce((a, n) => Math.abs(Y[n] - proj) < Math.abs(Y[a] - proj) ? n : a, ORDER[0]);
  if (best === d.startStop && Math.abs(v) > 0.35) {  // kurzer, schneller Wisch = nächste Stufe
    const i = ORDER.indexOf(d.startStop);
    best = ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (v < 0 ? -1 : 1)))];
  }
  stop = best;
  if (stop !== 'full' && document.activeElement === q) q.blur();
  place(true);
}

sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, e.target); else g = null; }, { passive: true });
sheet.addEventListener('touchmove', e => { if (g && e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
sheet.addEventListener('touchend', end);
sheet.addEventListener('touchcancel', end);

// Maus (Test am Rechner)
sheet.addEventListener('mousedown', e => {
  if (e.button !== 0 || e.target.closest('input,button,a,.nodrag')) return;
  start(e.clientX, e.clientY, e.target);
});
window.addEventListener('mousemove', e => { if (g) move(e.clientX, e.clientY, e); });
window.addEventListener('mouseup', end);

// Antippen des Griffs: nächste Stufe (klein → mittel → voll → mittel)
grab.addEventListener('click', () => {
  if (didDrag) { didDrag = false; return; }
  const i = ORDER.indexOf(stop);
  sheetApi.snap(i === 2 ? 'half' : i === 1 ? 'full' : 'half');
});

// ---------- Suche & Tastatur ----------
// Fokus in der Suche: Menü ganz hochziehen (die Ansicht wechselt map.js auf "search")
q.addEventListener('focus', () => {
  if (stop !== 'full') { saved = stop; stop = 'full'; place(true); }
});
// Auf die Karte tippen schließt die Tastatur
mapEl.addEventListener('touchstart', () => { if (document.activeElement === q) q.blur(); }, { passive: true });

// ---------- Änderungen beobachten ----------
let raf = 0, noAnim = false;
const queue = (anim = true) => {
  if (!anim) noAnim = true;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { const a = !noAnim; noAnim = false; measure(a); });
};
const mo = new MutationObserver(() => queue());
mo.observe(scroller, { childList: true, subtree: true, characterData: true });
mo.observe(sheet, { attributes: true, attributeFilter: ['data-view'] });
mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
// Falls die Ansicht gleich bleibt, der Inhalt aber wächst oder schrumpft, wird die mittlere Stufe neu berechnet
window.addEventListener('resize', () => queue(false));
window.addEventListener('orientationchange', () => queue(false));
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => queue(false));
  visualViewport.addEventListener('scroll', () => queue(false));
}

export const sheetApi = {
  snap(name, animate = true) {
    if (!shown || !(name in Y)) return;
    stop = name;
    place(animate);
  },
  get stop() { return stop; },
  visible() { return shown ? Math.max(0, H - y) : 0; }
};

measure(false);
