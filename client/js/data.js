// The Gilded Wake — game data: items, ships, shops, recipes, building pieces.
const ITEMS = {
  cutlass:  { n: 'Cutlass', cat: 'melee', dmg: 32, spd: 0.45, rng: 2.5, price: 150, w: 2 },
  dagger:   { n: 'Dagger', cat: 'melee', dmg: 19, spd: 0.27, rng: 2.0, price: 60, w: 1 },
  rapier:   { n: 'Rapier', cat: 'melee', dmg: 27, spd: 0.33, rng: 2.8, price: 280, w: 1.5 },
  axe:      { n: 'Boarding axe', cat: 'melee', dmg: 46, spd: 0.72, rng: 2.4, price: 220, w: 3, bdmg: 40 },
  pistol:   { n: 'Flintlock pistol', cat: 'gun', dmg: 48, rel: 2.4, rng: 50, spread: 0.012, pel: 1, price: 300, kick: 0.05, w: 1.5 },
  musket:   { n: 'Musket', cat: 'gun', dmg: 78, rel: 4.2, rng: 160, spread: 0.003, pel: 1, price: 650, kick: 0.09, ads: 1, w: 5 },
  blunder:  { n: 'Blunderbuss', cat: 'gun', dmg: 14, rel: 3.4, rng: 20, spread: 0.09, pel: 9, price: 520, kick: 0.15, w: 4 },
  shot:     { n: 'Lead shot', cat: 'ammo', price: 2, w: 0.02 },
  ball:     { n: 'Round shot', cat: 'cannon', price: 4, w: 0.1, ammo: 'ball', desc: 'Smashes hulls' },
  chain:    { n: 'Chain shot', cat: 'cannon', price: 10, w: 0.1, ammo: 'chain', desc: 'Shreds sails and masts' },
  grape:    { n: 'Grapeshot', cat: 'cannon', price: 8, w: 0.1, ammo: 'grape', desc: 'Short range, sweeps decks' },
  bomb:     { n: 'Explosive shell', cat: 'cannon', price: 25, w: 0.15, ammo: 'bomb', desc: 'Bursts and starts fires' },
  keg:      { n: 'Powder keg', cat: 'throw', price: 150, w: 6, desc: 'Floats. Explodes when a ship strikes it or it is shot' },
  dynamite: { n: 'Dynamite', cat: 'throw', price: 90, w: 0.5, desc: 'Three-second fuse. Breaks walls' },
  flare:    { n: 'Signal flare', cat: 'throw', price: 40, w: 0.3, desc: 'Lights the sky for every ship to see' },
  shovel:   { n: 'Shovel', cat: 'tool', price: 40, w: 2 },
  rod:      { n: 'Fishing rod', cat: 'tool', price: 60, w: 1 },
  hammer:   { n: 'Building hammer', cat: 'tool', price: 50, w: 1.5 },
  spyglass: { n: 'Spyglass', cat: 'tool', price: 120, w: 0.5 },
  bucket:   { n: 'Water bucket', cat: 'tool', price: 20, w: 1, desc: 'Douse fires aboard' },
  plank:    { n: 'Planks', cat: 'mat', price: 6, w: 0.5, desc: 'Patch hull holes' },
  wood:     { n: 'Timber', cat: 'mat', price: 2, w: 0.3 },
  metal:    { n: 'Iron', cat: 'mat', price: 8, w: 0.5 },
  rope:     { n: 'Rope', cat: 'mat', price: 4, w: 0.2 },
  cloth:    { n: 'Sailcloth', cat: 'mat', price: 5, w: 0.2, desc: 'Mend torn sails' },
  powder:   { n: 'Gunpowder', cat: 'mat', price: 6, w: 0.2 },
  rum:      { n: 'Rum', cat: 'drink', drunk: 0.3, heal: 6, price: 15, w: 0.8 },
  ale:      { n: 'Ale', cat: 'drink', drunk: 0.12, heal: 4, price: 8, w: 0.6 },
  cigar:    { n: 'Cigar', cat: 'smoke', price: 20, w: 0.05 },
  hardtack: { n: 'Hardtack', cat: 'food', heal: 14, price: 6, w: 0.2 },
  f_sardine:  { n: 'Sardine', cat: 'fish', heal: 4, sell: 6, cook: 'c_sardine', w: 0.2 },
  f_mackerel: { n: 'Mackerel', cat: 'fish', heal: 5, sell: 12, cook: 'c_mackerel', w: 0.5 },
  f_snapper:  { n: 'Red snapper', cat: 'fish', heal: 6, sell: 22, cook: 'c_snapper', w: 1 },
  f_tuna:     { n: 'Bluefin tuna', cat: 'fish', heal: 8, sell: 60, cook: 'c_tuna', w: 4 },
  f_sword:    { n: 'Swordfish', cat: 'fish', heal: 8, sell: 110, cook: 'c_sword', w: 6 },
  f_gold:     { n: 'Golden koi', cat: 'fish', heal: 5, sell: 900, w: 0.5, desc: 'Said to be lucky' },
  c_sardine:  { n: 'Grilled sardine', cat: 'food', heal: 15, sell: 10, w: 0.2 },
  c_mackerel: { n: 'Grilled mackerel', cat: 'food', heal: 22, sell: 18, w: 0.5 },
  c_snapper:  { n: 'Roast snapper', cat: 'food', heal: 32, sell: 30, w: 1 },
  c_tuna:     { n: 'Tuna steak', cat: 'food', heal: 50, sell: 80, w: 2 },
  c_sword:    { n: 'Swordfish steak', cat: 'food', heal: 60, sell: 140, w: 3 },
  coins:    { n: 'Silver trinkets', cat: 'treasure', sell: 120, w: 0.3 },
  gem:      { n: 'Gemstone', cat: 'treasure', sell: 350, w: 0.1 },
  jewel:    { n: 'Jewelled necklace', cat: 'treasure', sell: 650, w: 0.2 },
  idol:     { n: 'Golden idol', cat: 'treasure', sell: 1800, w: 4 },
  relic:    { n: 'Ancient relic', cat: 'treasure', sell: 4200, w: 3 },
  cargo:    { n: 'Merchant cargo', cat: 'treasure', sell: 420, w: 12, desc: 'Spices, silk and tea' },
  map:      { n: 'Treasure map', cat: 'map', w: 0.05 },
};
const ICON = { melee: '⚔', gun: '✦', ammo: '•', cannon: '●', throw: '✹', tool: '⚒', mat: '▤', drink: '⚱', smoke: '~', food: '◆', fish: '≈', treasure: '◈', map: '✗', gold: '◉' };

