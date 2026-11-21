export const $=id=>document.getElementById(id);

const sv=(d,fill)=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="'+(fill||"none")+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
export const IC={
 layers:sv('<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>'),
 loc:sv('<path d="M20 4L4 11.2l6.6 2.2L12.8 20z"/>',"currentColor"),
 compass:sv('<circle cx="12" cy="12" r="9"/><polygon points="12,5.5 15,12 9,12" fill="#ff453a" stroke="none"/><polygon points="12,18.5 15,12 9,12" fill="currentColor" stroke="none"/>'),
 voice:sv('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
 mute:sv('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M4 4l16 16"/>'),
 route:sv('<circle cx="7" cy="5.5" r="2.3"/><path d="M7 8c0 5 10 2 10 7"/><circle cx="17" cy="18" r="2.6" fill="currentColor"/>'),
 globe:sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
 search:sv('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
 pin:sv('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
 close:sv('<path d="M6 6l12 12M18 6L6 18"/>'),
 star:sv('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
 starFill:sv('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',"currentColor"),
 plus:sv('<path d="M12 5v14M5 12h14"/>'),
 home:sv('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>'),
 work:sv('<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6h6v2"/>'),
 play:sv('<path d="M8 5v14l11-7z"/>',"currentColor"),
 download:sv('<path d="M12 4v10M8 10l4 4 4-4M5 19h14"/>'),
 share:sv('<path d="M12 15V4M8 8l4-4 4 4M6 12v7h12v-7"/>'),
 check:sv('<path d="M5 12.5l4.5 4.5L19 7"/>'),
 chevron:sv('<path d="M9 5l7 7-7 7"/>'),
 city:sv('<path d="M4 20V9h6v11M10 20V4h10v16M3 20h18M13 8h4M13 12h4M13 16h4M6.5 12.5h1M6.5 16h1"/>'),
 train:sv('<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 11h12M9 20l2-3.5M15 20l-2-3.5"/><circle cx="9.5" cy="13.7" r=".6" fill="currentColor"/><circle cx="14.5" cy="13.7" r=".6" fill="currentColor"/>'),
 flag:sv('<path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6"/>'),
 road:sv('<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3"/>'),
 food:sv('<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6M17 21V3c-2.2 1.2-3 4-3 7 0 2 1 3 3 3"/>'),
 shop:sv('<path d="M4 8h16l-1.2 11H5.2zM8.5 8V7a3.5 3.5 0 0 1 7 0v1"/>'),
 fuel:sv('<path d="M5 20V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15M4 20h11M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 3 0V8l-3-3M7.5 7.5h4"/>'),
 nav:sv('<path d="M20 4L4 11.2l6.6 2.2L12.8 20z"/>',"currentColor"),
 sliders:sv('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>')
};

const TURN={9:35,10:90,11:135,14:-135,15:-90,16:-35,18:35,19:-35,20:35,21:-35,23:35,24:-35,37:35,38:-35};
export function turnSvg(type){
  const W='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">';
  if(type===4||type===5||type===6)return W+'<path d="M32 58S14 41 14 26a18 18 0 0 1 36 0c0 15-18 32-18 32z"/><circle cx="32" cy="26" r="6" fill="currentColor"/></svg>';
  if(type===12||type===13)return W+'<g'+(type===12?' transform="matrix(-1 0 0 1 64 0)"':'')+'><path d="M44 58V28a12 12 0 0 0-24 0v18M10 38l10 10 10-10"/></g></svg>';
  if(type===26||type===27)return W+'<circle cx="32" cy="34" r="11"/><path d="M32 58V45M32 23V7M22 17L32 7l10 10"/></svg>';
  const a=(TURN[type]||0)*Math.PI/180,sharp=Math.abs(a)>1.6,L=a===0?28:(Math.abs(a)<1?32:(sharp?36:24)),d=[Math.sin(a),-Math.cos(a)];
  const cy=sharp?-8:0,C=[0,cy],S=[0,cy+(sharp?38:28)];
  const E=a===0?[0,-28]:[d[0]*L,cy+d[1]*L],rot=(v,t)=>[v[0]*Math.cos(t)-v[1]*Math.sin(t),v[0]*Math.sin(t)+v[1]*Math.cos(t)];
  const back=[-d[0],-d[1]],h1=rot(back,Math.PI/4),h2=rot(back,-Math.PI/4),H=12;
  const A1=[E[0]+H*h1[0],E[1]+H*h1[1]],A2=[E[0]+H*h2[0],E[1]+H*h2[1]];
  const pts=[S,E,A1,A2,C],xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);
  const tx=32-(Math.min(...xs)+Math.max(...xs))/2,ty=32-(Math.min(...ys)+Math.max(...ys))/2,f=n=>n.toFixed(1);
  let path;
  if(a===0)path='M0 28L0 -28';
  else{const r=9,P1=[0,cy+r],P2=[d[0]*r,cy+d[1]*r];path=`M${f(S[0])} ${f(S[1])}L${f(P1[0])} ${f(P1[1])}Q${f(C[0])} ${f(C[1])} ${f(P2[0])} ${f(P2[1])}L${f(E[0])} ${f(E[1])}`}
  path+=`M${f(A1[0])} ${f(A1[1])}L${f(E[0])} ${f(E[1])}L${f(A2[0])} ${f(A2[1])}`;
  return W+`<g transform="translate(${f(tx)} ${f(ty)})"><path d="${path}"/></g></svg>`;
}

let toastTimer;
export function toast(t){
  const e=$("toast");
  e.textContent=t;
  e.style.opacity=1;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>e.style.opacity=0,2200);
}

export function el(tag,cls,text){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!=null)e.textContent=text;
  return e;
}

// Favoriten & Verlauf im LocalStorage
const FAV_KEY = "gamemap_favs";
const HIST_KEY = "gamemap_hist";

export function getFavorites(){
  try{ return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }catch{ return []; }
}

// Was von einem Ort gespeichert wird (Symbol und Farbe für die Listen inklusive)
const slim = p => ({name: p.name, lngLat: p.lngLat, sub: p.sub || "", place: !!p.place, area: p.area || "", addr: p.addr || "", ic: p.ic || "", col: p.col || ""});

// gleicher Ort = gleicher Name und Koordinaten (Länge UND Breite) nahe beieinander
const same = (a, b) => a.name === b.name && Math.abs(a.lngLat[0]-b.lngLat[0]) < 0.0005 && Math.abs(a.lngLat[1]-b.lngLat[1]) < 0.0005;

export function isFavorite(place){
  if(!place) return false;
  return getFavorites().some(f => same(f, place));
}

export function toggleFavorite(place){
  let favs = getFavorites();
  const idx = favs.findIndex(f => same(f, place));
  if(idx >= 0){
    favs.splice(idx, 1);
    toast("Aus Favoriten entfernt");
  } else {
    favs.unshift(slim(place));
    if(favs.length > 12) favs.length = 12;
    toast("Als Favorit gespeichert");
  }
  try{ localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }catch{}
  return idx < 0;
}

export function getHistory(){
  try{ return JSON.parse(localStorage.getItem(HIST_KEY)) || []; }catch{ return []; }
}

export function addHistory(place){
  if(!place || place.name === "Gewählter Punkt") return;
  let hist = getHistory().filter(h => !same(h, place));
  hist.unshift(slim(place));
  if(hist.length > 12) hist.length = 12;
  try{ localStorage.setItem(HIST_KEY, JSON.stringify(hist)); }catch{}
}

export function clearHistory(){
  try{ localStorage.removeItem(HIST_KEY); }catch{}
}

// Zuhause / Arbeit
export function getSaved(key){
  try{ return JSON.parse(localStorage.getItem("gamemap_"+key)) || null; }catch{ return null; }
}
export function setSaved(key, place){
  try{
    if(place) localStorage.setItem("gamemap_"+key, JSON.stringify(slim(place)));
    else localStorage.removeItem("gamemap_"+key);
  }catch{}
}

// Routenoptionen. Regler 0 = meiden … 1 = gern nutzen (0,5 = normal)
export const DEFAULT_OPTS = { mode: "fast", highways: .5, tolls: .5, ferry: .5, unpaved: false, topSpeed: 140 };
export function getOpts(){
  let o = {};
  try{ o = JSON.parse(localStorage.getItem("gamemap_opts")) || {}; }catch{}
  const r = { ...DEFAULT_OPTS };
  ["highways", "tolls", "ferry"].forEach(k => {
    if(o[k] === true) r[k] = 0;                                  // alte Einstellung "meiden"
    else if(typeof o[k] === "number") r[k] = Math.max(0, Math.min(1, o[k]));
  });
  if(o.mode === "short") r.mode = "short";
  if(o.unpaved === true) r.unpaved = true;
  if(typeof o.topSpeed === "number") r.topSpeed = Math.max(60, Math.min(140, o.topSpeed));
  return r;
}
export function setOpts(o){
  try{ localStorage.setItem("gamemap_opts", JSON.stringify(o)); }catch{}
}
// Anzahl der Einstellungen, die vom Standard abweichen
export function optCount(o){
  return Object.keys(DEFAULT_OPTS).filter(k => o[k] !== DEFAULT_OPTS[k]).length;
}

// Kleine 8-Bit-Töne (ohne Audiodateien)
let ac;
export function unlockAudio(){
  try{
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if(ac.state === "suspended") ac.resume();
  }catch{}
}
const SFX = {
  route:  [[660,.08],[880,.14]],
  reroute:[[440,.1],[330,.16]],
  arrive: [[523,.1],[659,.1],[784,.1],[1047,.26]],
  tick:   [[880,.05]],
  error:  [[200,.2]]
};
export function sfx(name){
  if(!ac || ac.state !== "running" || !SFX[name]) return;
  try{
    let t = ac.currentTime + .01;
    SFX[name].forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.05, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + d + .02);
      t += d;
    });
  }catch{}
}

// Netzwerk-Status überwachen
export function initNetworkMonitor(){
  const banner = $("netStatus");
  const update = () => {
    banner.style.display = navigator.onLine ? "none" : "block";
  };
  window.addEventListener("online", () => { update(); toast("Verbindung wiederhergestellt"); });
  window.addEventListener("offline", update);
  update();
}
