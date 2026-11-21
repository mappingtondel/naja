import { STYLES, PAL, POI, ROUTE, ME, styleOf, drawIcon } from './styles.js';
import { dist, project, calculateRoute, searchPhoton, reversePhoton, queryOverpass } from './routing.js';
import './sheet.js';
import { $, IC, turnSvg, toast, el, getFavorites, isFavorite, toggleFavorite, getHistory, addHistory, clearHistory, initNetworkMonitor, getSaved, setSaved, getOpts, setOpts, optCount, DEFAULT_OPTS, unlockAudio, sfx } from './ui.js';

if (typeof maplibregl === "undefined") {
  toast("Kartenbibliothek konnte nicht geladen werden – bitte online neu laden");
  throw new Error("MapLibre GL fehlt");
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

initNetworkMonitor();

$("styleBtn").innerHTML = IC.layers;
$("locBtn").innerHTML = IC.loc;
$("compassBtn").innerHTML = IC.compass;
$("ovBtn").innerHTML = IC.route;

let si = 0;
let rawMe = null, smoothMe = null;
let hdg = 0, first = true, follow = true, nav = false;
let dest = null, destMarker = null;
let waypoints = [], wpMarkers = [];
let shape = [], cum = [], man = [], tripTime = 0, routeGeo = null, lastIdx = 0, spoke = {}, lastReroute = 0, wakeLock = null;
const RAD = Math.PI / 180;
// Platz, den das Menü in der mittleren Stufe einnimmt – die Karte wird darüber zentriert
const sheetPad = () => Math.round(window.innerHeight * (view() === "route" ? 0.52 : 0.4));
const NO_PAD = { top: 0, bottom: 0, left: 0, right: 0 };
const EMPTY = { type: "FeatureCollection", features: [] };
let routes = [], routeIdx = 0, altGeo = null, busyN = 0;
let sim = null, simTimer = null, simKmh = 50;
let limitKmh = null, limitT = 0, limitBusy = false, limitMiss = 0, spokePost = {};
const setBusy = on => { busyN = Math.max(0, busyN + (on ? 1 : -1)); document.body.classList.toggle("busy", busyN > 0); };
const beep = name => { if (voice) sfx(name); };
let onRoute = false;
let speed = 0, acc = 0, compassOn = false, lastCam = 0, progress = 0, routeSeq = 0, searchSeq = 0, lastGeoErr = 0, meAdded = false;

const map = new maplibregl.Map({
  container: "map",
  style: styleOf(0),
  center: [10.4, 51.1],
  zoom: 5,
  maxPitch: 70,
  attributionControl: false
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left");
// Ladebildschirm ausblenden (spätestens nach 7 s, falls offline)
map.once("load", () => document.body.classList.add("ready"));
setTimeout(() => document.body.classList.add("ready"), 7000);

// Routen-Layer zuverlässig bei jedem Laden / Stilwechsel aufbauen
map.on("style.load", () => {
  addRoute();
  if (routeGeo && map.getSource("route")) {
    map.getSource("route").setData(routeGeo);
  }
});

map.on("styleimagemissing", e => {
  const [, g, k] = e.id.split("-");
  if (POI[g] && PAL[k]) {
    const c = drawIcon(g, k);
    map.addImage(e.id, c.getContext("2d").getImageData(0, 0, 64, 64), { pixelRatio: 2 });
  }
});

let lastErr = 0;
map.on("error", e => {
  if (Date.now() - lastErr > 6000) {
    lastErr = Date.now();
    if (!navigator.onLine) return;
    toast("Kartenfehler: " + ((e.error && e.error.message) || "unbekannt"));
  }
});

map.on("dragstart", () => { follow = false; updateCompassBtn(); });
map.on("rotate", updateCompassBtn);
map.on("pitch", updateCompassBtn);

// Fix für mobile Tastatur: verhindert Hängenbleiben des Viewports nach Schließen der Tastatur
window.addEventListener("scroll", () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }
});
$("q").addEventListener("blur", () => {
  setTimeout(() => {
    window.scrollTo(0, 0);
    map.resize();
  }, 150);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    window.scrollTo(0, 0);
    map.resize();
  });
}
["orientationchange", "pageshow", "resize"].forEach(ev => window.addEventListener(ev, () => setTimeout(() => map.resize(), 200)));

// Hintergrund und Browserleiste in der Farbe der Karte halten, damit unten kein grauer Streifen sichtbar ist
function applyChrome() {
  const bg = PAL[STYLES[si][1]].bg;
  document.documentElement.style.background = bg;
  document.body.style.background = bg;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", bg);
}
applyChrome();

function updateCompassBtn() {
  const btn = $("compassBtn");
  if (btn.firstElementChild) btn.firstElementChild.style.transform = "rotate(" + (-map.getBearing()) + "deg)";
  const rotated = Math.abs(map.getBearing()) > 2 || map.getPitch() > 2;
  if (rotated || (nav && !follow)) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
}

$("compassBtn").onclick = () => {
  if (nav) {
    follow = true;
    camera(true);
  } else {
    map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }
  updateCompassBtn();
};

const KIND = {
  restaurant:"Restaurant",fast_food:"Imbiss",food_court:"Food Court",ice_cream:"Eisdiele",biergarten:"Biergarten",bakery:"Bäckerei",cafe:"Café",bar:"Bar",pub:"Kneipe",nightclub:"Nachtclub",
  fitness_centre:"Fitnessstudio",sports_centre:"Sportzentrum",gym:"Fitnessstudio",stadium:"Stadion",swimming_pool:"Schwimmbad",townhall:"Rathaus",courthouse:"Gericht",hospital:"Krankenhaus",
  clinic:"Klinik",doctors:"Arzt",pharmacy:"Apotheke",dentist:"Zahnarzt",school:"Schule",kindergarten:"Kindergarten",college:"Hochschule",university:"Universität",library:"Bibliothek",
  supermarket:"Supermarkt",grocery:"Lebensmittel",convenience:"Kiosk",department_store:"Kaufhaus",mall:"Einkaufszentrum",clothing_store:"Modegeschäft",fuel:"Tankstelle",
  charging_station:"Ladestation",hotel:"Hotel",hostel:"Hostel",motel:"Motel",guest_house:"Pension",parking:"Parkplatz",bank:"Bank",atm:"Geldautomat",post_office:"Post",police:"Polizei",
  fire_station:"Feuerwehr",museum:"Museum",cinema:"Kino",theatre:"Theater",castle:"Schloss",zoo:"Zoo",attraction:"Sehenswürdigkeit",pitch:"Sportplatz",swimming:"Schwimmbad",town_hall:"Rathaus",lodging:"Unterkunft",post:"Post",gymnasium:"Sporthalle"
};
const kindOf = p => KIND[p.subclass] || KIND[p.class] || String(p.subclass || p.class || "").replace(/_/g, " ");