const SHIP_CLASSES = {
  rowboat: { n: 'Rowboat', price: 0, hp: 50, speed: 2.4, turn: 0.55, guns: 0, scale: 1, crew: 0, slots: 6, desc: 'Free. Two oars and a lot of optimism.' },
  sloop:   { n: 'Sloop', price: 1800, hp: 130, speed: 7.0, turn: 0.27, guns: 2, scale: 0.72, crew: 3, slots: 16, desc: 'Quick, nimble, lightly armed.' },
  brig:    { n: 'Brigantine', price: 4200, hp: 220, speed: 6.2, turn: 0.21, guns: 3, scale: 1.0, crew: 6, slots: 24, desc: 'The Saltwren’s own class. A fine all-rounder.' },
  galleon: { n: 'Galleon', price: 12500, hp: 400, speed: 5.2, turn: 0.15, guns: 5, scale: 1.3, crew: 10, slots: 40, desc: 'A floating treasury with teeth.' },
  manowar: { n: 'Man-o’-War', price: 32000, hp: 700, speed: 4.6, turn: 0.115, guns: 7, scale: 1.65, crew: 16, slots: 60, desc: 'Seven guns a side. Kings fear it.' },
};
const UPGRADES = {
  hull: { n: 'Reinforced hull', max: 3, cost: (c, l) => Math.round(c.price * 0.22 * (l + 1) + 200), desc: '+25% hull strength per level' },
  sail: { n: 'Fine sails', max: 3, cost: (c, l) => Math.round(c.price * 0.18 * (l + 1) + 150), desc: '+7% top speed per level' },
  rud:  { n: 'Balanced rudder', max: 3, cost: (c, l) => Math.round(c.price * 0.12 * (l + 1) + 120), desc: '+15% turning per level' },
  guns: { n: 'Extra guns', max: 2, cost: (c, l) => Math.round(c.price * 0.3 * (l + 1) + 300), desc: '+1 gun each side per level' },
  hold: { n: 'Deeper hold', max: 2, cost: (c, l) => Math.round(c.price * 0.1 * (l + 1) + 100), desc: '+50% cargo per level' },
};
const LOOKS = {
  sail: [['#efe3c6', 'Bleached canvas'], ['#1d1b1e', 'Black'], ['#8f1f1a', 'Blood red'], ['#2f4f7a', 'Navy blue'], ['#d9a640', 'Saffron'], ['#3e6b45', 'Sea green'], ['#e9e9e9', 'White'], ['#6b3f74', 'Royal purple']],
  hull: [['#ffffff', 'Natural oak'], ['#5a5a66', 'Tarred black'], ['#c26b5a', 'Ox-blood'], ['#6f8fb8', 'Admiralty blue'], ['#a3c28a', 'Verdigris'], ['#e0c080', 'Gilded']],
  flag: [['skull', 'Skull & bones'], ['swords', 'Crossed cutlasses'], ['hourglass', 'Hourglass'], ['heart', 'Bleeding heart']],
};

