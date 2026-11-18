import {createWorld,TYPES,key,raycast,collides} from './world.js';
import {Renderer,SoftwareRenderer,direction} from './engine.js';
import {loadInventory,applyBlockAction} from './inventory.js';
const $=id=>document.getElementById(id);
let canvas=$('world'),renderer;
try{
 renderer=new Renderer(canvas);
}catch(webglError){
 console.warn('[BRUMA] WebGL no pudo iniciarse; intentando renderizador 2D:',webglError);
 // Un canvas que ya obtuvo un contexto WebGL no puede cambiarse a 2D.
 // Reemplazamos el elemento para que el modo alternativo tenga un canvas nuevo.
 const replacement=document.createElement('canvas');
 replacement.id=canvas.id;
 replacement.className=canvas.className;
 replacement.style.cssText=canvas.style.cssText;
 canvas.replaceWith(replacement);
 canvas=replacement;
 try{renderer=new SoftwareRenderer(canvas);}
 catch(fallbackError){
  console.error('[BRUMA] Fallaron ambos renderizadores:',fallbackError);
  $('error').hidden=false;
  $('error').querySelector('p').textContent='No se pudo iniciar WebGL ni el modo gráfico alternativo. Abrí la consola (F12) para ver el error técnico.';
  throw fallbackError;
 }
}
let world=createWorld(),edits={},saveTimer,selected=1,playing=false,started=false,yaw=0,pitch=-.12,hit=null,grounded=false,velocity=0,last=0,drag=null,steps=0,lastMine=0;
const pos=[0,8,7],keys=new Set(),touch=matchMedia('(pointer:coarse)').matches;
const STORE='bruma-world-v1';
let saved;try{saved=JSON.parse(localStorage.getItem(STORE)||'null');}catch{saved=null;}
// Old floating-island edits are intentionally not applied to the new terrain.
if(saved?.version===3&&saved.edits&&typeof saved.edits==='object')edits=saved.edits;
world=createWorld(edits);
let hotbarSlots=Array.isArray(saved?.hotbarSlots)&&saved.hotbarSlots.length===10?saved.hotbarSlots.map(v=>Number.isInteger(v)&&v>0&&v<TYPES.length?v:0):Array(10).fill(0),activeSlot=0,inventory=loadInventory(saved),chests={...(saved?.chests||{})},extras={...(saved?.extras||{})},dayClock=saved?.dayClock||0,weather='Despejado',mineProgress=0,mineKey='',mineStart=0,health=100,hunger=100,tools={pico:0,hacha:0},durability={pico:0,hacha:0},activeTool='mano',hungerClock=0,fallSpeed=0,dead=false;
if(saved?.version===3){health=Math.max(1,Math.min(100,saved.health||100));hunger=Math.max(0,Math.min(100,saved.hunger??100));tools={...tools,...saved.tools};durability={...durability,...saved.durability};activeTool=saved.activeTool||'mano';}
function spawn(){pos[0]=.5;pos[2]=7.5;world.stream(pos[0],pos[2]);pos[1]=world.surface(0,7)+1.03;while(collides(world,pos)&&pos[1]<150)pos[1]++;velocity=0;grounded=false;fallSpeed=0;yaw=0;pitch=-.12;}
spawn();if(saved?.version===3&&saved?.position?.length===3&&saved.position.every(Number.isFinite)&&saved.position.every(n=>Math.abs(n)<100000)){world.stream(saved.position[0],saved.position[2]);if(!collides(world,saved.position)){pos.splice(0,3,...saved.position);yaw=Number(saved.yaw)||0;pitch=Number(saved.pitch)||0;}}
renderer.rebuild(world);world.fauna(pos[0],pos[2]);
function notify(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function save(){try{localStorage.setItem(STORE,JSON.stringify({version:3,edits,inventory,hotbarSlots,chests,extras,dayClock,position:pos,yaw,pitch,health,hunger,tools,durability,activeTool}));}catch{notify('El navegador no permite guardar. Este progreso es temporal.');}}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,400);}
function blockIcon(type){return `<span class="block-icon" style="--c:rgb(${(TYPES[type].top||TYPES[type].color).map(c=>Math.round(c*255)).join(',')})"></span>`;}
for(let i=0;i<10;i++){const b=document.createElement('button');b.className='slot';b.innerHTML=`<kbd>${i===9?'0':i+1}</kbd><span class="slot-item"></span><span class="slot-count"></span>`;b.onclick=()=>selectSlot(i);b.addEventListener('dragover',e=>e.preventDefault());b.addEventListener('drop',e=>{e.preventDefault();const type=Number(e.dataTransfer.getData('text/plain'));if(type>0&&inventory[type]>0){hotbarSlots[i]=type;selectSlot(i);queueSave();}});$('hotbar').append(b);}
for(let i=1;i<TYPES.length;i++){const card=document.createElement('button');card.className='material-card';card.innerHTML=`${blockIcon(i)}<span class="material-label">${TYPES[i].name}<small>Clic para equipar</small></span><strong>0</strong>`;card.onclick=()=>equipMaterial(i);card.draggable=true;card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));});$('inventory-grid').append(card);}
function equipMaterial(type){if(!inventory[type]){notify('Primero recolectá '+TYPES[type].name.toLowerCase());return;}let slot=hotbarSlots.indexOf(type);if(slot<0){slot=hotbarSlots.indexOf(0);if(slot<0)slot=activeSlot;hotbarSlots[slot]=type;}activeSlot=slot;selected=type;updateInventory();queueSave();}
function selectSlot(slot){activeSlot=(slot+10)%10;selected=hotbarSlots[activeSlot]||0;updateInventory();}
function select(n){selectSlot(n-1);}
function updateInventory(){
 const total=inventory.reduce((sum,n)=>sum+n,0)+Object.values(extras).reduce((a,b)=>a+b,0);
 for(let i=0;i<10;i++){const b=$('hotbar').children[i],type=hotbarSlots[i];if(type&&inventory[type]===0){hotbarSlots[i]=0;}const t=hotbarSlots[i];b.classList.toggle('active',i===activeSlot);b.classList.toggle('empty',!t);b.querySelector('.slot-item').innerHTML=t?blockIcon(t):'';b.querySelector('.slot-count').textContent=t?Math.min(inventory[t],64):'';b.title=t?TYPES[t].name:'Casilla vacía';b.setAttribute('aria-label',b.title);}
 selected=hotbarSlots[activeSlot]||0;
 for(let i=1;i<TYPES.length;i++){const card=$('inventory-grid').children[i-1];const label=`${TYPES[i].name}: ${inventory[i]}`;card.title=label;card.setAttribute('aria-label',label);card.classList.toggle('active',i===selected);card.classList.toggle('empty',inventory[i]===0);card.querySelector('strong').textContent=inventory[i]>64?`${Math.floor(inventory[i]/64)}×64 + ${inventory[i]%64}`:inventory[i];}
 $('selected-name').textContent=selected?`${TYPES[selected].name} · ${inventory[selected]}`:'Mano vacía';
 $('inventory-total').textContent=`${total} recursos recolectados`;$('inventory-empty').hidden=total>0;$('inventory-badge').textContent=total;
 $('inventory-selected').textContent=selected?`Equipado: ${TYPES[selected].name}`:'Elegí un material de la mochila para equiparlo en la barra rápida.';
 $('place-mobile').disabled=!selected||inventory[selected]===0;
}
updateInventory();
function showPickup(type){if(!hotbarSlots.includes(type)){const empty=hotbarSlots.indexOf(0);if(empty>=0){hotbarSlots[empty]=type;}}
 $('pickup').textContent=`+1 ${TYPES[type].name} · ${inventory[type]} en tu mochila`;
 $('pickup').classList.remove('visible');void $('pickup').offsetWidth;$('pickup').classList.add('visible');
 clearTimeout(showPickup.timer);showPickup.timer=setTimeout(()=>$('pickup').classList.remove('visible'),1600);
}
function openInventory(){
 if(!started)return;playing=false;keys.clear();drag=null;
 $('pause').hidden=true;$('crafting-modal').hidden=true;$('inventory').hidden=false;$('mobile').hidden=true;
 document.exitPointerLock?.();updateInventory();save();$('inventory-close').focus();
}
function toggleInventory(){if($('inventory').hidden)openInventory();else play();}
$('inventory-open').onclick=openInventory;$('inventory-close').onclick=play;
function lock(){if(!touch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();r?.catch(()=>notify('Arrastrá el paisaje para mirar alrededor.'));}catch{notify('Arrastrá el paisaje para mirar alrededor.');}}}
function play(){started=true;playing=true;$('menu').hidden=true;$('pause').hidden=true;$('inventory').hidden=true;$('crafting-modal').hidden=true;if(document.getElementById('chest-modal'))$('chest-modal').hidden=true;$('hud').hidden=false;$('mobile').hidden=!touch;document.body.classList.add('playing');keys.clear();document.activeElement?.blur();lock();setTimeout(()=>$('tip').style.opacity=0,10000);}
function pause(){stopMining();$('inventory').hidden=true;$('crafting-modal').hidden=true;if(document.getElementById('chest-modal'))$('chest-modal').hidden=true;if(!started){$('pause').hidden=false;return;}playing=false;keys.clear();drag=null;$('pause').hidden=false;$('mobile').hidden=true;document.exitPointerLock?.();save();}
$('play').onclick=play;$('resume').onclick=play;$('help').onclick=pause;$('show-controls').onclick=pause;
$('home').onclick=()=>{spawn();world.fauna(pos[0],pos[2]);renderer.rebuild(world);save();notify('De vuelta al inicio.');};
$('reset').onclick=()=>{if(!confirm('¿Empezar de nuevo? Se borrarán las construcciones y el inventario de este mundo.'))return;edits={};world=createWorld(edits);inventory=loadInventory(null);hotbarSlots=Array(10).fill(0);activeSlot=0;selected=0;extras={};chests={};dayClock=0;health=100;hunger=100;tools={pico:0,hacha:0};durability={pico:0,hacha:0};activeTool='mano';steps=0,lastMine=0;updateInventory();renderer.rebuild(world);spawn();world.fauna(pos[0],pos[2]);save();notify('Un mundo nuevo para vos.');play();};
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!touch&&$('crafting-modal').hidden)pause();});
document.addEventListener('mousemove',e=>{if(playing&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
function look(dx,dy){yaw-=dx*.0025;pitch=Math.max(-1.48,Math.min(1.48,pitch-dy*.0025));}
let miningHeld=null;function stopMining(){clearInterval(miningHeld);miningHeld=null;mineKey='';$('mining-progress').style.width='0%';}canvas.addEventListener('pointerdown',e=>{if(!playing)return;if(document.pointerLockElement===canvas){edit(e.button===2);if(e.button===0){stopMining();miningHeld=setInterval(()=>{if(playing)edit(false);else stopMining();},90);}return;}drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0,button:e.button};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!playing||document.pointerLockElement===canvas||!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);look(dx,dy);drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',()=>{stopMining();if(drag&&drag.moved<5&&!touch)edit(drag.button===2);drag=null;});canvas.addEventListener('pointercancel',()=>{stopMining();drag=null;});window.addEventListener('pointerup',stopMining);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('wheel',e=>{if(playing){e.preventDefault();selectSlot(activeSlot+(e.deltaY>0?1:-1));}},{passive:false});
const aliases={ArrowUp:'KeyW',ArrowDown:'KeyS',ArrowLeft:'KeyA',ArrowRight:'KeyD'};
window.addEventListener('keydown',e=>{if(e.code==='KeyE'&&started&&!e.repeat){e.preventDefault();if(!$('crafting-modal').hidden||!$('chest-modal').hidden)play();else toggleInventory();return;}if(e.code==='Escape'){if(!$('crafting-modal').hidden||!$('chest-modal').hidden){play();return;}if(playing)pause();else if(started)play();else $('pause').hidden=true;return;}if(!$('inventory').hidden&&/^Digit[0-9]$/.test(e.code)){selectSlot((Number(e.code.slice(-1))+9)%10);return;}if(!playing)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(aliases[e.code]||e.code);if(/^Digit[0-9]$/.test(e.code))selectSlot((Number(e.code.slice(-1))+9)%10);if(e.code==='KeyR'&&!e.repeat){spawn();queueSave();notify('De vuelta en la isla inicial.');}});
window.addEventListener('keyup',e=>keys.delete(aliases[e.code]||e.code));window.addEventListener('blur',()=>{keys.clear();if(playing)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();if(playing)pause();}});window.addEventListener('pagehide',save);
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(b.dataset.key));});$('break-mobile').onclick=()=>edit(false);$('place-mobile').onclick=()=>edit(true);
function edit(place){
 if(!playing)return;if(!place)swingHand();
 hit=raycast(world,[pos[0],pos[1]+1.6,pos[2]],direction(yaw,pitch));
 if(!place&&hit&&world.get(hit.x,hit.y,hit.z)===8){openCrafting();return;}if(!place&&hit&&world.get(hit.x,hit.y,hit.z)===18){openChest(hit);return;}if(place&&!selected){notify('Seleccioná un bloque de tu mochila (E).');return;}if(!place&&hit){const t=world.get(hit.x,hit.y,hit.z),ideal=[3,4,7,8,18,19].includes(t)?'hacha':'pico',equipped=activeTool===ideal&&durability[ideal]>0;const delay=equipped?([2,9,10,11,12,13].includes(t)?420:230):([2,9,10,11,12,13].includes(t)?1200:650);const now=performance.now(),id=key(hit.x,hit.y,hit.z);if(mineKey!==id||now-mineStart>2200){mineKey=id;mineStart=now;}mineProgress=Math.min(100,(now-mineStart)/delay*100);$('mining-progress').style.width=mineProgress+'%';if(now-mineStart<delay)return;mineStart=now;mineProgress=0;$('mining-progress').style.width='0%';}const result=applyBlockAction({world,edits,inventory,position:pos,hit,selected,place});
 if(result.error){
  const messages={reach:'Acercate y apuntá a un bloque.',empty:`No tenés ${TYPES[selected].name.toLowerCase()}. Rompé bloques de ese material para recolectarlo.`,bounds:'Límite de altura alcanzado.',occupied:'Ese lugar ya tiene un bloque.',collision:'Dejá un poco de espacio para moverte.',full:'No queda espacio para más unidades de este material.',material:'Elegí un material de la barra.'};
  notify(messages[result.error]);return;
 }
 renderer.rebuild(world);updateInventory();queueSave();
 if(!place){showPickup(result.type);if(activeTool!=='mano'&&durability[activeTool]>0){durability[activeTool]--;if(!durability[activeTool]){tools[activeTool]=Math.max(0,tools[activeTool]-1);activeTool='mano';notify('Tu herramienta se rompió.');}}updateSurvival();}
 steps++;
 if(steps===1){$('tip').textContent=place?'Tu material ahora forma parte del mundo.':'¡+1 en tu mochila! Seleccioná ese material y colocá un bloque.';$('tip').style.opacity=1;setTimeout(()=>$('tip').style.opacity=0,6500);}
}
function update(dt){let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const len=Math.hypot(forward,side)||1;forward/=len;side/=len;const speed=4.4;const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*dt,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*dt;
 if(keys.has('Space')&&grounded){velocity=7.7;grounded=false;}velocity=Math.max(-25,velocity-22*dt);if(velocity<0)fallSpeed=Math.max(fallSpeed,-velocity);
 for(const [axis,d]of [[0,dx],[2,dz],[1,velocity*dt]]){if(!d)continue;const old=pos[axis];pos[axis]+=d;if(collides(world,pos)){pos[axis]=old;if(axis===1){if(d<0&&!grounded&&fallSpeed>12)takeDamage(Math.ceil((fallSpeed-12)*3));grounded=d<0;velocity=0;fallSpeed=0;}}else if(axis===1)grounded=false;}
 if(pos[1]<-80){takeDamage(100);}
 if(world.stream(pos[0],pos[2])){renderer.rebuild(world);world.fauna(pos[0],pos[2]);}dayClock=(dayClock+dt)%720;weather=(Math.sin(dayClock/720*6.283*3)>.93?'Lluvia':'Despejado');updateCreatures(dt);hungerClock+=dt;if(hungerClock>12){hungerClock=0;hunger=Math.max(0,hunger-1);if(hunger===0)takeDamage(2);else if(hunger>75&&health<100)health=Math.min(100,health+1);updateSurvival();}hit=raycast(world,[pos[0],pos[1]+1.6,pos[2]],direction(yaw,pitch));$('target').textContent=hit?TYPES[hit.t].name:'';$('coords').textContent=pos.map(Math.floor).join(' / ')+' · '+(dayClock<360?'Día':'Noche')+' · '+weather;
}
function frame(ms){const elapsed=Math.min((ms-last)/1000,.05)||.016;last=ms;animateHand(ms);if(playing){let dt=elapsed;while(dt>0){const step=Math.min(dt,1/120);update(step);dt-=step;}}
 if(started)renderer.render([pos[0],pos[1]+1.6,pos[2]],yaw,pitch,ms/1000,playing?hit:null,world.creatures,dayClock);else{const a=.66+Math.sin(ms*.000035)*.06;renderer.render([Math.sin(a)*43,24,Math.cos(a)*43],a,-.38,ms/1000,null);}requestAnimationFrame(frame);}