map.on("click", e => {
  if (nav || view() === "options") return;
  if (searchMode === "waypoint") {
    addWaypoint({ name: "Gewählter Stopp", lngLat: [e.lngLat.lng, e.lngLat.lat] });
    closeSearch();
    return;
  }
  if (searchMode === "assign") return;
  if (routes.length > 1 && map.getLayer("route-alt")) {
    const hit = map.queryRenderedFeatures([[e.point.x - 14, e.point.y - 14], [e.point.x + 14, e.point.y + 14]], { layers: ["route-alt"] })[0];
    if (hit) { applyRoute(hit.properties.i); return; }
  }
  if (view() === "route") return;   // in der Routenansicht keine Zielwahl per Karte (Route soll nicht versehentlich verloren gehen)
  const r = 12, box = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
  const ids = Object.keys(POI).map(g => "poi_" + g).filter(id => map.getLayer(id));
  const f = ids.length ? map.queryRenderedFeatures(box, { layers: ids }).find(f => f.properties.name_de || f.properties.name) : null;
  if (f) {
    const p = f.properties, c = f.geometry.type === "Point" ? f.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
    pick({ name: p.name_de || p.name, lngLat: c, sub: kindOf(p), place: true }, false);
    return;
  }
  pick({ name: "Gewählter Punkt", lngLat: [e.lngLat.lng, e.lngLat.lat] }, false);
});

const meEl = document.createElement("div");
meEl.className = "me";
const setMe = () => { meEl.innerHTML = ME[STYLES[si][1]]; };
setMe();
const meMarker = new maplibregl.Marker({ element: meEl, rotationAlignment: "map", pitchAlignment: "map" });

function animateMarker() {
  if (rawMe && smoothMe) {
    const d = dist(smoothMe, rawMe);
    if (d > 100 || d < 0.15) {
      smoothMe = [...rawMe];
    } else {
      smoothMe[0] += (rawMe[0] - smoothMe[0]) * 0.22;
      smoothMe[1] += (rawMe[1] - smoothMe[1]) * 0.22;
    }
    meMarker.setLngLat(smoothMe);
  }
  requestAnimationFrame(animateMarker);
}
requestAnimationFrame(animateMarker);

$("styleBtn").onclick = () => {
  si = (si + 1) % STYLES.length;
  map.setStyle(styleOf(si), { diff: false });
  applyChrome();
  setMe();
  toast(STYLES[si][0]);
  beep("tick");
  if (destMarker) {
    const ll = destMarker.getLngLat();
    destMarker.remove();
    destMarker = makeDest(ll);
  }
};

function makeDest(ll) {
  return new maplibregl.Marker({ color: STYLES[si][2] }).setLngLat(ll).addTo(map);
}

$("locBtn").onclick = () => {
  initCompass();
  follow = true;
  updateCompassBtn();
  if (nav) camera(true);
  else if (smoothMe) {
    map.easeTo({ center: smoothMe, zoom: Math.max(map.getZoom(), 15) });
  }
};

$("ovBtn").onclick = () => {
  if (!nav || !shape.length) return;
  if (follow) {
    follow = false;
    updateCompassBtn();
    const pts = shape.slice(lastIdx);
    if (!pts.length) return;
    const b = pts.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(pts[0], pts[0]));
    if (smoothMe) b.extend(smoothMe);
    const h = map.getContainer().clientHeight, pt = Math.min(230, h * 0.3), pb = Math.min(220, h * 0.28);
    map.fitBounds(b, { padding: { top: pt, bottom: pb, left: 40, right: 40 }, pitch: 0, bearing: 0, duration: 700 });
  } else {
    follow = true;
    updateCompassBtn();
    camera(true);
  }
};

$("banner").onclick = () => $("banner").classList.toggle("min");
$("stopBtn").onclick = () => stopNav();

let voice = true;
try { voice = localStorage.getItem("voice") !== "0"; } catch {}
const setVoiceIcon = () => { $("voiceBtn").innerHTML = voice ? IC.voice : IC.mute; };
setVoiceIcon();
$("voiceBtn").onclick = () => {
  voice = !voice;
  setVoiceIcon();
  try { localStorage.setItem("voice", voice ? "1" : "0"); } catch {}
  if (!voice && window.speechSynthesis) speechSynthesis.cancel();
  unlockAudio();
  toast(voice ? "Ansagen und Töne an" : "Ansagen und Töne aus");
  beep("tick");
};
document.addEventListener("click", unlockAudio);

// Ankunft teilen
$("shareBtn").onclick = async () => {
  if (!dest) return;
  const text = "Ich komme voraussichtlich um " + $("eta").textContent + " Uhr bei " + dest.name + " an.";
  const url = gmaps(dest);
  try {
    if (navigator.share) await navigator.share({ title: "Ankunft", text, url });
    else { await navigator.clipboard.writeText(text + " " + url); toast("Text kopiert"); }
  } catch {}
};

// Tempo der Simulation ändern
$("speedTile").onclick = () => {
  if (!sim) return;
  const L = [30, 50, 90, 130];
  simKmh = L[(L.indexOf(simKmh) + 1) % L.length];
  toast("Simulation: " + simKmh + " km/h");
};

