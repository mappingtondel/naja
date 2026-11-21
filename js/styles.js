export const STYLES=[["Radar","radar","#a34cf1","#1b0f26"],["Pergament","parch","#c0281f","#3d1b12"],["Neon","vice","#ff3da8","#140a2e"],["Pixel","pixel","#e0452b","#3d6b2a"]];

export const PAL={
 radar:{bg:"#181818",park:"#202020",water:"#2b2e2f",wline:"#2b2e2f",bld:"#26292e",bldo:"#121417",minor:"#505050",main:"#8b8b8b",major:"#9fa1a2",casing:"#181818",rw:1.25,label:"#d6d6d6",halo:"#181818",upper:0},
 parch:{bg:"#c9b490",park:"#bfae8b",water:"#98917f",wline:"#827964",bld:"#7a6d59",bldo:"#454037",minor:"#5c554a",main:"#4f493f",major:"#454037",casing:"#cdb995",rw:1,label:"#4a443d",halo:"#ccb691",upper:1},
 vice:{bg:"#140a2e",park:"#1b1040",water:"#0a1d4a",wline:"#1f4fb0",bld:"#2a1459",bldo:"#ff3da8",minor:"#7a3fd1",main:"#c74bd8",major:"#ff3da8",casing:"#140a2e",rw:1.15,label:"#7ff3ff",halo:"#140a2e",upper:0},
 pixel:{bg:"#7fb85a",park:"#5e9a3f",water:"#3b7bd9",wline:"#2c5fb0",bld:"#a0724a",bldo:"#5a3d22",minor:"#e8d9a0",main:"#d9c27a",major:"#c9a24d",casing:"#6b5a30",rw:1.1,label:"#ffffff",halo:"#2b2b2b",upper:0,px:1}
};

export const POI={
 food:["restaurant","fast_food","food_court","ice_cream","biergarten","bakery"],
 cafe:["cafe"],
 bar:["bar","pub","nightclub"],
 sport:["fitness_centre","sports_centre","gym","stadium","swimming_pool","swimming","pitch"],
 townhall:["townhall","town_hall","courthouse"],
 health:["hospital","clinic","doctors","pharmacy","dentist"],
 edu:["school","kindergarten","college","university","library"],
 shop:["supermarket","grocery","convenience","department_store","mall","clothing_store"],
 fuel:["fuel","charging_station"],
 hotel:["hotel","hostel","motel","guest_house","lodging"],
 parking:["parking"],
 bank:["bank","atm"],
 post:["post_office","post"],
 police:["police"],
 fire:["fire_station"],
 culture:["museum","cinema","theatre","castle","zoo","attraction"]
};

export const ROUTE={
 radar:{col:"#a34cf1",op:.72,w:7,cc:"#0d0614",co:.5,cw:10.5},
 parch:{col:"#b3261e",op:1,w:4.5,cc:"#2a1a12",co:.85,cw:7.5},
 vice:{col:"#33f0ff",op:.95,w:5.5,cc:"#ff3da8",co:.45,cw:12},
 pixel:{col:"#ffd23f",op:1,w:5,cc:"#3a2a14",co:.9,cw:8.5}
};

export const ME={
 radar:'<svg viewBox="0 0 100 100"><polygon points="50,6 87,93 50,73 13,93" fill="#fff" stroke="#14181c" stroke-width="8" stroke-linejoin="round"/></svg>',
 parch:'<svg viewBox="0 0 100 100"><path d="M50 5C56 27 80 40 80 64a30 30 0 0 1-60 0C20 40 44 27 50 5z" fill="#eadcb8" stroke="#2a2824" stroke-width="8" stroke-linejoin="round"/><circle cx="50" cy="64" r="11" fill="#b9ad8f" stroke="#2a2824" stroke-width="7"/></svg>',
 vice:'<svg viewBox="0 0 100 100"><polygon points="50,6 87,93 50,73 13,93" fill="#33f0ff" stroke="#ff3da8" stroke-width="8" stroke-linejoin="round"/></svg>',
 pixel:'<svg viewBox="0 0 100 100" shape-rendering="crispEdges"><path d="M44 6h12v12h12v12h12v12h12v12H68v36H56V66H44v24H32V54H8V42h12V30h12V18h12z" fill="#fff" stroke="#222" stroke-width="6" stroke-linejoin="miter"/></svg>'
};

const zw=x=>["interpolate",["exponential",1.5],["zoom"],8,x*0.1,14,x,20,x*14];
const cls=(...n)=>["match",["get","class"],n,true,false];
const inKeys=keys=>["any",["match",["to-string",["get","class"]],keys,true,false],["match",["to-string",["get","subclass"]],keys,true,false]];