requestAnimationFrame(frame);setInterval(()=>{if(playing)save();},10000);

document.addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const modal=!$('inventory').hidden?$('inventory'):!$('pause').hidden?$('pause'):null;
 if(!modal)return;
 const items=[...modal.querySelectorAll('button:not([disabled])')],first=items[0],last=items[items.length-1];
 if(e.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){e.preventDefault();first.focus();}
});

// BRUMA 0.5: crafting and survival are integrated into the existing inventory.
const oldRecipes=[{name:'4 tablones',cost:{3:1},give:{7:4}},{name:'Mesa de trabajo',cost:{7:4},give:{8:1}},{name:'Pico de piedra',cost:{2:3,7:2},tool:'pico'},{name:'Hacha de piedra',cost:{2:3,7:2},tool:'hacha'}];
const recipes=[{name:'4 tablones',cost:{3:1},give:{7:4}},{name:'Mesa de trabajo',cost:{7:4},give:{8:1}},{name:'Pico de piedra',cost:{2:3,7:2},tool:'pico'},{name:'Hacha de piedra',cost:{2:3,7:2},tool:'hacha'},{name:'Horno',cost:{2:8},give:{17:1}},{name:'Cofre',cost:{7:8},give:{18:1}},{name:'Escaleras x4',cost:{7:6},give:{19:4}},{name:'Ladrillos x4',cost:{2:4},give:{14:4}},{name:'Vidrio x4',cost:{5:4,9:1},give:{15:4}},{name:'Antorchas x4',cost:{3:1,9:1},give:{16:4}},{name:'Piedra tallada x4',cost:{2:4},give:{20:4}},{name:'Lana x2',cost:{4:4},give:{21:2}},{name:'Arcilla x2',cost:{5:2,2:1},give:{22:2}},{name:'Pico de hierro',cost:{10:3,7:2},tool:'pico',dur:170},{name:'Hacha de hierro',cost:{10:3,7:2},tool:'hacha',dur:170},{name:'Pico de diamante',cost:{13:3,7:2},tool:'pico',dur:320},{name:'Hacha de diamante',cost:{13:3,7:2},tool:'hacha',dur:320},{name:'Espada de piedra',cost:{2:2,7:1},extra:'espada'},{name:'Espada de hierro',cost:{10:2,7:1},extra:'espada hierro'},{name:'Pan x2',cost:{5:3},extra:'pan',amount:2},{name:'Sopa',cost:{4:2,7:1},extra:'sopa'},{name:'Cama',cost:{21:3,7:3},extra:'cama'},{name:'Puerta',cost:{7:6},extra:'puerta',amount:3},{name:'Valla x3',cost:{7:4},extra:'valla',amount:3},{name:'Barco',cost:{7:5},extra:'barco'},{name:'Escudo',cost:{7:6,10:1},extra:'escudo'},{name:'Arco',cost:{3:3,21:2},extra:'arco'},{name:'Flechas x4',cost:{2:1,3:1},extra:'flechas',amount:4}];
const panel=document.createElement('div');panel.className='crafting';panel.innerHTML='<h3>⚒ Fabricación</h3><p>Usá los materiales de tu mochila para crear objetos.</p><div id="recipes"></div><h3>Herramientas</h3><div id="tools"></div>';$('inventory-grid').after(panel);
function craft(recipe){if(!Object.entries(recipe.cost).every(([t,n])=>inventory[t]>=n)){notify('No tenés los materiales necesarios.');return;}for(const [t,n]of Object.entries(recipe.cost))inventory[t]-=n;if(recipe.tool){tools[recipe.tool]++;durability[recipe.tool]=recipe.dur||80;activeTool=recipe.tool;}else if(recipe.extra){extras[recipe.extra]=(extras[recipe.extra]||0)+(recipe.amount||1);}else for(const [t,n]of Object.entries(recipe.give))inventory[t]+=n;updateInventory();updateSurvival();queueSave();notify('Fabricaste: '+recipe.name);}
function updateSurvival(){const h=$('health-fill'),f=$('hunger-fill');if(h){h.style.width=health+'%';f.style.width=hunger+'%';$('health-text').textContent=Math.ceil(health);$('hunger-text').textContent=Math.ceil(hunger);}const r=$('recipes');if(r)r.innerHTML=recipes.map((v,i)=>`<button data-recipe="${i}" ${Object.entries(v.cost).every(([t,n])=>inventory[t]>=n)?'':'disabled'}>${v.name} <small>${Object.entries(v.cost).map(([t,n])=>`${n} ${TYPES[t].name}`).join(' + ')}</small></button>`).join('');const t=$('tools');if(t)t.innerHTML=['mano','pico','hacha'].map(name=>`<button data-tool="${name}" ${name!=='mano'&&(!tools[name]||!durability[name])?'disabled':''} class="${activeTool===name?'equipped':''}">${name==='mano'?'✋ Mano':name==='pico'?'⛏ Pico':'🪓 Hacha'} ${name==='mano'?'':`(${durability[name]||0}/80)`}</button>`).join('');}
panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.recipe!==undefined)craft(recipes[Number(b.dataset.recipe)]);if(b.dataset.tool){activeTool=b.dataset.tool;updateSurvival();queueSave();}});
function takeDamage(amount){if(dead)return;health=Math.max(0,health-amount);updateSurvival();if(health<=0){dead=true;notify('Caíste. La bruma te devuelve al comienzo.');spawn();renderer.rebuild(world);health=100;hunger=75;dead=false;queueSave();updateSurvival();}}
updateSurvival();