/* ---------- Standort & Kompass ---------- */
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(onPos, e => {
    if (Date.now() - lastGeoErr > 15000) {
      lastGeoErr = Date.now();
      toast(e.code === 1 ? "Standortzugriff nicht erlaubt" : "GPS-Signal schwach");
    }
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
} else {
  toast("Standort wird nicht unterstützt");
}

const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
function setHeading(h) {
  const d = angDiff(h, hdg);
  if (Math.abs(d) < 1.5) return;
  hdg = (hdg + d * 0.4 + 360) % 360;
  meMarker.setRotation(hdg);
}

function onOri(e) {
  let h = null;
  if (e.webkitCompassHeading != null && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;
  else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;
  if (h == null || speed > 2) return;
  setHeading(h);
  if (nav && follow && Date.now() - lastCam > 600) {
    lastCam = Date.now();
    camera();
  }
}

function initCompass() {
  if (compassOn) return;
  const go = () => {
    compassOn = true;
    window.addEventListener("deviceorientationabsolute", onOri, true);
    window.addEventListener("deviceorientation", onOri, true);
  };
  const DO = window.DeviceOrientationEvent;
  if (DO && typeof DO.requestPermission === "function") {
    DO.requestPermission().then(r => { if (r === "granted") go(); else toast("Kompass nicht erlaubt"); }).catch(() => {});
  } else if (DO) go();
}
document.addEventListener("click", initCompass, { once: true });

function onPos(p) {
  if (!sim) handlePos(p);
}

function handlePos(p) {
  const c = p.coords;
  rawMe = [c.longitude, c.latitude];
  if (!smoothMe) smoothMe = [...rawMe];

  acc = c.accuracy || 0;
  speed = c.speed > 0 ? c.speed : 0;
  const kmh = Math.round(speed * 3.6);
  const spdEl = $("speedVal");
  if (spdEl) spdEl.textContent = kmh;

  if (c.heading != null && !isNaN(c.heading) && speed > (compassOn ? 2 : 1)) setHeading(c.heading);
  meMarker.setLngLat(smoothMe).setRotation(hdg);
  if (!meAdded) { meMarker.addTo(map); meAdded = true; }

  if (first) {
    first = false;
    map.jumpTo({ center: smoothMe, zoom: 15 });
    if (view() === "home") renderHome();
  }
  if (follow) camera();
  if (nav) navStep();
}

function camera(resetZoom) {
  const ctr = rawMe || smoothMe;
  if (!ctr) return;
  map.easeTo({
    center: ctr,
    bearing: nav ? hdg : map.getBearing(),
    zoom: nav && resetZoom ? 16.5 : map.getZoom(),
    pitch: nav ? 60 : map.getPitch(),
    padding: { top: nav ? 260 : 0, bottom: 0, left: 0, right: 0 },
    duration: 900
  });
}

/* ---------- Menü: Ansichten (Start · Suche · Ort · Route · Optionen) ---------- */
const sheetEl = $("sheet"), qEl = $("q");
const view = () => sheetEl.dataset.view;
const setView = v => { sheetEl.dataset.view = v; };
let prevView = "home";          // Ansicht, in die die Suche zurückkehrt
let searchMode = "dest";        // "dest" | "waypoint" | "assign"
let assignKey = null;           // "home" | "work" beim Festlegen von Zuhause/Arbeit
let routeState = "idle";        // "loading" | "ready" | "error"
let optDraft = null;            // Arbeitskopie der Routenoptionen

$("qIcon").innerHTML = IC.search;
$("qClear").innerHTML = IC.close;
$("qClose").innerHTML = IC.close;
$("placeClose").innerHTML = IC.close;
$("routeShare").innerHTML = IC.share;
$("routeClose").innerHTML = IC.close;
$("optCancel").innerHTML = IC.close;
$("optOk").innerHTML = IC.check;

// kleine Bausteine
const fmtAir = m => (m < 950 ? Math.max(10, Math.round(m / 10) * 10) + " m" : (m < 10000 ? (m / 1000).toFixed(1).replace(".", ",") : String(Math.round(m / 1000))) + " km");
const distFromMe = ll => (rawMe && ll ? fmtAir(dist(rawMe, ll)) : "");
const note = t => el("div", "note", t);
function ico(ic, col) {
  const e = el("span", "ico" + (col ? " " + col : ""));
  e.innerHTML = IC[ic] || IC.pin;
  return e;
}
// Listenzeile: mit onclick ein Knopf, sonst reine Anzeige
function lrow({ ic, col, title, sub, onclick, cls }) {
  const b = el(onclick ? "button" : "div", "lrow" + (cls ? " " + cls : ""));
  if (ic) b.append(ico(ic, col));
  const t = el("div", "t");
  t.append(el("b", null, title));
  if (sub) t.append(el("small", null, sub));
  b.append(t);
  if (onclick) b.onclick = onclick;
  return b;
}
function switchRow(ic, col, title, sub, checked, onchange) {
  const r = el("div", "srow" + (ic ? "" : " noic"));
  if (ic) r.append(ico(ic, col));
  const t = el("div", "t");
  t.append(el("b", null, title));
  if (sub) t.append(el("small", null, sub));
  r.append(t);
  const lab = el("label", "sw"), inp = document.createElement("input");
  inp.type = "checkbox";
  inp.checked = !!checked;
  inp.onchange = () => onchange(inp.checked);
  lab.append(inp, el("i"));
  r.append(lab);
  return r;
}

/* ---------- Start: Orte & Zuletzt ---------- */
function renderHome() {
  const box = $("homePlaces");
  box.innerHTML = "";
  const sec = el("div", "sec");
  sec.append(el("h4", null, "Orte"));
  const row = el("div", "tiles");
  [["home", "Zuhause", "home", "teal"], ["work", "Arbeit", "work", "blue"]].forEach(([k, label, ic, col]) => {
    const v = getSaved(k), b = el("button", "tile");
    b.append(ico(ic, col), el("b", null, label));
    if (v) {
      b.append(el("small", null, distFromMe(v.lngLat) || "gespeichert"));
      b.onclick = () => handlePlaceSelection(getSaved(k) || v, true);
    } else {
      b.append(el("small", "add", "Hinzufügen"));
      b.onclick = () => startAssign(k, label);
    }
    row.append(b);
  });
  getFavorites().forEach(f => {
    const b = el("button", "tile");
    b.append(ico(f.ic || "pin", f.col || "red"), el("b", null, f.name), el("small", null, distFromMe(f.lngLat) || "Favorit"));
    b.onclick = () => handlePlaceSelection(f, true);
    row.append(b);
  });
  sec.append(row);
  box.append(sec);
  renderRecent($("homeRecent"));
}

function renderRecent(box) {
  box.innerHTML = "";
  const hist = getHistory();
  if (!hist.length) return;
  const sec = el("div", "sec"), h = el("h4", null, "Zuletzt"), clr = el("button", null, "Löschen");
  clr.onclick = () => { clearHistory(); renderHome(); if (view() === "search") renderSearch(); };
  h.append(clr);
  sec.append(h);
  const card = el("div", "card");
  hist.slice(0, 5).forEach(p => card.append(lrow({
    ic: p.ic || "pin", col: p.col || "red", title: p.name,
    sub: [distFromMe(p.lngLat), p.sub || p.area].filter(Boolean).join(" · "),
    onclick: () => handlePlaceSelection(p, true)
  })));
  sec.append(card);
  box.append(sec);
}

/* ---------- Suche ---------- */
let timer;
const updateQUi = () => {
  $("qClear").hidden = !qEl.value.length;
  $("qClose").hidden = view() !== "search";
};

function enterSearch() {
  if (view() === "search") return;
  prevView = view();
  setView("search");
  renderSearch();
  updateQUi();
}
qEl.addEventListener("focus", enterSearch);
qEl.addEventListener("input", () => {
  updateQUi();
  clearTimeout(timer);
  if (qEl.value.trim().length < 2) { searchSeq++; renderSearch(true); return; }
  timer = setTimeout(search, 260);
});
qEl.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  clearTimeout(timer);
  qEl.blur();                 // Tastatur schließen, Treffer bleiben stehen
  search();
});
qEl.addEventListener("blur", () => setTimeout(() => {
  // leere Suche + Tastatur zu: zurück zum Start
  if (view() === "search" && searchMode === "dest" && !qEl.value.trim() && document.activeElement !== qEl) closeSearch();
}, 160));
$("qClear").onclick = () => {
  qEl.value = "";
  searchSeq++;
  updateQUi();
  renderSearch(true);
  qEl.focus();
};
$("qClose").onclick = () => closeSearch();

function closeSearch() {
  searchSeq++;
  clearTimeout(timer);
  qEl.value = "";
  qEl.blur();
  searchMode = "dest";
  assignKey = null;
  qEl.placeholder = "Suche nach Orten";
  const back = prevView === "search" ? "home" : prevView;
  setView(back);
  if (back === "home") renderHome();
  updateQUi();
}

function startWaypointSearch() {
  searchMode = "waypoint";
  prevView = "route";
  qEl.value = "";
  qEl.placeholder = "Zwischenstopp suchen …";
  setView("search");
  renderSearch();
  updateQUi();
  qEl.focus();
}

function startAssign(key, label) {
  searchMode = "assign";
  assignKey = key;
  prevView = "home";
  qEl.value = "";
  qEl.placeholder = label + " suchen …";
  setView("search");
  renderSearch();
  updateQUi();
  qEl.focus();
}

function handlePlaceSelection(p, fly) {
  if (searchMode === "waypoint") {
    addWaypoint(p);
    closeSearch();
  } else if (searchMode === "assign") {
    setSaved(assignKey, p);
    toast((assignKey === "home" ? "Zuhause" : "Arbeit") + " gespeichert");
    closeSearch();
  } else {
    pick(p, fly);
  }
}

