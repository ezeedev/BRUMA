export const TYPES=[null,{name:'Pasto',color:[.43,.60,.30],side:[.43,.36,.23],top:[.55,.69,.36]},{name:'Piedra',color:[.52,.57,.55]},{name:'Madera',color:[.49,.34,.22]},{name:'Hojas',color:[.32,.52,.29]},{name:'Arena',color:[.79,.74,.55]},{name:'Cristal',color:[.41,.82,.77]},{name:'Tablones',color:[.67,.45,.26]},{name:'Mesa de trabajo',color:[.56,.37,.22]},{name:'Carbón',color:[.18,.21,.23]},{name:'Hierro',color:[.65,.56,.45]},{name:'Cobre',color:[.74,.43,.27]},{name:'Oro',color:[.83,.69,.26]},{name:'Diamante',color:[.26,.77,.79]},{name:'Ladrillos',color:[.63,.33,.28]},{name:'Vidrio',color:[.75,.88,.88]},{name:'Antorcha',color:[.92,.65,.23]},{name:'Horno',color:[.37,.40,.38]},{name:'Cofre',color:[.58,.36,.18]},{name:'Escalera',color:[.66,.45,.28]},{name:'Piedra tallada',color:[.54,.55,.53]},{name:'Lana',color:[.86,.85,.76]},{name:'Arcilla',color:[.59,.65,.66]}];
export const key=(x,y,z)=>`${x},${y},${z}`;
export const CHUNK=16;
const hash=(x,z)=>{let n=Math.imul(x,374761393)+Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const smooth=t=>t*t*(3-2*t);
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(x-a),v=smooth(z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
export function terrainHeight(x,z){return Math.floor(5+(noise(x/85,z/85)-.5)*25+(noise(x/29+18,z/29)-.5)*13+(noise(x/9,z/9)-.5)*3);}
export function createWorld(edits={}){
 const blocks=new Map(),loaded=new Set();let revision=0;
 const get=(x,y,z)=>blocks.get(key(x,y,z))||0;
 const set=(x,y,z,t)=>{const k=key(x,y,z);if(t)blocks.set(k,t);else blocks.delete(k);revision++;};
 const surface=(x,z)=>terrainHeight(Math.floor(x),Math.floor(z));
 function chunk(cx,cz){const id=`${cx},${cz}`;if(loaded.has(id))return false;loaded.add(id);const x0=cx*CHUNK,z0=cz*CHUNK;
 for(let x=x0;x<x0+CHUNK;x++)for(let z=z0;z<z0+CHUNK;z++){
 const h=surface(x,z),sand=h<1;
 for(let y=h-4;y<=h;y++){let t=y===h?(sand?5:1):2;if(y<h-1){const ore=hash(x*3+y*17,z*7-y*13);if(ore>.991)t=13;else if(ore>.975)t=9;else if(ore>.963)t=10;else if(ore>.95)t=11;else if(ore>.938)t=12;}set(x,y,z,t);}
 }
 // Trees use world coordinates, so chunk boundaries remain deterministic.
 for(let x=x0-3;x<x0+CHUNK+3;x++)for(let z=z0-3;z<z0+CHUNK+3;z++){
 if(hash(x+31,z-19)>.008||surface(x,z)<2)continue;
 const h=surface(x,z),th=4+Math.floor(hash(x,z)*3);
 for(let j=1;j<=th;j++)if(x>=x0&&x<x0+CHUNK&&z>=z0&&z<z0+CHUNK)set(x,h+j,z,3);
 for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let j=th-1;j<=th+1;j++){
 const xx=x+a,zz=z+b;if(xx<x0||xx>=x0+CHUNK||zz<z0||zz>=z0+CHUNK||Math.abs(a)+Math.abs(b)>3)continue;
 if(!get(xx,h+j,zz))set(xx,h+j,zz,4);
 }
 }
 for(let x=x0;x<x0+CHUNK;x++)for(let z=z0;z<z0+CHUNK;z++)if(hash(x+92,z+81)>.997){const y=surface(x,z);if(get(x,y,z)===1)set(x,y+1,z,6);}
 for(const [k,t]of Object.entries(edits)){const [x,y,z]=k.split(',').map(Number);if(Math.floor(x/CHUNK)===cx&&Math.floor(z/CHUNK)===cz)set(x,y,z,t);}
 return true;
 }
 function stream(px,pz,radius=1){const cx=Math.floor(px/CHUNK),cz=Math.floor(pz/CHUNK);let changed=false;
 for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)changed=chunk(cx+dx,cz+dz)||changed;
 for(const id of [...loaded]){const [x,z]=id.split(',').map(Number);if(Math.abs(x-cx)>radius||Math.abs(z-cz)>radius){loaded.delete(id);for(const k of blocks.keys()){const [bx,,bz]=k.split(',').map(Number);if(Math.floor(bx/CHUNK)===x&&Math.floor(bz/CHUNK)===z)blocks.delete(k);}changed=true;}}
 return changed;
 }
 const creatures=[];function fauna(px,pz){creatures.length=0;const cx=Math.floor(px/16),cz=Math.floor(pz/16);for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){let x=(cx+a)*16+Math.floor(hash(cx+a,cz+b)*14)+1,z=(cz+b)*16+Math.floor(hash(cx+a+91,cz+b+71)*14)+1;if(surface(x,z)<1)continue;const species=['oveja','vaca','cerdo','lobo','zombi'][Math.floor(hash(x+51,z+18)*5)];creatures.push({x,y:surface(x,z)+1,z,species,seed:hash(x,z)});}return creatures;}return {blocks,get,set,surface,stream,fauna,creatures,get revision(){return revision;}};
}
export function raycast(world,origin,dir,max=7){let [x,y,z]=origin.map(Math.floor);const step=dir.map(v=>v>=0?1:-1),delta=dir.map(v=>Math.abs(v)<1e-9?Infinity:Math.abs(1/v)),tmax=dir.map((v,i)=>Math.abs(v)<1e-9?Infinity:((step[i]>0?Math.floor(origin[i])+1:Math.floor(origin[i]))-origin[i])/v);let dist=0,normal=[0,0,0];while(dist<=max){if(world.get(x,y,z))return{x,y,z,normal,t:world.get(x,y,z)};const axis=tmax[0]<tmax[1]?(tmax[0]<tmax[2]?0:2):(tmax[1]<tmax[2]?1:2);dist=tmax[axis];tmax[axis]+=delta[axis];normal=[0,0,0];normal[axis]=-step[axis];if(axis===0)x+=step[0];else if(axis===1)y+=step[1];else z+=step[2];}return null;}
export function collides(world,p){const r=.29;for(let x=Math.floor(p[0]-r);x<=Math.floor(p[0]+r);x++)for(let y=Math.floor(p[1]+.015);y<=Math.floor(p[1]+1.75);y++)for(let z=Math.floor(p[2]-r);z<=Math.floor(p[2]+r);z++)if(world.get(x,y,z))return true;return false;}
