export const LEVELS = [
  { size:3, keys:1, time:45, seed:1081, name:'First Steps' },
  { size:3, keys:1, time:43, seed:2237, name:'Quiet Corners' },
  { size:3, keys:2, time:40, seed:3911, name:'Double Back' },
  { size:4, keys:1, time:42, seed:4179, name:'New Room' },
  { size:4, keys:2, time:40, seed:5297, name:'Wrong Turn' },
  { size:4, keys:2, time:37, seed:6413, name:'Memory Tax' },
  { size:5, keys:2, time:40, seed:7541, name:'Long Corridor' },
  { size:5, keys:2, time:37, seed:8171, name:'Cross Current' },
  { size:5, keys:3, time:35, seed:9013, name:'Three Signals' },
  { size:6, keys:2, time:37, seed:10211, name:'Bigger Picture' },
  { size:6, keys:3, time:35, seed:11317, name:'Split Decision' },
  { size:6, keys:3, time:32, seed:12479, name:'Pressure' },
  { size:7, keys:3, time:34, seed:13607, name:'Deep Grid' },
  { size:7, keys:3, time:32, seed:14783, name:'False Comfort' },
  { size:7, keys:4, time:30, seed:15971, name:'Four Keys' },
  { size:8, keys:3, time:32, seed:16189, name:'Edge Memory' },
  { size:8, keys:4, time:30, seed:17327, name:'The Long Way' },
  { size:8, keys:4, time:28, seed:18539, name:'Noisy Head' },
  { size:9, keys:4, time:29, seed:19661, name:'Ninth Square' },
  { size:9, keys:5, time:27, seed:20741, name:'Final Recall' }
];

export const DIRS = {
  up:{dr:-1,dc:0}, down:{dr:1,dc:0}, left:{dr:0,dc:-1}, right:{dr:0,dc:1}
};
export const keyFor=(r,c)=>`${r},${c}`;
export const edgeKey=(r1,c1,r2,c2)=>{const a=keyFor(r1,c1),b=keyFor(r2,c2);return a<b?`${a}|${b}`:`${b}|${a}`;};

export function seededRng(seed){
  let t=seed>>>0;
  return ()=>{
    t+=0x6D2B79F5;
    let x=Math.imul(t^(t>>>15),1|t);
    x^=x+Math.imul(x^(x>>>7),61|x);
    return ((x^(x>>>14))>>>0)/4294967296;
  };
}

export function generateMaze(size,seed){
  const rand=seededRng(seed), seen=new Set([keyFor(0,0)]), passages=new Set(), stack=[[0,0]];
  while(stack.length){
    const [r,c]=stack.at(-1), choices=[];
    for(const {dr,dc} of Object.values(DIRS)){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<size&&nc>=0&&nc<size&&!seen.has(keyFor(nr,nc))) choices.push([nr,nc]);
    }
    if(!choices.length){stack.pop();continue;}
    const [nr,nc]=choices[Math.floor(rand()*choices.length)];
    seen.add(keyFor(nr,nc)); passages.add(edgeKey(r,c,nr,nc)); stack.push([nr,nc]);
  }
  const candidates=[];
  for(let r=0;r<size;r++)for(let c=0;c<size;c++)for(const {dr,dc} of [{dr:1,dc:0},{dr:0,dc:1}]){
    const nr=r+dr,nc=c+dc;if(nr>=size||nc>=size)continue;
    const e=edgeKey(r,c,nr,nc);if(!passages.has(e))candidates.push([e]);
  }
  candidates.sort(()=>rand()-.5);
  const extra=Math.floor(size*(size>6?.8:.45));
  for(let i=0;i<Math.min(extra,candidates.length);i++)passages.add(candidates[i][0]);
  const walls=new Set();
  for(let r=0;r<size;r++)for(let c=0;c<size;c++){
    if(c<size-1&&!passages.has(edgeKey(r,c,r,c+1)))walls.add(edgeKey(r,c,r,c+1));
    if(r<size-1&&!passages.has(edgeKey(r,c,r+1,c)))walls.add(edgeKey(r,c,r+1,c));
  }
  return walls;
}

export function bfsDistances(size,start,walls){
  const dist=new Map([[keyFor(start.r,start.c),0]]), q=[[start.r,start.c]];
  for(let i=0;i<q.length;i++){
    const [r,c]=q[i], d=dist.get(keyFor(r,c));
    for(const {dr,dc} of Object.values(DIRS)){
      const nr=r+dr,nc=c+dc;
      if(nr<0||nr>=size||nc<0||nc>=size||walls.has(edgeKey(r,c,nr,nc)))continue;
      const k=keyFor(nr,nc);if(!dist.has(k)){dist.set(k,d+1);q.push([nr,nc]);}
    }
  }
  return dist;
}

function pickFarthest(dist,used,minDistance){
  const list=[];
  for(const [k,d] of dist){ if(used.has(k)||d<minDistance)continue; const [r,c]=k.split(',').map(Number);list.push({r,c,k,d}); }
  list.sort((a,b)=>b.d-a.d);
  if(list[0])return list[0];
  for(const [k,d] of dist){if(!used.has(k)){const [r,c]=k.split(',').map(Number);return{r,c,k,d};}}
}

export function createLevel(index){
  const baseSpec=LEVELS[index];
  const spec={...baseSpec, time: 45 + (index * 10)};
  const start={r:0,c:0}, walls=generateMaze(spec.size,spec.seed), dist=bfsDistances(spec.size,start,walls), used=new Set([keyFor(0,0)]), keys=[];
  for(let i=0;i<spec.keys;i++){const p=pickFarthest(dist,used,Math.max(1,Math.floor(spec.size*.8)+i));keys.push({r:p.r,c:p.c,id:i});used.add(p.k);}
  const exitPick=pickFarthest(dist,used,Math.max(2,spec.size));
  return {spec,start,player:{...start},exit:{r:exitPick.r,c:exitPick.c},keys,walls,visited:new Set([keyFor(0,0)]),collected:new Set(),moves:0,remaining:spec.time};
}