// Zustand ohne Eingabe: zuletzt gesuchte Orte bzw. ein Hinweis
function renderSearch(force) {
  const box = $("results");
  if (!force && qEl.value.trim().length >= 2) return;
  box.innerHTML = "";
  if (searchMode === "waypoint") box.append(el("div", "hint", "Ort suchen oder direkt auf die Karte tippen, um einen Zwischenstopp zu setzen."));
  const hist = getHistory();
  if (hist.length) {
    const wrap = el("div");
    renderRecent(wrap);
    box.append(wrap);
  } else if (searchMode !== "waypoint") {
    box.append(note("Ort, Adresse oder Straße eingeben"));
  }
}

// Symbol und Farbe je nach Art des Treffers
function iconFor(p) {
  const k = p.osm_key, v = p.osm_value;
  if (k === "place") return (v === "country" || v === "state" || v === "region") ? ["flag", ""] : ["city", ""];
  if (k === "boundary") return ["flag", ""];
  if (k === "railway" || k === "public_transport" || v === "bus_station" || v === "station") return ["train", "blue"];
  if (k === "highway") return ["road", ""];
  if (k === "shop") return ["shop", "orange"];
  if (k === "amenity" && /^(restaurant|cafe|fast_food|bar|pub|biergarten|ice_cream|food_court)$/.test(v)) return ["food", "orange"];
  if (k === "amenity" && /^(fuel|charging_station)$/.test(v)) return ["fuel", "green"];
  return ["pin", "red"];
}

async function search() {
  const s = qEl.value.trim(), box = $("results"), my = ++searchSeq;
  if (s.length < 2) { renderSearch(true); return; }
  if (!navigator.onLine) { box.innerHTML = ""; box.append(note("Offline – Suche nicht möglich")); return; }
  if (!box.querySelector(".card")) { box.innerHTML = ""; box.append(note("Suche …")); }
  try {
    const c = map.getCenter(), bias = rawMe || [c.lng, c.lat];
    const features = await searchPhoton(s, bias);
    if (my !== searchSeq) return;
    const seen = new Set(), items = [];
    features.forEach(f => {
      const p = f.properties, street = [p.street, p.housenumber].filter(Boolean).join(" ");
      const name = p.name || street;
      if (!name) return;
      const key = name + "|" + f.geometry.coordinates.map(n => n.toFixed(3)).join(",");
      if (seen.has(key)) return;
      seen.add(key);
      const city = p.city || p.town || p.village || p.locality || p.district;
      const kind = KIND[p.osm_value] || "";
      const sub = [kind, p.name ? street : "", city && city !== name ? city : "", p.state, p.country].filter(Boolean).join(", ");
      const place = !!p.name && !["highway", "place", "boundary", "waterway"].includes(p.osm_key);
      const area = [[p.postcode, city].filter(Boolean).join(" "), p.state, p.country].filter(Boolean).join(", ");
      const [ic, col] = iconFor(p);
      items.push({ name, lngLat: f.geometry.coordinates, sub, place, addr: p.name ? street : "", area, osm: { t: p.osm_type, id: p.osm_id }, ic, col });
    });
    box.innerHTML = "";
    if (!items.length) { box.append(note("Keine Treffer für „" + s + "“")); return; }
    const card = el("div", "card");
    items.forEach(it => card.append(lrow({
      ic: it.ic, col: it.col, title: it.name,
      sub: [distFromMe(it.lngLat), it.sub].filter(Boolean).join(" · "),
      onclick: () => handlePlaceSelection(it, true)
    })));
    box.append(card);
  } catch {
    if (my === searchSeq) { box.innerHTML = ""; box.append(note("Suche nicht erreichbar")); }
  }
}

function clearRoute() {
  routeGeo = null;
  altGeo = null;
  routes = [];
  routeIdx = 0;
  shape = []; man = []; cum = [];
  map.getSource("route")?.setData(EMPTY);
  map.getSource("route-alt")?.setData(EMPTY);
}

/* ---------- Ort ---------- */
function pick(d, fly) {
  dest = d;
  waypoints = [];
  clearWaypointMarkers();
  clearRoute();
  routeSeq++;
  routeState = "idle";
  searchSeq++;
  searchMode = "dest";
  assignKey = null;
  qEl.value = "";
  qEl.blur();
  qEl.placeholder = "Suche nach Orten";
  follow = false;
  updateCompassBtn();
  if (destMarker) destMarker.remove();
  destMarker = makeDest(d.lngLat);
  if (fly) map.flyTo({ center: d.lngLat, zoom: 15, padding: { top: 0, bottom: sheetPad(), left: 0, right: 0 } });
  if (d.place) enrich(d);
  locate(d).then(() => { if (dest === d && view() === "place") renderPlaceBody(d); });
  addHistory(d);
  renderHome();
  renderPlace(d);
}

function addWaypoint(wp) {
  waypoints.push(wp);
  const m = new maplibregl.Marker({ color: "#ffffff", scale: 0.75 }).setLngLat(wp.lngLat).addTo(map);
  wpMarkers.push(m);
  toast("Zwischenstopp: " + wp.name);
  planRoute();
}

function clearWaypointMarkers() {
  wpMarkers.forEach(m => m.remove());
  wpMarkers = [];
}

const ext = u => window.open(u, "_blank", "noopener");
const where = d => [d.addr, d.area].filter(Boolean).join(", ");
function gmaps(d) {
  const w = where(d);
  const q = w ? d.name + ", " + w : d.lngLat[1] + "," + d.lngLat[0];
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}
function openWeb(d) {
  if (d.web) return ext(d.web);
  ext("https://www.google.com/search?hl=de&q=" + encodeURIComponent([d.name, where(d)].filter(Boolean).join(" ")));
}

async function locate(d) {
  if (d.area) return;
  const area = await reversePhoton(d.lngLat);
  if (area) d.area = area;
}

function renderPlace(d) {
  setView("place");
  updateQUi();
  renderPlaceBody(d);
}

function renderPlaceBody(d) {
  $("cTitle").textContent = d.name;
  $("cSub").textContent = [d.sub, distFromMe(d.lngLat)].filter(Boolean).join(" · ") || where(d) || "";

  // Aktionen
  const acts = $("placeActions");
  acts.innerHTML = "";
  const row = el("div", "acts");
  const mk = (label, ic, fn, primary) => {
    const b = el("button", "act" + (primary ? " p" : ""));
    b.innerHTML = IC[ic];
    b.append(label);
    b.onclick = fn;
    return b;
  };
  row.append(mk("Route", "route", startRoute, true));
  if (d.place) row.append(mk(d.web ? "Webseite" : "Web-Suche", "globe", () => openWeb(d)));
  row.append(mk("Google Maps", "pin", () => ext(gmaps(d))));
  acts.append(row);

  renderPlaceSave(d);

  // Info
  const info = $("placeInfo");
  info.innerHTML = "";
  const rows = [];
  const w = where(d);
  if (w) rows.push(["Adresse", w]);
  rows.push(["Koordinaten", d.lngLat[1].toFixed(5).replace(".", ",") + ", " + d.lngLat[0].toFixed(5).replace(".", ",")]);
  const sec = el("div", "sec"), card = el("div", "card");
  sec.append(el("h5", null, "Info"));
  rows.forEach(([l, v]) => {
    const r = el("div", "lrow info"), t = el("div", "t");
    t.append(el("small", null, l), el("b", null, v));
    r.append(t);
    card.append(r);
  });
  sec.append(card);
  info.append(sec);
}