let craftingCells=Array(9).fill(0);
const craftModal=document.createElement('section');craftModal.id='crafting-modal';craftModal.className='modal-backdrop';craftModal.hidden=true;craftModal.innerHTML='<div class="panel craft-panel"><span class="eyebrow">BRUMA · TALLER</span><h2>⚒ Mesa de trabajo</h2><p>Fabricá herramientas, bloques, equipo y suministros con los recursos recolectados.</p><p>Seleccioná un material en cada casilla para crear una receta, o usá la lista de fabricación.</p><div class="craft-grid-preview" id="craft-grid-preview"></div><div id="grid-output"></div><div id="workbench-recipes"></div><h3>Otros objetos</h3><div id="extra-items"></div><button id="close-craft" class="primary">Volver al mundo →</button></div>';document.body.append(craftModal);
function openCrafting(){stopMining();playing=false;keys.clear();document.exitPointerLock?.();craftModal.hidden=false;$('mobile').hidden=true;updateWorkbench();}
function updateWorkbench(){const root=$('workbench-recipes');root.innerHTML=recipes.map((r,i)=>`<button class="craft-item" data-recipe="${i}" ${Object.entries(r.cost).every(([t,n])=>inventory[t]>=n)?'':'disabled'}><strong>${r.name}</strong><small>${Object.entries(r.cost).map(([t,n])=>n+' '+TYPES[t].name).join(' + ')}</small></button>`).join('');$('craft-grid-preview').innerHTML=craftingCells.map((t,i)=>`<button class="craft-cell" data-cell="${i}" title="Clic: siguiente material · Clic derecho: vaciar">${t?TYPES[t].name.slice(0,3):'+'}</button>`).join('');const count={};for(const t of craftingCells)if(t)count[t]=(count[t]||0)+1;const recipe=recipes.find(r=>Object.keys(count).length===Object.keys(r.cost).length&&Object.entries(r.cost).every(([t,n])=>count[t]===n));$('grid-output').innerHTML=recipe?`<button id="grid-craft" class="primary" ${Object.entries(recipe.cost).every(([t,n])=>inventory[t]>=n)?'':'disabled'}>Fabricar: ${recipe.name} →</button>`:'<small>Colocá los materiales de una receta en las 9 casillas.</small>';$('extra-items').textContent=Object.entries(extras).filter(([,n])=>n>0).map(([n,v])=>`${n}: ${v}`).join(' · ')||'Todavía no fabricaste equipo adicional.';}
craftModal.addEventListener('contextmenu',e=>{const b=e.target.closest('[data-cell]');if(b){e.preventDefault();craftingCells[Number(b.dataset.cell)]=0;updateWorkbench();}});craftModal.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='close-craft'){play();return;}if(b.dataset.cell!==undefined){const i=Number(b.dataset.cell),available=[0,...TYPES.slice(1).map((_,n)=>n+1).filter(t=>inventory[t]>0)];craftingCells[i]=available[(available.indexOf(craftingCells[i])+1)%available.length];updateWorkbench();return;}if(b.id==='grid-craft'){const count={};for(const t of craftingCells)if(t)count[t]=(count[t]||0)+1;const recipe=recipes.find(r=>Object.keys(count).length===Object.keys(r.cost).length&&Object.entries(r.cost).every(([t,n])=>count[t]===n));if(recipe){craft(recipe);craftingCells.fill(0);updateWorkbench();}return;}if(b.dataset.recipe!==undefined){craft(recipes[Number(b.dataset.recipe)]);updateWorkbench();}};
const foodButton=document.createElement('button');foodButton.textContent='🍞 Comer pan (+25 hambre)';foodButton.className='craft-item';foodButton.onclick=()=>{if((extras.pan||0)<1){notify('Fabricá pan primero.');return;}extras.pan--;hunger=Math.min(100,hunger+25);updateSurvival();updateWorkbench();queueSave();};craftModal.querySelector('.craft-panel').insertBefore(foodButton,$('close-craft'));
const mineBar=document.createElement('div');mineBar.id='mining-track';mineBar.innerHTML='<span id="mining-progress"></span>';document.body.append(mineBar);

