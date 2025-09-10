// lib/generateHardMap.js
// Secret Vice — Hard generator v6 (flow-first)

function mulberry32(seed){return function(){let t=(seed+=0x6D2B79F5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function hashString(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HEX2RGB=(hex)=>{const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||"#ff2aa0");if(!m)return[1,0,0.65];return[parseInt(m[1],16)/255,parseInt(m[2],16)/255,parseInt(m[3],16)/255];};

const FOLLOW={
  // up,down,left,right,diag…, dot
  0:[5,4,8],1:[2,3,8],2:[5,1,8],3:[4,0,8],4:[0,3,8],5:[0,2,8],6:[1,3,8],7:[1,2,8],8:[5,4,2,3]
};

function buildBeatFeaturesFallback(analysis){
  const beatGrid=Array.isArray(analysis.beatGrid)?analysis.beatGrid:[];
  const onsets=Array.isArray(analysis.onsets)?analysis.onsets.slice().sort((a,b)=>a-b):[];
  const tempo=analysis?.tempo||estimateTempo(beatGrid)||120;
  const beatFeatures=beatGrid.map((t,i)=>{
    const cnt=countInWindow(onsets,t,0.06);
    const bucket=cnt>=2?"loud":cnt===1?"mid":"quiet";
    return{index:i,timeSec:t,flux:cnt,bucket,downbeat:i%4===0};
  });
  return{tempo,beatFeatures,onsets,beatGrid,meta:analysis.meta||{title:"Untitled"}};
}
function estimateTempo(grid){if(!grid||grid.length<2)return 120;const dt=grid[1]-grid[0];return dt>0?60/dt:120;}
function countInWindow(arr,c,w){let n=0;for(let i=0;i<arr.length;i++){const d=arr[i]-c;if(d<-w)continue;if(d>w)break;n++;}return n;}
function classifyEnergy(onsets,center,win=0.28){let n=0;for(let i=0;i<onsets.length;i++){const d=Math.abs(onsets[i]-center);if(d<=win)n++; if(onsets[i]-center>win)break;}return n>=3?"high":n===0?"low":"mid";}

function safeSightline(last,cand,hor=0.5){
  for(let i=last.length-1;i>=0;i--){
    const n=last[i]; if(cand.b-n.b>hor)break;
    if(n.x===cand.x && n.y===cand.y){
      if(!(n.d===8 || cand.d===8)) return false;
    }
  }
  return true;
}
function tooRepetitive(notes,beats=16){
  const slice=notes.slice(Math.max(0,notes.length-beats));
  const sig=slice.map(n=>`${n.c}${n.x}${n.y}${n.d}`).join("-");
  const hay=notes.slice(0,Math.max(0,notes.length-beats)).map(n=>`${n.c}${n.x}${n.y}${n.d}`).join("-");
  return sig && hay.includes(sig);
}

function pickDirFollow(lastDir,suggest){const opts=FOLLOW[lastDir]||[suggest,8];return opts.includes(suggest)?suggest:opts[0];}

function addBeatLight(map,b,pack,bucket,rgbA,rgbB,useB=false){
  const [r,g,bl]=(useB?rgbB:rgbA);const cd={_color:[r,g,bl,1]};
  if(pack==="cyberpunk"){
    const i=bucket==="loud"?7:bucket==="mid"?5:3;
    map.basicBeatmapEvents.push({b,et:0,i,f:1,customData:cd,_customData:cd});
    map.basicBeatmapEvents.push({b:b+0.06,et:0,i:0,f:0,customData:cd,_customData:cd});
  }else{
    const i=bucket==="loud"?6:4;
    map.basicBeatmapEvents.push({b,et:0,i,f:1,customData:cd,_customData:cd});
  }
}
function addPhraseLight(map,b,pack,rgbA,rgbB){
  const cdA={_color:[...rgbA,1]},cdB={_color:[...rgbB,1]};
  if(pack==="cyberpunk"){
    map.basicBeatmapEvents.push({b,et:2,i:1,f:1,customData:cdA,_customData:cdA});
    map.basicBeatmapEvents.push({b:b+0.25,et:2,i:0,f:0,customData:cdB,_customData:cdB});
  }else{
    map.basicBeatmapEvents.push({b,et:1,i:3,f:1,customData:cdA,_customData:cdA});
  }
}

export function generateHardMap(analysis, options={}){
  const preset=options.preset||"dancey";             // default to smoother
  const lights=options.lights||"cyberpunk";
  const colors=options.colors||{primary:"#ff2aa0",secondary:"#00c9ff"};
  const startOffsetBeats=Number.isFinite(options.startOffsetBeats)?Math.max(0,options.startOffsetBeats):4;

  const rgbA=HEX2RGB(colors.primary), rgbB=HEX2RGB(colors.secondary);

  const haveBF=Array.isArray(analysis?.beatFeatures)&&analysis.beatFeatures.length>0;
  const {tempo,beatFeatures,onsets,meta}=haveBF
    ? {tempo:analysis.tempo||120, beatFeatures:analysis.beatFeatures, onsets:analysis.onsets||[], meta:analysis.meta||{title:"Untitled"}}
    : buildBeatFeaturesFallback(analysis);

  const bpm=tempo||120;
  const secToBeats=(s)=>(s*bpm)/60;

  const map={
    version:"3.3.0",
    bpmEvents:[], rotationEvents:[],
    colorNotes:[], sliders:[], burstSliders:[], obstacles:[],
    basicBeatmapEvents:[], colorBoostBeatmapEvents:[]
  };

  const seed=hashString(meta?.title||"secret-vice");
  const rand=mulberry32(seed);

  // Section energy via moving window → label every 4-beat bar
  const bars=[]; for(let i=0;i<beatFeatures.length;i+=4){bars.push(beatFeatures.slice(i,i+4));}
  const sectionLabel=(bar)=>{
    const center=bar.reduce((a,b)=>a+b.timeSec,0)/bar.length;
    const e=classifyEnergy(onsets,center);
    if(e==="high") return "chorus";
    if(e==="mid")  return "verse";
    return "intro";
  };

  // Style palettes by section
  const palettes={
    intro:  { density:[1,2],  dotChance:0.2,  diagChance:0.6,  subdiv:4 },
    verse:  { density:[2,3],  dotChance:0.15, diagChance:0.7,  subdiv:4 },
    chorus: { density:[3,4],  dotChance:0.1,  diagChance:0.85, subdiv:8 }
  };
  if(preset==="tech"){ palettes.chorus.subdiv=8; palettes.verse.subdiv=4; }
  if(preset==="showpiece"){ palettes.chorus.dotChance=0.05; }

  let lastDir=5, leadLeft=true;
  let baseX=1, baseY=1;
  const clampX=(x)=>clamp(x,0,3);
  const clampInnerX=(x)=>clamp(x,1,2);
  const clampY=(y)=>clamp(y,0,2);

  for(let bi=0;bi<bars.length;bi++){
    const bar=bars[bi]; if(!bar.length) continue;
    const label=sectionLabel(bar);
    const pal=palettes[label];

    // phrase light at bar start
    addPhraseLight(map, secToBeats(bar[0].timeSec)+startOffsetBeats, lights, rgbA, rgbB);

    // compute per-beat target count (no dead beats; max 2 per beat in Hard)
    const perBeat = bar.map(bf=>{
      const bucketScore = bf.bucket==="loud"?2:bf.bucket==="mid"?1.5:1;
      const max = pal.density[1];
      return Math.min(2, Math.round(Math.max(pal.density[0], bucketScore)));
    });

    for(let j=0;j<bar.length;j++){
      const bf=bar[j];
      const b0=secToBeats(bf.timeSec)+startOffsetBeats;
      const count=perBeat[j];

      // base drift within inner columns
      baseX = clampInnerX(baseX + (rand()<0.5?-1:+1));
      baseY = clampY(baseY + (rand()<0.4?0:(rand()<0.5?-1:+1)));

      let placed=0, offset=0;
      const stepGap = pal.subdiv===8 ? 0.125 : 0.25; // 8th vs 16th
      while(placed<count){
        // choose direction family
        const useDiag = rand()<pal.diagChance;
        let suggestedDir;
        if(useDiag){ // diagonals feel dancier
          suggestedDir = leadLeft ? (rand()<0.5?5:7) : (rand()<0.5?4:6);
        }else{
          suggestedDir = rand()<0.5 ? 0 : 1; // up / down
        }
        let d = pickDirFollow(lastDir, suggestedDir);

        // choose hand and lane
        const c = leadLeft?0:1;
        let x = clampInnerX(baseX + (leadLeft ? -1 : +1));
        let y = clampY(baseY + (d===0?1: d===1?-1:0));

        // candidate note
        const nb = b0 + offset;
        const cand = { b: nb, x, y, c, d, a: 0 };

        // spacing constraints
        const prev = map.colorNotes[map.colorNotes.length-1];
        const tooCloseInTime = prev && (nb - prev.b) < 0.18;
        const sameCellClose = prev && prev.x===x && prev.y===y && (nb - prev.b) < 0.35;
        if(tooCloseInTime || sameCellClose){ offset += stepGap; continue; }

        // sightline
        if(!safeSightline(map.colorNotes, cand, 0.5)){
          if(rand()<0.5) cand.d = 8; else cand.x = clampX(cand.x + (leadLeft?+1:-1));
        }

        map.colorNotes.push(cand);
        lastDir = cand.d;
        placed++;
        offset += stepGap;

        // beat light
        addBeatLight(map, nb, lights, bf.bucket, rgbA, rgbB, (j%2===1));
      }

      // quick anti-loop jab if 2 bars repeat
      if(tooRepetitive(map.colorNotes, 16)){
        const fix={ b:b0+0.375, x:clampInnerX(baseX+(leadLeft?+1:-1)), y:clampY(baseY+1), c:leadLeft?1:0, d:8, a:0 };
        map.colorNotes.push(fix); lastDir=fix.d;
      }

      // alternate hands each beat
      leadLeft=!leadLeft;
    }
  }

  return { bpm, map };
}
