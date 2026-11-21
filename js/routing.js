export const VALHALLA="https://valhalla1.openstreetmap.de/route";

export function decodePolyline(str){
  let i=0,lat=0,lon=0,out=[];
  while(i<str.length){
    let b,s=0,r=0;
    do{b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5}while(b>=32);
    lat+=(r&1)?~(r>>1):(r>>1);
    s=0;r=0;
    do{b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5}while(b>=32);
    lon+=(r&1)?~(r>>1):(r>>1);
    out.push([lon/1e6,lat/1e6]);
  }
  return out;
}

const rad=Math.PI/180;
export function dist(a,b){
  const dLa=(b[1]-a[1])*rad,dLo=(b[0]-a[0])*rad;
  const h=Math.sin(dLa/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLo/2)**2;
  return 12742000*Math.asin(Math.sqrt(h));
}

// Abstand eines Punktes p zur Strecke a-b in Metern (lokale Näherung) plus Position t (0..1) auf der Strecke
export function project(p,a,b){
  const kx=Math.cos(p[1]*rad)*111320,ky=110540;
  const ax=(a[0]-p[0])*kx,ay=(a[1]-p[1])*ky,bx=(b[0]-p[0])*kx,by=(b[1]-p[1])*ky;
  const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  const t=l2?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/l2)):0;
  return {d:Math.hypot(ax+t*dx,ay+t*dy),t};
}

// Eine Valhalla-Route (trip) in unser Format umwandeln
function parseTrip(trip){
  // Alle Legs zusammenführen (bei Zwischenstopps)
  let shape = [];
  let man = [];
  let offset = 0;
  trip.legs.forEach((leg, legIdx) => {
    const dec = decodePolyline(leg.shape);
    if (legIdx > 0 && dec.length > 0) dec.shift(); // doppelten Punkt vermeiden
    leg.maneuvers.forEach(m => {
      man.push({
        ...m,
        begin_shape_index: m.begin_shape_index + offset,
        end_shape_index: m.end_shape_index + offset
      });
    });
    shape = shape.concat(dec);
    offset = shape.length - 1;
  });

  const cum=[0];
  for(let i=1;i<shape.length;i++) cum[i]=cum[i-1]+dist(shape[i-1],shape[i]);

  return { shape, man, cum, tripTime: trip.summary.time, summary: trip.summary };
}

// Liefert eine Liste von Routen: [Hauptroute, Alternativen …]
// opts: {mode, highways, tolls, ferry, unpaved, topSpeed}; alternates nur ohne Zwischenstopps möglich
export async function calculateRoute(startCoords, waypoints, destCoords, opts = {}){
  const pts = [startCoords, ...waypoints.map(w => w.lngLat), destCoords];
  const locations = pts.map((c, idx) => ({
    lat: c[1],
    lon: c[0],
    type: (idx === 0 || idx === pts.length - 1) ? "break" : "through"
  }));

  // Regler 0 = meiden … 1 = gern nutzen; nur Abweichungen vom Standard werden gesendet
  const auto = {};
  if (opts.highways != null && opts.highways !== .5) auto.use_highways = opts.highways;
  if (opts.tolls != null && opts.tolls !== .5) auto.use_tolls = opts.tolls;
  if (opts.ferry != null && opts.ferry !== .5) auto.use_ferry = opts.ferry;
  if (opts.mode === "short") auto.shortest = true;
  if (opts.unpaved) auto.exclude_unpaved = true;
  if (opts.topSpeed && opts.topSpeed < 140) auto.top_speed = opts.topSpeed;

  const body={
    locations,
    costing:"auto",
    directions_options:{language:"de-DE",units:"kilometers"}
  };
  if (Object.keys(auto).length) body.costing_options = { auto };
  if (opts.alternates && waypoints.length === 0) body.alternates = opts.alternates;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(VALHALLA+"?json="+encodeURIComponent(JSON.stringify(body)), {signal: controller.signal});
    if(!res.ok){
      let msg="HTTP "+res.status;
      try{const e=await res.json();if(e&&e.error)msg=e.error}catch{}
      throw new Error(msg);
    }
    const j = await res.json();
    if(!j.trip||!j.trip.legs||!j.trip.legs.length) throw new Error("Keine Route gefunden");
    const routes=[parseTrip(j.trip)];
    (j.alternates||[]).forEach(a=>{ if(a&&a.trip&&a.trip.legs&&a.trip.legs.length) routes.push(parseTrip(a.trip)); });
    return routes;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchPhoton(query, me){
  const u=new URL("https://photon.komoot.io/api/");
  u.search=new URLSearchParams({q:query,limit:8,lang:"de",...(me?{lat:me[1],lon:me[0]}:{})}).toString();
  const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);
  try{
    const res = await fetch(u,{signal:c.signal});
    if(!res.ok) throw new Error("Photon error");
    return (await res.json()).features || [];
  }finally{clearTimeout(t)}
}

export async function reversePhoton(lngLat){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);
  try{
    const [lon,lat]=lngLat;
    const r=await fetch("https://photon.komoot.io/reverse?"+new URLSearchParams({lon,lat,lang:"de",limit:1}),{signal:c.signal});
    if(!r.ok) return "";
    const j=await r.json();
    const p=j.features&&j.features[0]&&j.features[0].properties;
    if(p) return [[p.postcode,p.city||p.town||p.village||p.locality||p.district||p.county].filter(Boolean).join(" "),p.state,p.country].filter(Boolean).join(", ");
  }catch{}finally{clearTimeout(t)}
  return "";
}

const OVP=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
export async function queryOverpass(q){
  const ctrls=[];
  const one=async u=>{
    const c=new AbortController();ctrls.push(c);const t=setTimeout(()=>c.abort(),7000);
    try{const r=await fetch(u+"?data="+encodeURIComponent(q),{signal:c.signal});if(!r.ok)throw new Error(r.status);return(await r.json()).elements}
    finally{clearTimeout(t)}
  };
  try{const r=await Promise.any(OVP.map(one));ctrls.forEach(c=>c.abort());return r}catch{return null}
}