// First-person arm: animated swing, walking bob and equipped item indicator.
const hand=document.createElement('div');hand.id='first-person-hand';hand.innerHTML='<div id="held-tool-model"></div><div class="hand-sleeve"></div><div class="hand-wrist"></div><div class="hand-palm"></div><div class="hand-fingers"></div><div id="held-item"></div>';document.body.append(hand);
let swingUntil=0;function swingHand(){swingUntil=performance.now()+320;}
function animateHand(ms){if(!hand)return;hand.hidden=!playing;const walking=playing&&(keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD'));const bob=walking?Math.sin(ms*.012)*9:Math.sin(ms*.0017)*2;const swing=Math.max(0,(swingUntil-ms)/320);const angle=swing>0?Math.sin((1-swing)*Math.PI)*-48:0;hand.style.transform=`translateY(${bob+Math.max(0,angle)*.2}px) rotate(${angle}deg)`;const toolModel=$('held-tool-model');if(toolModel){toolModel.className=activeTool==='pico'?'tool-pick':activeTool==='hacha'?'tool-axe':'';toolModel.hidden=activeTool==='mano';}const held=$('held-item');if(held){held.style.display=selected?'block':'none';held.style.background=selected?`rgb(${(TYPES[selected].top||TYPES[selected].color).map(v=>Math.round(v*255)).join(',')})`:'';}}

// Chest storage, persistent per world coordinate; no destructive migration.
const chestModal=document.createElement('section');chestModal.id='chest-modal';chestModal.className='modal-backdrop';chestModal.hidden=true;chestModal.innerHTML='<div class="panel craft-panel"><span class="eyebrow">BRUMA · ALMACENAMIENTO</span><h2>📦 Cofre</h2><p>Guardá y retirá materiales. Cada cofre tiene su propio contenido.</p><div id="chest-items"></div><button class="primary" id="close-chest">Volver al mundo →</button></div>';document.body.append(chestModal);
let currentChest='';function openChest(hit){stopMining();playing=false;keys.clear();document.exitPointerLock?.();currentChest=key(hit.x,hit.y,hit.z);chests[currentChest]??={};chestModal.hidden=false;$('mobile').hidden=true;drawChest();}
function drawChest(){const box=chests[currentChest]||{};$('chest-items').innerHTML=TYPES.slice(1).map((t,i)=>{const id=i+1;return `<div class="chest-row"><span>${t.name}</span><small>Mochila: ${inventory[id]} · Cofre: ${box[id]||0}</small><button data-put="${id}" ${inventory[id]<1?'disabled':''}>Guardar 1</button><button data-take="${id}" ${(box[id]||0)<1?'disabled':''}>Retirar 1</button></div>`}).join('');}
chestModal.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='close-chest'){chestModal.hidden=true;play();return;}const put=Number(b.dataset.put),take=Number(b.dataset.take),id=put||take;if(!id)return;const box=chests[currentChest];if(put&&inventory[id]>0){inventory[id]--;box[id]=(box[id]||0)+1;}else if(take&&box[id]>0){box[id]--;inventory[id]++;}updateInventory();drawChest();queueSave();};

let animalClock=0,attackClock=0;function updateCreatures(dt){animalClock+=dt;attackClock+=dt;for(const a of world.creatures){const dx=pos[0]-a.x,dz=pos[2]-a.z,d=Math.hypot(dx,dz)||1;let vx=Math.sin(animalClock*.31+a.seed*42),vz=Math.cos(animalClock*.27+a.seed*52),speed=.17;if(a.species==='zombi'&&dayClock>360&&d<13){vx=dx/d;vz=dz/d;speed=.65;if(d<1.7&&attackClock>2.2){takeDamage(5);attackClock=0;notify('¡Un zombi te golpeó!');}}else if(a.species!=='zombi'&&d<3){vx=-dx/d;vz=-dz/d;speed=.9;}a.x+=vx*dt*speed;a.z+=vz*dt*speed;a.y=world.surface(Math.floor(a.x),Math.floor(a.z))+1;}}