const samePlace = (a, b) => a && b && a.name === b.name && Math.abs(a.lngLat[0] - b.lngLat[0]) < 0.0005 && Math.abs(a.lngLat[1] - b.lngLat[1]) < 0.0005;

// Speichern als Schalter: Favorit, Zuhause, Arbeit
function renderPlaceSave(d) {
  const box = $("placeSave");
  box.innerHTML = "";
  const sec = el("div", "sec"), card = el("div", "card");
  sec.append(el("h5", null, "Speichern"));
  card.append(switchRow("star", "orange", "Favorit", "", isFavorite(d), () => { toggleFavorite(d); renderHome(); }));
  [["home", "Zuhause", "home", "teal"], ["work", "Arbeit", "work", "blue"]].forEach(([k, label, ic, col]) => {
    card.append(switchRow(ic, col, label, "", samePlace(getSaved(k), d), on => {
      setSaved(k, on ? d : null);
      toast(on ? label + " gespeichert" : label + " entfernt");
      renderHome();
      renderPlaceSave(d);
    }));
  });
  sec.append(card);
  box.append(sec);
}

async function enrich(d) {
  d.looking = true;
  try {
    const [lon, lat] = d.lngLat, ty = { N: "node", W: "way", R: "relation" }[d.osm && d.osm.t], id = d.osm && d.osm.id;
    const els = await queryOverpass(`[out:json][timeout:6];(${ty && id ? `${ty}(${id});` : ""}nwr(around:50,${lat},${lon})["name"];);out tags center 80;`);
    if (els) {
      const n = d.name.toLowerCase(), same = x => ["name", "name:de", "brand", "official_name"].some(k => x[k] && x[k].toLowerCase() === n);
      const hasW = x => x && (x.website || x["contact:website"] || x.url || x["contact:url"]);
      const own = ty && id ? (els.find(e => e.type === ty && e.id === id) || {}).tags : null;
      const all = els.map(e => e.tags || {});
      const t = hasW(own) ? own : (all.find(x => same(x) && hasW(x)) || own || all.find(same));
      if (t) {
        const w = t.website || t["contact:website"] || t.url || t["contact:url"];
        if (w) d.web = /^https?:\/\//i.test(w) ? w : "https://" + w;
        const a = [[t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "), t["addr:city"]].filter(Boolean).join(", ");
        if (a) {
          d.addr = a;
          if (!d.osm) d.sub = [d.sub, a].filter(Boolean).join(" · ");
        }
      }
    }
  } catch {}
  d.looking = false;
  if (dest === d && view() === "place") renderPlaceBody(d);
}

function cancel() {
  searchSeq++;
  clearTimeout(timer);
  searchMode = "dest";
  assignKey = null;
  qEl.value = "";
  qEl.placeholder = "Suche nach Orten";
  dest = null;
  waypoints = [];
  clearWaypointMarkers();
  routeSeq++;
  routeState = "idle";
  clearRoute();
  if (destMarker) {
    destMarker.remove();
    destMarker = null;
  }
  setView("home");
  updateQUi();
  renderHome();
  if (!nav) map.easeTo({ padding: NO_PAD, duration: 300 });
}

$("placeClose").onclick = cancel;
$("routeClose").onclick = () => {      // zurück zur Ortskarte
  if (!dest) return cancel();
  routeSeq++;
  routeState = "idle";
  clearRoute();
  waypoints = [];
  clearWaypointMarkers();
  dest.routed = false;
  renderPlace(dest);
};
$("routeShare").onclick = async () => {
  if (!dest) return;
  const url = gmaps(dest);
  try {
    if (navigator.share) await navigator.share({ title: dest.name, url });
    else { await navigator.clipboard.writeText(url); toast("Link kopiert"); }
  } catch {}
};
$("optBtn").onclick = () => openOptions();
$("optCancel").onclick = () => setView("route");
$("optOk").onclick = () => {
  const changed = JSON.stringify(optDraft) !== JSON.stringify(getOpts());
  setView("route");
  if (!changed) { renderRoute(); return; }
  setOpts(optDraft);
  toast("Optionen übernommen");
  planRoute();
};

renderHome();
updateQUi();

/* ---------- Routing ---------- */
async function fetchRoute(alternates) {
  if (!dest || !rawMe) throw new Error("Kein Ziel");
  const target = dest, res = await calculateRoute(rawMe, waypoints, target.lngLat, { ...getOpts(), alternates: alternates ? 2 : 0 });
  if (dest !== target) throw new Error("Ziel geändert");
  routes = res;
  setRoute(0);
  return res;
}

// Eine der berechneten Routen zur aktiven Route machen
function setRoute(i) {
  routeIdx = i;
  const r = routes[i];
  shape = r.shape;
  man = r.man;
  cum = r.cum;
  tripTime = r.tripTime;
  routeGeo = { type: "Feature", geometry: { type: "LineString", coordinates: shape } };
  altGeo = { type: "FeatureCollection", features: routes.map((x, j) => j === i ? null : { type: "Feature", properties: { i: j }, geometry: { type: "LineString", coordinates: x.shape } }).filter(Boolean) };
  if (!map.getSource("route")) addRoute();
  map.getSource("route")?.setData(routeGeo);
  map.getSource("route-alt")?.setData(altGeo);
  lastIdx = 0;
  spoke = {};
  spokePost = {};
  onRoute = false;
  if (sim) { sim.s = 0; sim.i = 0; }
}

function applyRoute(i) {
  if (!routes[i] || i === routeIdx) return;
  setRoute(i);
  beep("tick");
  renderRoute();
}

const fmtDur = min => min >= 60 ? Math.floor(min / 60) + " Std. " + String(min % 60).padStart(2, "0") + " min" : min + " min";
const fmtKm = km => km.toFixed(1).replace(".", ",") + " km";

/* ---------- Route ---------- */
function startRoute() {
  if (!dest) return;
  setView("route");
  updateQUi();
  routeState = "loading";
  renderRoute();
  planRoute();
}

function renderRoute() {
  if (!dest) return;
  const n = optCount(getOpts());
  $("optBtn").textContent = n ? "Optionen · " + n : "Optionen";
  renderWpCard();
  renderRouteCards();
  renderAlong();
  renderRouteMore();
}

// Start, Zwischenstopps und Ziel
function renderWpCard() {
  const box = $("wpCard");
  box.innerHTML = "";
  const card = el("div", "card");
  card.append(lrow({ ic: "nav", col: "blue", title: "Mein Standort" }));
  waypoints.forEach((w, i) => {
    const r = lrow({ ic: "pin", title: w.name, sub: "Stopp " + (i + 1) });
    const del = el("button", "x");
    del.innerHTML = IC.close;
    del.setAttribute("aria-label", "Stopp entfernen");
    del.onclick = e => {
      e.stopPropagation();
      waypoints.splice(i, 1);
      wpMarkers[i]?.remove();
      wpMarkers.splice(i, 1);
      planRoute();
    };
    r.append(del);
    card.append(r);
  });
  card.append(lrow({ ic: "pin", col: "red", title: dest.name, sub: dest.sub || where(dest) }));
  card.append(lrow({ ic: "plus", col: "plus", title: "Stopp hinzufügen", cls: "add", onclick: startWaypointSearch }));
  box.append(card);
}

const arrival = sec => new Date(Date.now() + sec * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

// Routenauswahl: eine Karte je Route mit "LOS"
function renderRouteCards() {
  const box = $("routeList");
  box.innerHTML = "";
  box.classList.toggle("loading", routeState === "loading" && routes.length > 0);
  if (!routes.length) {
    if (routeState === "error") {
      box.append(note("Route konnte nicht berechnet werden."));
      const retry = el("button", "chip", "Erneut versuchen");
      retry.style.margin = "0 auto";
      retry.style.display = "flex";
      retry.onclick = () => { routeState = "loading"; renderRoute(); planRoute(); };
      box.append(retry);
    } else {
      box.append(note("Route wird berechnet …"));
    }
    return;
  }
  const fast = routes.reduce((b, r, i) => (r.summary.time < routes[b].summary.time ? i : b), 0);
  const short = routes.reduce((b, r, i) => (r.summary.length < routes[b].summary.length ? i : b), 0);
  routes.forEach((r, i) => {
    const s = r.summary;
    const c = el("div", "rcard" + (i === routeIdx ? " on" : ""));
    c.setAttribute("role", "button");
    const t = el("div", "t");
    t.append(el("b", null, fmtDur(Math.round(s.time / 60))), el("span", null, arrival(s.time) + " Ankunft · " + fmtKm(s.length)));
    if (routes.length > 1 && (i === fast || i === short)) t.append(el("em", null, i === fast ? "Schnellste" : "Kürzeste"));
    const go = el("button", "go", "LOS");
    go.onclick = e => {
      e.stopPropagation();
      if (i !== routeIdx) setRoute(i);
      startNav();
    };
    c.onclick = () => applyRoute(i);
    c.append(t, go);
    box.append(c);
  });
}

// Orte entlang der Route (Overpass)
const ALONG = [
  ["Tanken", '["amenity"="fuel"]'],
  ["Laden", '["amenity"="charging_station"]'],
  ["Parken", '["amenity"="parking"]["access"!="private"]'],
  ["Essen", '["amenity"~"^(restaurant|fast_food)$"]'],
  ["Café", '["amenity"="cafe"]']
];
const ALONG_IC = { fuel: ["fuel", "green"], charging_station: ["fuel", "green"], parking: ["pin", "blue"], restaurant: ["food", "orange"], fast_food: ["food", "orange"], cafe: ["food", "orange"] };

function renderAlong() {
  const box = $("alongBox");
  box.innerHTML = "";
  if (!routes.length) return;
  const sec = el("div", "sec"), row = el("div", "chips");
  sec.append(el("h5", null, "Unterwegs suchen"));
  ALONG.forEach(([label, filter]) => {
    const b = el("button", "chip", label);
    b.onclick = () => searchAlong(label, filter, b);
    row.append(b);
  });
  const res = el("div");
  res.id = "alongRes";
  res.style.marginTop = "10px";
  sec.append(row, res);
  box.append(sec);
}

async function searchAlong(label, filter, chip) {
  if (shape.length < 2) return;
  if (!navigator.onLine) { toast("Offline – Suche nicht möglich"); return; }
  const total = cum[cum.length - 1], step = Math.max(500, total / 100), pts = [];
  let next = 0;
  for (let i = 0; i < shape.length; i++) {
    if (cum[i] >= next || i === shape.length - 1) {
      pts.push(shape[i][1].toFixed(5) + "," + shape[i][0].toFixed(5));
      next = cum[i] + step;
    }
  }
  const box = $("alongRes");
  box.innerHTML = "";
  document.querySelectorAll("#alongBox .chip").forEach(c => c.classList.toggle("on", c === chip));
  box.append(note("Suche …"));
  setBusy(true);
  const els = await queryOverpass(`[out:json][timeout:8];nwr(around:500,${pts.join(",")})${filter};out center 120;`);
  setBusy(false);
  if (!box.isConnected) return;
  box.innerHTML = "";
  if (!els) { box.append(note("Suche nicht erreichbar")); return; }
  const items = [];
  els.forEach(e => {
    const lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
    if (lat == null || lon == null) return;
    let bd = 1e12, bs = 0;
    for (let i = 0; i < shape.length - 1; i++) {
      const r = project([lon, lat], shape[i], shape[i + 1]);
      if (r.d < bd) { bd = r.d; bs = cum[i] + r.t * (cum[i + 1] - cum[i]); }
    }
    const t = e.tags || {};
    items.push({ name: t.name || t.brand || t.operator || label, kind: KIND[t.amenity] || label, am: t.amenity, lngLat: [lon, lat], d: bd, s: bs });
  });
  if (!items.length) { box.append(note("Nichts auf der Strecke gefunden")); return; }
  items.sort((a, b) => a.d - b.d);
  const card = el("div", "card");
  items.slice(0, 8).sort((a, b) => a.s - b.s).forEach(it => {
    const [ic, col] = ALONG_IC[it.am] || ["pin", "red"];
    card.append(lrow({
      ic, col, title: it.name,
      sub: it.kind + " · bei km " + Math.round(it.s / 1000) + " · " + (Math.round(it.d / 10) * 10) + " m abseits",
      onclick: () => addWaypoint({ name: it.name, lngLat: it.lngLat, sub: it.kind, place: true, ic, col })
    }));
  });
  box.append(card);
}

function renderRouteMore() {
  const box = $("routeMore");
  box.innerHTML = "";
  if (!routes.length) return;
  const sec = el("div", "sec"), card = el("div", "card");
  card.append(lrow({ ic: "play", col: "green", title: "Simulation starten", sub: "Fahrt ohne GPS testen", onclick: startSim }));
  sec.append(card);
  if (waypoints.length) sec.append(el("div", "hint", "Mit Zwischenstopps gibt es keine Alternativrouten."));
  box.append(sec);
}

async function planRoute() {
  if (!dest) return;
  if (!rawMe) { routeState = "error"; clearRoute(); renderRoute(); toast("Warte auf GPS …"); return; }
  if (!navigator.onLine) { routeState = "error"; clearRoute(); renderRoute(); toast("Offline – Route kann nicht berechnet werden"); return; }
  const my = ++routeSeq;
  routeState = "loading";
  renderRoute();
  setBusy(true);
  try {
    await fetchRoute(true);
    if (my !== routeSeq || !dest) return;
    const b = new maplibregl.LngLatBounds(shape[0], shape[0]);
    routes.forEach(r => r.shape.forEach(c => b.extend(c)));
    map.fitBounds(b, { padding: { top: 90, bottom: sheetPad() + 20, left: 40, right: 70 } });
    dest.routed = true;
    routeState = "ready";
    renderRoute();
    beep("route");
  } catch (err) {
    if (my !== routeSeq) return;
    const msg = String((err && err.message) || "");
    routeState = "error";
    clearRoute();
    renderRoute();
    toast(/no route|no suitable|found/i.test(msg) ? "Keine Route gefunden" : "Routing nicht erreichbar");
    beep("error");
  } finally {
    setBusy(false);
  }
}

/* ---------- Routenoptionen (eigene Ansicht mit Reglern) ---------- */
const RLABEL = ["Meiden", "Eher meiden", "Normal", "Eher nutzen", "Gern nutzen"];

function sliderRow({ title, min, max, step, value, fmt, ends, changed, onInput }) {
  const row = el("div", "rrow"), top = el("div", "top"), val = el("span");
  top.append(el("b", null, title), val);
  const inp = document.createElement("input");
  inp.type = "range";
  inp.className = "rng";
  inp.min = min; inp.max = max; inp.step = step; inp.value = value;
  const upd = () => {
    const v = +inp.value;
    val.textContent = fmt(v);
    val.classList.toggle("chg", changed(v));
    inp.style.setProperty("--p", ((v - min) / (max - min)) * 100 + "%");
  };
  inp.oninput = () => { onInput(+inp.value); upd(); };
  upd();
  row.append(top, inp);
  if (ends) {
    const e = el("div", "ends");
    e.append(el("span", null, ends[0]), el("span", null, ends[1]));
    row.append(e);
  }
  return row;
}

function openOptions() {
  optDraft = { ...getOpts() };
  renderOptions();
  setView("options");
}

function renderOptions() {
  const box = $("optBody");
  box.innerHTML = "";

  // Routenwahl
  let sec = el("div", "sec");
  sec.append(el("h5", null, "Routenwahl"));
  const seg = el("div", "seg");
  [["fast", "Schnellste"], ["short", "Kürzeste"]].forEach(([k, label]) => {
    const b = el("button", optDraft.mode === k ? "on" : "", label);
    b.onclick = () => { optDraft.mode = k; [...seg.children].forEach(c => c.classList.toggle("on", c === b)); };
    seg.append(b);
  });
  sec.append(seg);
  box.append(sec);

  // Straßen: Regler von "Meiden" bis "Gern nutzen"
  sec = el("div", "sec");
  sec.append(el("h5", null, "Straßen"));
  let card = el("div", "card");
  [["highways", "Autobahnen"], ["tolls", "Maut"], ["ferry", "Fähren"]].forEach(([k, label]) => {
    card.append(sliderRow({
      title: label, min: 0, max: 4, step: 1, value: Math.round(optDraft[k] * 4),
      fmt: v => RLABEL[v], ends: ["Meiden", "Gern nutzen"],
      changed: v => v !== 2, onInput: v => { optDraft[k] = v / 4; }
    }));
  });
  sec.append(card);
  box.append(sec);

  // Fahrweise
  sec = el("div", "sec");
  sec.append(el("h5", null, "Fahrweise"));
  card = el("div", "card");
  card.append(sliderRow({
    title: "Höchstgeschwindigkeit", min: 80, max: 140, step: 10, value: optDraft.topSpeed,
    fmt: v => (v >= 140 ? "Standard" : v + " km/h"), ends: ["80 km/h", "Standard"],
    changed: v => v < 140, onInput: v => { optDraft.topSpeed = v; }
  }));
  card.append(switchRow(null, "", "Unbefestigte Straßen meiden", "Feld-, Wald- und Schotterwege", optDraft.unpaved, on => { optDraft.unpaved = on; }));
  sec.append(card);
  sec.append(el("div", "hint", "Die Höchstgeschwindigkeit wirkt sich auf die berechnete Fahrzeit aus."));
  box.append(sec);

  // Zurücksetzen
  sec = el("div", "sec");
  card = el("div", "card");
  card.append(lrow({ title: "Zurücksetzen", cls: "danger", onclick: () => { optDraft = { ...DEFAULT_OPTS }; renderOptions(); } }));
  sec.append(card);
  sec.append(el("div", "hint", "Gilt für alle neuen Routen. Der Routendienst behandelt die Regler als Vorgaben – nicht jede Strecke lässt sich vollständig anpassen."));
  box.append(sec);
}

const rw = w => ["interpolate", ["linear"], ["zoom"], 9, w * 0.45, 15, w, 19, w * 1.7];
function addRoute() {
  if (map.getSource("route")) return;
  const R = ROUTE[STYLES[si][1]];
  map.addSource("route", { type: "geojson", data: routeGeo || EMPTY });
  map.addSource("route-alt", { type: "geojson", data: altGeo || EMPTY });
  const lay = { "line-cap": "round", "line-join": "round" };
  const before = map.getLayer("road_labels") ? "road_labels" : undefined;
  map.addLayer({ id: "route-alt", type: "line", source: "route-alt", layout: lay, paint: { "line-color": "#8f959c", "line-opacity": 0.8, "line-width": rw(R.w * 0.85) } }, before);
  map.addLayer({ id: "route-casing", type: "line", source: "route", layout: lay, paint: { "line-color": R.cc, "line-opacity": R.co, "line-width": rw(R.cw) } }, before);
  map.addLayer({ id: "route-line", type: "line", source: "route", layout: lay, paint: { "line-color": R.col, "line-opacity": R.op, "line-width": rw(R.w) } }, before);
}

/* ---------- Navigation ---------- */
const fmt = d => {
  const m = d < 150 ? Math.max(10, Math.round(d / 10) * 10) : Math.round(d / 50) * 50;
  return m >= 1000 ? (d / 1000).toFixed(1).replace(".", ",") + " km" : m + " m";
};
function speak(t) {
  if (!voice || !t || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "de-DE";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
async function wake() {
  if (wakeLock && !wakeLock.released) return;
  try { wakeLock = await navigator.wakeLock.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", () => { if (nav && document.visibilityState === "visible") wake(); });

function startNav() {
  initCompass();
  nav = true;
  follow = true;
  updateCompassBtn();
  document.body.classList.add("nav");
  $("banner").classList.remove("min");
  if (routes.length > 1) {
    routes = [routes[routeIdx]];
    routeIdx = 0;
    altGeo = null;
    map.getSource("route-alt")?.setData(EMPTY);
  }
  limitKmh = null;
  limitT = 0;
  speak("Navigation gestartet");
  wake();
  camera(true);
  // Anzeige sofort mit der ersten Anweisung füllen, damit sie nie leer ist
  const k0 = man.findIndex((m, i) => i > 0);
  if (k0 >= 0) showManeuver(k0, cum[man[k0].begin_shape_index]);
  if (shape.length > 0) navStep();
}

function stopNav(arrived) {
  stopSim();
  nav = false;
  limitKmh = null;
  renderLimit();
  document.body.classList.remove("nav");
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  if (!arrived && window.speechSynthesis) speechSynthesis.cancel();
  cancel();
  map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
  updateCompassBtn();
}

// Abbiegeanzeige oben links (Pfeil, Entfernung, Text, nächste Anweisung)
function showManeuver(k, d) {
  const m = man[k];
  if (!m) return;
  const ico = $("bIco");
  if (ico.dataset.t != m.type) { ico.dataset.t = m.type; ico.innerHTML = turnSvg(m.type); }
  $("bDist").textContent = fmt(d);
  $("bText").textContent = m.instruction;
  const n = man[k + 1];
  $("b2").hidden = !n;
  if (n) {
    const i2 = $("b2Ico");
    if (i2.dataset.t != n.type) { i2.dataset.t = n.type; i2.innerHTML = turnSvg(n.type); }
    $("b2Text").textContent = n.instruction;
  }
}

// Zwischenstopps, die man erreicht hat, nicht mehr für die Neuberechnung verwenden
function passWaypoints() {
  for (let i = waypoints.length - 1; i >= 0; i--) {
    if (dist(rawMe, waypoints[i].lngLat) < 50) {
      waypoints.splice(i, 1);
      wpMarkers[i]?.remove();
      wpMarkers.splice(i, 1);
    }
  }
}

// Position auf die Route projizieren (Abstand zu Strecken, nicht nur zu Stützpunkten)
function matchRoute() {
  let bi = -1, bd = 1e12, bt = 0;
  for (let i = Math.max(0, lastIdx - 3); i < shape.length - 1; i++) {
    if (i > lastIdx + 3 && cum[i] - cum[lastIdx] > 1500) break;
    const r = project(rawMe, shape[i], shape[i + 1]);
    if (r.d < bd) { bd = r.d; bi = i; bt = r.t; }
  }
  return { bi, bd, bt };
}

async function navStep() {
  if (!rawMe || shape.length < 2) return;
  passWaypoints();
  renderLimit();
  updateLimit();
  const { bi, bd, bt } = matchRoute();
  const off = bi < 0 || bd > Math.max(60, Math.min(acc * 1.5, 200));
  if (off && !onRoute && bi >= 0 && bd < 300) {
    // Noch nicht auf der Route (z. B. Start abseits der Straße): erste Anweisung zeigen, noch nicht neu berechnen
    const k0 = man.findIndex((m, i) => i > 0);
    if (k0 >= 0) showManeuver(k0, bd + cum[man[k0].begin_shape_index]);
    return;
  }
  if (!off) onRoute = true;
  if (off) {
    const ico = $("bIco");
    if (ico.dataset.t !== "reroute") { ico.dataset.t = "reroute"; ico.innerHTML = turnSvg(12); }
    $("bDist").textContent = "Neue Route";
    $("bText").textContent = "Route wird neu berechnet …";
    $("b2").hidden = true;
    if (!navigator.onLine) {
      if (Date.now() - lastReroute > 15000) {
        lastReroute = Date.now();
        toast("Offline – Neuberechnung pausiert");
      }
      return;
    }
    if (Date.now() - lastReroute > 10000) {
      lastReroute = Date.now();
      speak("Route wird neu berechnet");
      beep("reroute");
      try { await fetchRoute(false); } catch { if (nav) toast("Neuberechnung fehlgeschlagen"); }
    }
    return;
  }
  lastIdx = bi;
  progress = cum[bi] + bt * (cum[bi + 1] - cum[bi]);
  const total = cum[cum.length - 1], rem = Math.max(0, total - progress);
  if (rem < 25) {
    speak("Sie haben Ihr Ziel erreicht");
    beep("arrive");
    stopNav(true);
    return;
  }
  const k = man.findIndex((m, i) => i > 0 && m.begin_shape_index > bi);
  if (k < 0) return;
  const m = man[k], d = Math.max(0, cum[m.begin_shape_index] - progress);
  showManeuver(k, d);
  const mins = Math.max(1, Math.round(tripTime * (total > 0 ? rem / total : 0) / 60));
  $("eta").textContent = new Date(Date.now() + mins * 60000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  $("remT").textContent = mins >= 60 ? Math.floor(mins / 60) + ":" + String(mins % 60).padStart(2, "0") : mins;
  $("remTL").textContent = mins >= 60 ? "Std." : "Min.";
  $("remD").textContent = (rem / 1000).toFixed(1).replace(".", ",");
  const st = spoke[k] || 0, prev = man[k - 1];
  const pre = m.verbal_pre_transition_instruction || m.instruction, alert = m.verbal_transition_alert_instruction || pre;
  if (d <= 80 && st < 2) { spoke[k] = 2; speak(pre); }
  else if (d <= 450 && st < 1) { spoke[k] = 1; speak("In " + Math.round(d / 50) * 50 + " Metern: " + alert); }
  else if (prev && prev.verbal_post_transition_instruction && d > 1000 && !spokePost[k] && progress - cum[prev.begin_shape_index] > 60) {
    spokePost[k] = 1;
    speak(prev.verbal_post_transition_instruction);
  }
}

/* ---------- Tempolimit (OSM maxspeed) ---------- */
const MAXSPEED = { "DE:urban": 50, "DE:rural": 100, "DE:zone30": 30, "DE:living_street": 7, "AT:urban": 50, "AT:rural": 100, walk: 7 };
function parseMax(v) {
  if (!v) return null;
  if (/^\d+$/.test(v)) return +v;
  const mph = /^(\d+)\s*mph$/i.exec(v);
  if (mph) return Math.round(mph[1] * 1.609);
  return MAXSPEED[v] || null;
}

async function updateLimit() {
  if (limitBusy || !rawMe || !navigator.onLine) return;
  if (Date.now() - limitT < 12000 || (speed < 1 && limitKmh)) return;
  limitT = Date.now();
  limitBusy = true;
  try {
    const [lon, lat] = rawMe;
    const els = await queryOverpass(`[out:json][timeout:5];way(around:18,${lat},${lon})[highway][maxspeed];out tags 6;`);
    if (els) {
      const vals = els.map(e => parseMax(e.tags && e.tags.maxspeed)).filter(Boolean);
      if (vals.length) { limitKmh = vals[0]; limitMiss = 0; }
      else if (++limitMiss >= 2) limitKmh = null;
    }
  } finally {
    limitBusy = false;
  }
  renderLimit();
}

function renderLimit() {
  const box = $("limit");
  if (!nav || !limitKmh) { box.hidden = true; return; }
  box.hidden = false;
  $("limitVal").textContent = limitKmh;
  box.classList.toggle("over", speed * 3.6 > limitKmh + 3);
}

/* ---------- Simulation: Route selbst abfahren ---------- */
const bearing = (a, b) => {
  const dl = (b[0] - a[0]) * RAD;
  const y = Math.sin(dl) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
};

function startSim() {
  if (shape.length < 2) return;
  sim = { s: 0, i: 0 };
  document.body.classList.add("sim");
  $("simTag").hidden = false;
  startNav();
  clearInterval(simTimer);
  simTimer = setInterval(simTick, 1000);
  simTick();
}

function stopSim() {
  sim = null;
  clearInterval(simTimer);
  simTimer = null;
  document.body.classList.remove("sim");
  $("simTag").hidden = true;
}

function simTick() {
  if (!sim || !nav || shape.length < 2) return;
  const v = simKmh / 3.6;
  sim.s = Math.min(sim.s + v, cum[cum.length - 1]);
  let i = sim.i || 0;
  if (i >= shape.length - 1) i = 0;
  while (i < shape.length - 2 && cum[i + 1] < sim.s) i++;
  sim.i = i;
  const seg = cum[i + 1] - cum[i], t = seg > 0 ? Math.min(1, (sim.s - cum[i]) / seg) : 0;
  const a = shape[i], b = shape[i + 1];
  handlePos({ coords: { longitude: a[0] + (b[0] - a[0]) * t, latitude: a[1] + (b[1] - a[1]) * t, speed: v, heading: bearing(a, b), accuracy: 5 } });
}