const SHOPS = {
  tavern:   { n: 'The Drowned Gull — tavern', items: ['rum', 'ale', 'cigar', 'hardtack', 'c_mackerel'], crew: true, buyCats: ['fish', 'food'] },
  armory:   { n: 'Gunsmith & blades', items: ['cutlass', 'dagger', 'rapier', 'axe', 'pistol', 'musket', 'blunder', 'shot'], buyCats: ['melee', 'gun'] },
  chandler: { n: 'Ship’s chandler', items: ['ball', 'chain', 'grape', 'bomb', 'keg', 'dynamite', 'flare', 'plank', 'cloth', 'wood', 'metal', 'rope', 'powder', 'shovel', 'rod', 'hammer', 'spyglass', 'bucket'], buyCats: ['mat', 'cannon', 'tool', 'fish'] },
  fence:    { n: 'Black-market fence', items: ['bomb', 'keg', 'dynamite', 'musket', 'relic'], buyCats: ['treasure', 'fish', 'melee', 'gun', 'cannon', 'throw'], markup: 1.6, sellBonus: 1.25 },
  trader:   { n: 'Trading post', items: ['hardtack', 'rum', 'plank', 'wood', 'cargo'], buyCats: ['treasure', 'fish', 'food', 'mat'] },
};
const BULK = { shot: 20, ball: 20, chain: 10, grape: 10, bomb: 5, plank: 10, wood: 50, metal: 10, rope: 10, cloth: 10, powder: 10 };

const RECIPES = [
  { out: 'plank', n: 5, need: { wood: 6 } },
  { out: 'shot', n: 20, need: { metal: 1, powder: 1 } },
  { out: 'ball', n: 10, need: { metal: 3 } },
  { out: 'chain', n: 5, need: { metal: 2, rope: 1 } },
  { out: 'grape', n: 5, need: { metal: 2 } },
  { out: 'bomb', n: 3, need: { metal: 2, powder: 3 } },
  { out: 'keg', n: 1, need: { powder: 5, wood: 3 } },
  { out: 'dynamite', n: 2, need: { powder: 2, rope: 1 } },
  { out: 'flare', n: 2, need: { powder: 1, cloth: 1 } },
];

// Base pieces: footprint is one 3 m cell; walls sit on cell edges.
const CELL = 3;
const PIECES = {
  foundation: { n: 'Foundation', cost: { wood: 40 }, hp: 500, place: 'cell' },
  floor:      { n: 'Floor / ceiling', cost: { wood: 25 }, hp: 300, place: 'cell' },
  wall:       { n: 'Wall', cost: { wood: 30 }, hp: 400, place: 'edge' },
  doorway:    { n: 'Doorway', cost: { wood: 25 }, hp: 350, place: 'edge' },
  door:       { n: 'Door (locks to you)', cost: { wood: 20, metal: 4 }, hp: 250, place: 'edge' },
  window:     { n: 'Window wall', cost: { wood: 28 }, hp: 330, place: 'edge' },
  stairs:     { n: 'Stairs', cost: { wood: 35 }, hp: 300, place: 'cell' },
  roof:       { n: 'Roof', cost: { wood: 35 }, hp: 300, place: 'cell' },
  chest:      { n: 'Storage chest', cost: { wood: 25 }, hp: 200, place: 'free' },
  campfire:   { n: 'Campfire', cost: { wood: 8 }, hp: 100, place: 'free' },
  cannon:     { n: 'Fort cannon', cost: { metal: 30, wood: 10 }, gold: 400, hp: 400, place: 'free' },
  rack:       { n: 'Weapon rack', cost: { wood: 15 }, hp: 150, place: 'free' },
  bed:        { n: 'Bed (respawn here)', cost: { wood: 20, cloth: 6 }, hp: 150, place: 'free' },
};

const START = { gold: 9000, inv: [['cutlass', 1], ['pistol', 1], ['shot', 30], ['shovel', 1], ['rod', 1], ['hammer', 1], ['ball', 60], ['chain', 10], ['plank', 20], ['wood', 160], ['bucket', 1], ['rum', 2], ['hardtack', 3], ['keg', 1], ['flare', 2]] };
const fmtG = n => Math.round(n).toLocaleString('en-US');
