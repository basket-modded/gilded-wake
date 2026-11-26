// The Gilded Wake — multiplayer room server.
// Worker serves the game page (stored in KV) and routes /ws to a Durable Object per room.
let htmlCache = null, htmlAt = 0;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const room = (url.searchParams.get('room') || 'open-sea').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'open-sea';
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (!htmlCache || Date.now() - htmlAt > 30000) {
        await syncPending(env);
        const h = await env.ASSETS.get('index.html');
        if (h) { htmlCache = h; htmlAt = Date.now(); }
      }
      if (!htmlCache) return new Response('The ship is still being built. Try again in a minute.', { status: 503 });
      return new Response(htmlCache, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-cache' } });
    }
    if (url.pathname === '/health') return new Response('ok');
    return new Response('Not found', { status: 404 });
  }
};

// A pending page update ({url, sha}) is pulled once, checked against its SHA-256, then stored in KV.
async function syncPending(env) {
  const p = await env.ASSETS.get('pending', 'json');
  if (!p || !p.url || !p.sha) return;
  try {
    const r = await fetch(p.url);
    if (!r.ok) return;
    const buf = await r.arrayBuffer();
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (h !== p.sha) return;
    await env.ASSETS.put('index.html', new TextDecoder().decode(buf));
    await env.ASSETS.put('synced', JSON.stringify({ sha: h, at: Date.now() }));
    await env.ASSETS.delete('pending');
  } catch (e) {}
}

const PALETTE = ['#e8b45f', '#5fb3e8', '#e8655f', '#7fd18b', '#c58be8', '#f0e06a', '#5fe8d0', '#f29bc4', '#ff9a3c', '#a6b8ff', '#d4d4d4', '#9be86a'];
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class Room {
  constructor(state, env) { this.state = state; this.sessions = new Map(); this.scores = new Map(); }

  async fetch(req) {
    const url = new URL(req.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = Math.random().toString(36).slice(2, 8);
    const used = new Set([...this.sessions.values()].map(s => s.color));
    const color = PALETTE.find(c => !used.has(c)) || PALETTE[(Math.random() * PALETTE.length) | 0];
    const s = { id, name: clean(url.searchParams.get('name'), 18) || 'Sailor', color, ws: server, st: null, n: 0, win: Date.now() };
    const spawn = this.spawnPoint(null);
    this.sessions.set(id, s);
    server.send(JSON.stringify({ t: 'welcome', id, name: s.name, color, now: Date.now(), spawn,
      players: [...this.sessions.values()].filter(o => o !== s).map(o => this.info(o)) }));
    this.broadcast({ t: 'join', ...this.info(s) }, s);
    server.addEventListener('message', e => this.onMsg(s, e.data));
    const close = () => {
      if (this.sessions.get(id) === s) { this.sessions.delete(id); this.scores.delete(id); this.broadcast({ t: 'leave', id }); }
    };
    server.addEventListener('close', close);
    server.addEventListener('error', close);
    return new Response(null, { status: 101, webSocket: client });
  }

  info(o) { return { id: o.id, name: o.name, color: o.color, score: this.scores.get(o.id) || 0, st: o.st }; }

  spawnPoint(self) {
    const ps = [...this.sessions.values()].filter(o => o !== self && o.st);
    let cx = 0, cz = 0;
    if (ps.length) { for (const p of ps) { cx += p.st.x; cz += p.st.z; } cx /= ps.length; cz /= ps.length; }
    else { cx = (Math.random() - 0.5) * 400; cz = (Math.random() - 0.5) * 400; }
    let best = { x: cx, z: cz }, bd = -1;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, r = ps.length ? 130 + Math.random() * 90 : 0;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      let d = 1e9; for (const p of ps) d = Math.min(d, Math.hypot(p.st.x - x, p.st.z - z));
      if (d > bd) { bd = d; best = { x, z }; }
    }
    const h = ps.length ? Math.atan2(-(cx - best.x), -(cz - best.z)) + (Math.random() - 0.5) * 0.8 : Math.random() * 6.283;
    return { x: best.x, z: best.z, h };
  }

  onMsg(s, raw) {
    if (typeof raw !== 'string' || raw.length > 1500) return;
    const now = Date.now();
    if (now - s.win > 1000) { s.win = now; s.n = 0; }
    if (++s.n > 60) return; // flood guard
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'st': {
        s.st = { x: num(m.x), z: num(m.z), h: num(m.h), sp: num(m.sp), sl: num(m.sl), rd: num(m.rd), hp: num(m.hp, 100), sk: m.sk ? 1 : 0, tl: m.tl ? 1 : 0, pm: m.pm ? 1 : 0, ax: Math.max(-6, Math.min(6, num(m.ax))), ay: Math.max(-1, Math.min(10, num(m.ay))), az: Math.max(-16, Math.min(16, num(m.az))), ya: num(m.ya) };
        this.broadcast({ t: 'st', id: s.id, ...s.st }, s);
        break;
      }
      case 'name': {
        s.name = clean(m.name, 18) || s.name;
        this.broadcast({ t: 'name', id: s.id, name: s.name }, null);
        break;
      }
      case 'fire': {
        const c = Array.isArray(m.c) ? m.c.filter(i => Number.isInteger(i) && i >= 0 && i < 6).slice(0, 6) : [];
        if (c.length) this.broadcast({ t: 'fire', id: s.id, c, el: num(m.el, 0.1), sd: num(m.sd) }, s);
        break;
      }
      case 'hit': {
        const tgt = this.sessions.get(m.to);
        const p = Array.isArray(m.p) ? m.p.slice(0, 3).map(v => num(v)) : [0, 0, 0];
        if (tgt && tgt !== s) {
          try { tgt.ws.send(JSON.stringify({ t: 'hit', by: s.id, dmg: Math.max(0, Math.min(16, num(m.dmg))), p })); } catch {}
          for (const o of this.sessions.values()) if (o !== s && o !== tgt) try { o.ws.send(JSON.stringify({ t: 'hitfx', id: tgt.id, p })); } catch {}
        }
        break;
      }
      case 'sunk': {
        const by = this.sessions.get(m.by);
        let score = 0;
        if (by && by !== s) { score = (this.scores.get(by.id) || 0) + 1; this.scores.set(by.id, score); }
        this.broadcast({ t: 'sunk', id: s.id, by: by ? by.id : null, score }, null);
        break;
      }
      case 'respawn': s.ws.send(JSON.stringify({ t: 'spawn', ...this.spawnPoint(s) })); break;
      case 'chat': {
        const text = clean(m.text, 100);
        if (text) this.broadcast({ t: 'chat', id: s.id, text }, null);
        break;
      }
      case 'bell': this.broadcast({ t: 'bell', id: s.id }, s); break;
      case 'ping': try { s.ws.send(JSON.stringify({ t: 'pong', c: num(m.c), now })); } catch {} break;
    }
  }

  broadcast(msg, except) {
    const str = JSON.stringify(msg);
    for (const o of this.sessions.values()) {
      if (o === except) continue;
      try { o.ws.send(str); } catch { }
    }
  }
}