export function buildStyle(k){
  const p=PAL[k],S="openmaptiles",F=["Noto Sans Regular"],L=[{id:"bg",type:"background",paint:{"background-color":p.bg}}];
  L.push({id:"land",type:"fill",source:S,"source-layer":"landcover",filter:cls("grass","wood","farmland"),paint:{"fill-color":p.park,"fill-opacity":0.7,"fill-antialias":!p.px}});
  L.push({id:"park",type:"fill",source:S,"source-layer":"park",paint:{"fill-color":p.park}});
  L.push({id:"water",type:"fill",source:S,"source-layer":"water",paint:{"fill-color":p.water,"fill-outline-color":p.wline,"fill-antialias":!p.px}});
  L.push({id:"waterway",type:"line",source:S,"source-layer":"waterway",paint:{"line-color":p.wline,"line-width":zw(1.5)}});

  // Straßen unterhalb der Gebäude
  [["minor",["minor","service"],p.minor,3,13],["main",["tertiary","secondary","primary"],p.main,5,9],["major",["motorway","trunk"],p.major,7,5]].forEach(([id,names,col,wd,mz])=>{
    wd*=p.rw;
    const b={type:"line",source:S,"source-layer":"transportation",filter:cls(...names),minzoom:mz,layout:{"line-cap":p.px?"butt":"round","line-join":p.px?"miter":"round"}};
    L.push({...b,id:id+"_casing",paint:{"line-color":p.casing,"line-width":zw(wd+2)}});
    L.push({...b,id:id+"_fill",paint:{"line-color":col,"line-width":zw(wd)}});
  });

  // Gebäude flach (Grundrisse) – wie in den Spielkarten
  L.push({id:"building",type:"fill",source:S,"source-layer":"building",minzoom:14,
    paint:{"fill-color":p.bld,"fill-outline-color":p.bldo,"fill-antialias":!p.px}});

  const nm=["to-string",["coalesce",["get","name_de"],["get","name"]]];
  const tp={"text-color":p.label,"text-halo-color":p.halo,"text-halo-width":1.5};
  const up=p.upper?{"text-transform":"uppercase","text-letter-spacing":0.2}:{},sc=p.upper?1.25:1;
  L.push({id:"road_labels",type:"symbol",source:S,"source-layer":"transportation_name",minzoom:14,layout:{"text-font":F,"text-max-width":8,"symbol-placement":"line","text-field":nm,"text-size":11,...up},paint:tp});
  L.push({id:"places",type:"symbol",source:S,"source-layer":"place",filter:cls("city","town","village","suburb"),layout:{"text-font":F,"text-max-width":9,"text-field":nm,"text-size":["match",["get","class"],"city",16*sc,"town",14*sc,12*sc],...up},paint:tp});
  Object.keys(POI).forEach(g=>L.push({id:"poi_"+g,type:"symbol",source:S,"source-layer":"poi",minzoom:15,filter:inKeys(POI[g]),
    layout:{"icon-image":"ic-"+g+"-"+k,"icon-size":["interpolate",["linear"],["zoom"],15,0.6,18,1],"icon-padding":6,
      "text-field":nm,"text-font":F,"text-size":10,"text-anchor":"top","text-offset":[0,1.4],"text-optional":true,"text-max-width":7},paint:tp}));
  return {version:8,sources:{[S]:{type:"vector",url:"https://tiles.openfreemap.org/planet",attribution:"© OpenStreetMap contributors, © OpenFreeMap"}},
    glyphs:"https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",layers:L};
}

export const styleOf=i=>buildStyle(STYLES[i][1]);

const star=(cx,cy,ro,ri)=>{let d="";for(let i=0;i<10;i++){const r=i%2?ri:ro,a=-Math.PI/2+i*Math.PI/5;d+=(i?"L":"M")+(cx+r*Math.cos(a)).toFixed(2)+" "+(cy+r*Math.sin(a)).toFixed(2)}return d+"Z"};
const INK="#14181c";

