import {TYPES, key, collides} from './world.js';

// Old creative saves keep their world and begin with an empty backpack.
export function loadInventory(saved) {
  const inventory = Array(TYPES.length).fill(0);
  if (saved?.version >= 2 && Array.isArray(saved.inventory)) {
    for (let type = 1; type < TYPES.length; type++) {
      const count = saved.inventory[type];
      if (Number.isSafeInteger(count) && count >= 0) inventory[type] = count;
    }
  }
  return inventory;
}

// Commit world, edit log and inventory together, only after validation.
export function applyBlockAction({world, edits, inventory, position, hit, selected, place}) {
  if (!hit || !world.get(hit.x, hit.y, hit.z)) return {error:'reach'};
  let {x,y,z} = hit;
  const type = place ? selected : world.get(x,y,z);
  if (!TYPES[type]) return {error:'material'};
  if (place) {
    if (!inventory[type]) return {error:'empty'};
    x += hit.normal[0]; y += hit.normal[1]; z += hit.normal[2];
    if (Math.abs(x)>100000 || Math.abs(z)>100000 || y>160 || y < -80) return {error:'bounds'};
    if (world.get(x,y,z)) return {error:'occupied'};
    world.set(x,y,z,type);
    if (collides(world,position)) {
      world.set(x,y,z,0);
      return {error:'collision'};
    }
    inventory[type]--;
  } else {
    if (inventory[type] >= Number.MAX_SAFE_INTEGER) return {error:'full'};
    world.set(x,y,z,0);
    inventory[type]++;
  }
  edits[key(x,y,z)] = place ? type : 0;
  return {type, delta:place ? -1 : 1};
}
