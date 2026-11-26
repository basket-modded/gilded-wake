# The Gilded Wake

A multiplayer pirate sandbox that runs in the browser (Three.js) on Cloudflare Workers and Durable Objects.

Play: https://gilded-wake.sickagent.workers.dev/ (add `?room=name` for a private sea).

## What's in it

- **Ships**: buy a sloop, brigantine, galleon or man-o'-war at the shipwright, or start in a rowboat. You can keep a fleet, upgrade hull, sails, rudder, guns and hold, and choose sail, paint and flag. Ships can anchor, lower a jolly boat, and have a crow's nest.
- **Naval combat**: broadsides fire round, chain, grape or explosive shot. You can also man single cannons by hand. Hits punch holes that flood, and fires spread. Torn sails slow a ship. Ships can ram, and grappling hooks pull ships together for boarding. A sunk ship splits in two.
- **NPC ships**: merchants, navy frigates, pirates, bounty captains, and ghost ships at night. The room's host simulates them.
- **On foot**: walk any deck, dock or island, swim and dive (watch your air, and the sharks), climb aboard, and explore sea caves. Weapons include cutlasses, sabers, rapiers, daggers and axes (with block and parry), plus flintlocks, muskets and blunderbusses. You can throw powder kegs and dynamite and fire signal flares.
- **Economy**: gold is physical. You drop your purse when you fall, and a sunk ship's strongbox floats free. Strongboxes can be plundered. There's a tavern, armoury, chandler, trader and fence. You can hire crew, buy rumours, and earn bounties and infamy.
- **Treasure**: maps lead to buried, cave and underwater caches. Dig with a shovel, then break the chest open or carry it home.
- **Building**: foundations, floors, walls, doorways, lockable doors, windows, stairs, roofs, chests, beds (your respawn point), fort cannons and racks. Walls can be upgraded to stone. Other players' bases can be raided with blades, cannon and explosives.
- **Survival and fun**: fishing, cooking at campfires, rum (with consequences), cigars, sitting, waving, dancing, and tavern music.
- **World**: ten islands with towns, wrecks, camps, wildlife and caves. There's a shared day and night cycle, and fog, rain and storms roll through.

## Art direction

Everything is modelled procedurally in code, from lathes, extruded profiles and lofted sections, with canvas-painted textures. Nothing is built from primitive boxes.

- **Characters:** jointed bodies with faces, coats, waistcoats, sashes, tricorns, bicornes and bandanas. They animate walking, running, swimming, the helm, sword swings, blocking, digging and emotes.
- **Weapons:** curved cutlass and saber, swept-hilt rapier, dagger, bearded axe, flintlock, musket and belled blunderbuss, plus a shovel, rod, hammer and spyglass. They're held in a first-person fist that renders in its own pass.
- **Islands:**
  - Textured terrain with wet sand and cliffs, plus a baked coast map. The coast map lets the sea draw turquoise shallows, caustics and breaking surf.
  - Palms, jungle trees, ferns and grass that sway in the wind.
  - Half-timbered towns and sea caves.
- **Boats:** a lofted clinker rowboat, and lower gun decks on galleons and men-o'-war.
- **Creatures:** countershaded sharks that swim with a flexing body, crabs, macaws and gulls.
- **Atmosphere:**
  - One sky-coloured horizon fog shared by every material.
  - Underwater murk.
  - Glowing windows and lanterns at night.
- **Performance:**
  - Vegetation is instanced in map cells with per-kind draw distances.
  - Terrain has two LOD levels.
  - Towns and camps are merged per material.

## Layout

```
client/            static game client (served by the Worker straight from this repo)
  index.html
  js/engine.js     renderer, sky, sea, the ship model, particles, sound
  js/data.js       items, ships, upgrades, shops, recipes, building pieces
  js/art.js        textures, fog, characters, weapons and tools, creatures
  js/world.js      islands, towns, wrecks, caves, wildlife, day/night and weather
  js/entities.js   avatars, ships (own, other players, NPCs), gunnery, damage, sinking, NPC AI
  js/player.js     the player: movement, swimming, weapons, cannons, digging, fishing
  js/systems.js    profile, shared objects (gold, loot, chests), building, sharks, trade screens
  js/main.js       UI, input, networking, other players, the main loop
server/
  worker.js        Worker + Durable Object "Room"
  wrangler.toml
```

## How it's deployed

The Worker serves `client/` from `raw.githubusercontent.com` at the commit stored in the KV key `rev`. To ship a client change:

1. Push it.
2. Set `rev` to the new commit SHA. Setting `rev` to `main` tracks the branch, with about 30 seconds of caching.

Server changes need a `wrangler deploy` from `server/`.

The Room Durable Object handles the shared state for each sea:

- **Relay**: it passes gameplay messages between players.
- **Host election**: one client simulates the NPCs.
- **Object store**: a persistent store with atomic take and increment, so gold can't be duplicated.
- **Profiles**: it keeps profile backups.

## Local development

```
cd server
npx wrangler dev --var DEV_ORIGIN:http://127.0.0.1:8080   # serves ../client from a static server
python3 -m http.server 8080 --directory ..                  # in another terminal
```