const G={
 food:["M8 5h1.6v7h1.2V5h1.6v7h1.2V5h1.6v8c0 1.7-1.2 3-2.8 3.3V27h-1.8V16.3C9.2 16 8 14.7 8 13z M24 5c-3 0-5 3.5-5 8.5 0 1.3.5 2.2 1.4 2.5H22V27h2z"],
 cafe:["M6 11h14v7a7 7 0 0 1-14 0z M20 13h1.8a3.7 3.7 0 0 1 0 7.4H19.5v-2h2.3a1.7 1.7 0 0 0 0-3.4H20z M8.2 4.5h1.7v4.7H8.2z M12.2 4.5h1.7v4.7h-1.7z M16.2 4.5h1.7v4.7h-1.7z"],
 bar:["M5.5 6h21L17 17.2V25h4.5v2h-11v-2H15v-7.2z"],
 sport:["M3.5 12h3v8h-3z M6.5 9.5h3.2v13H6.5z M9.7 14.8h12.6v2.4H9.7z M22.3 9.5h3.2v13h-3.2z M25.5 12h3v8h-3z"],
 townhall:["M16 4.5 28 11v2.5H4V11z M6.5 15.5h3v8h-3z M11.8 15.5h3v8h-3z M17.2 15.5h3v8h-3z M22.5 15.5h3v8h-3z M4 25.5h24V28H4z","M16 7.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z"],
 health:["M12 5h8v7h7v8h-7v7h-8v-7H5v-8h7z"],
 edu:["M16 6 29 12.5 16 19 3 12.5z M8 16.5v5c0 2 3.6 4 8 4s8-2 8-4v-5l-8 4z M27 14.2h1.8v8H27z"],
 shop:["M4 12h24l-2.5 13a2 2 0 0 1-2 1.6H8.5a2 2 0 0 1-2-1.6z M10 12 14 5.5h1.9L12.6 12z M22 12 18 5.5h-1.9l3.3 6.5z","M10.5 15.5h1.8v7h-1.8z M15.1 15.5h1.8v7h-1.8z M19.7 15.5h1.8v7h-1.8z"],
 fuel:["M4 5h13.5v22H4z M17.5 11l3.2 3.2v6.2a1.5 1.5 0 0 0 3 0V12.8l-2.5-2.5 1.5-1.5 4.8 4.8v7a4.2 4.2 0 0 1-8.4 0V15z","M7.5 8h6.5v6H7.5z"],
 hotel:["M3.5 7h2.8v18H3.5z M6.3 18.5h22.2V25h-2.8v-3.5H6.3z M12.3 12.5a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0z M15 11h8a5.5 5.5 0 0 1 5.5 5.5v1.4H15z"],
 parking:"P",bank:"$",
 post:["M4 8h24v16H4z","M4.8 9.3l11.2 8.7 11.2-8.7v2.5L16 20.4 4.8 11.8z"],
 police:["M16 3.5 26 7v8c0 6-4 10.4-10 13C10 25.4 6 21 6 15V7z",star(16,15,5.8,2.4)],
 fire:["M16.5 3C17 8.5 24 12 24 19a8 8 0 0 1-16 0c0-3.4 1.6-5.7 3.4-7.4.3 2.3 1.4 3.7 2.8 4.1C13.2 11.8 14.3 6.6 16.5 3z","M16 15.5c.4 2.4 3 3.6 3 6.2a3 3 0 0 1-6 0c0-1.6.9-2.4 1.7-3.2.2 1 .8 1.5 1.3 1.6z"],
 culture:[star(16,16.5,12.5,5.4)]
};

const GR={health:["M11 10V8.5A2.5 2.5 0 0 1 13.5 6h5A2.5 2.5 0 0 1 21 8.5V10h4.5a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 23.5v-11A2.5 2.5 0 0 1 6.5 10z","M14.6 13.4h2.8v3.2h3.2v2.8h-3.2v3.2h-2.8v-3.2h-3.2v-2.8h3.2z M13.4 10V8.9h5.2V10z"]};

const BADGE={
  parch:{bg:"#2f2d29",fg:"#eadcb8",ring:"#eadcb8",shape:"circle",gr:1},
  vice:{bg:"#1a0b3b",fg:"#33f0ff",ring:"#ff3da8",glow:"#ff3da8",shape:"circle"},
  pixel:{bg:"#3b3b3b",fg:"#ffffff",ring:"#9a9a9a",shape:"square"}
};

export function drawIcon(g,k,mk){
  const c=mk?mk():document.createElement("canvas");c.width=c.height=64;
  const x=c.getContext("2d");x.scale(2,2);x.lineJoin=x.lineCap="round";
  const B=BADGE[k],gl=(B&&B.gr&&GR[g])||G[g],txt=typeof gl==="string";
  const T=()=>{x.font="bold 25px -apple-system,Helvetica,Arial,sans-serif";x.textAlign="center";x.textBaseline="middle"};
  if(!B){
    if(txt){T();x.lineWidth=4.5;x.strokeStyle=INK;x.strokeText(gl,16,17);x.fillStyle="#fff";x.fillText(gl,16,17)}
    else{const s=new Path2D(gl[0]);x.lineWidth=3.4;x.strokeStyle=INK;x.stroke(s);x.fillStyle="#fff";x.fill(s);if(gl[1]){x.fillStyle=INK;x.fill(new Path2D(gl[1]))}}
  }else{
    x.beginPath();
    if(B.shape==="square"){x.lineJoin="miter";x.rect(3,3,26,26)}else x.arc(16,16,14,0,7);
    if(B.glow){x.shadowColor=B.glow;x.shadowBlur=6}
    x.fillStyle=B.bg;x.fill();x.lineWidth=B.shape==="square"?2.6:1.8;x.strokeStyle=B.ring;x.stroke();
    x.shadowBlur=0;
    x.save();x.translate(16,16.5);x.scale(.7,.7);x.translate(-16,-16);
    if(txt){T();x.fillStyle=B.fg;x.fillText(gl,16,17)}
    else{x.fillStyle=B.fg;x.fill(new Path2D(gl[0]));if(gl[1]){x.fillStyle=B.bg;x.fill(new Path2D(gl[1]))}}
    x.restore();
  }
  return c;
}
