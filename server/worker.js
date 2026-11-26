// The Gilded Wake — server.
// The Worker serves the game client straight from GitHub (pinned to the commit stored in KV "rev"),
// and routes /ws to one Durable Object per sea "room". The room is a small, generic authority:
// it relays gameplay messages, elects a host (who simulates NPC ships), keeps a persistent object
// store (loot, chests, strongboxes, base pieces) with atomic take/increment, and saves profiles.
const REPO = 'basket-modded/gilded-wake';
const TYPES = { html: 'text/html;charset=utf-8', js: 'application/javascript;charset=utf-8', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', txt: 'text/plain' };
const files = new Map();
let rev = null, revAt = 0;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const room = (url.searchParams.get('room') || 'open-sea').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'open-sea';
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
    }
    if (url.pathname === '/health') return new Response('ok rev=' + rev);
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!/^\/[\w\-./]+$/.test(p) || p.includes('..')) return new Response('Not found', { status: 404 });
    if (env.DEV_ORIGIN) { // local development: serve the working copy
      const r = await fetch(env.DEV_ORIGIN + '/client' + p); if (!r.ok) return new Response('Not found', { status: 404 });
      return new Response(await r.arrayBuffer(), { headers: { 'content-type': TYPES[p.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' } });
    }
    if (!rev || Date.now() - revAt > 10000) { rev = (await env.ASSETS.get('rev')) || 'main'; revAt = Date.now(); }
    const key = rev + p;
    let f = files.get(key);
    if (!f) {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${rev}/client${p}`, { cf: { cacheTtl: rev === 'main' ? 30 : 86400, cacheEverything: true } });
      if (!r.ok) {
        if (p === '/index.html') { const old = await env.ASSETS.get('index.html'); if (old) return new Response(old, { headers: { 'content-type': TYPES.html } }); }
        return new Response('Not found', { status: 404 });
      }
      f = { body: await r.arrayBuffer(), type: TYPES[p.split('.').pop()] || 'application/octet-stream' };
      files.set(key, f);
      if (files.size > 80) files.delete(files.keys().next().value);
    }
    return new Response(f.body, { headers: { 'content-type': f.type, 'cache-control': 'no-cache' } });
  }
};

const PALETTE = ['#e8b45f', '#5fb3e8', '#e8655f', '#7fd18b', '#c58be8', '#f0e06a', '#5fe8d0', '#f29bc4', '#ff9a3c', '#a6b8ff', '#d4d4d4', '#9be86a'];
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class Room {
  constructor(state) { this.state = state; this.st = state.storage; this.sessions = new Map(); this.objs = null; this.host = null; this.scores = new Map(); this.seq = 1; }

  async load() {
    if (this.objs) return;
    this.objs = new Map();
    const m = await this.st.list({ prefix: 'o:' });
    for (const [k, v] of m) this.objs.set(k.slice(2), v);
    this.seq = (await this.st.get('seq')) || 1;
  }

  async fetch(req) {
    await this.load();
    const url = new URL(req.url);
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const id = Math.random().toString(36).slice(2, 8);
    const used = new Set([...this.sessions.values()].map(s => s.color));
    const color = PALETTE.find(c => !used.has(c)) || PALETTE[(Math.random() * PALETTE.length) | 0];
    const s = { id, name: clean(url.searchParams.get('name'), 18) || 'Sailor', color, ws: server, st: null, n: 0, win: Date.now() };
    const spawn = this.spawnPoint(null);
    this.sessions.set(id, s);
    if (!this.host || !this.sessions.has(this.host)) this.host = id;
    server.send(JSON.stringify({ t: 'welcome', id, name: s.name, color, now: Date.now(), spawn, host: this.host,
      players: [...this.sessions.values()].filter(o => o !== s).map(o => this.info(o)), objs: [...this.objs.values()] }));
    this.bc({ t: 'join', ...this.info(s) }, s);
    server.addEventListener('message', e => { this.onMsg(s, e.data).catch(() => {}); });
    const close = () => {
      if (this.sessions.get(id) !== s) return;
      this.sessions.delete(id); this.scores.delete(id);
      this.bc({ t: 'leave', id });
      if (this.host === id) { this.host = this.sessions.keys().next().value || null; if (this.host) this.bc({ t: 'host', id: this.host }); }
    };
    server.addEventListener('close', close);
    server.addEventListener('error', close);
    return new Response(null, { status: 101, webSocket: client });
  }

  info(o) { return { id: o.id, name: o.name, color: o.color, score: this.scores.get(o.id) || 0, st: o.st }; }

  spawnPoint(self) {
    const ps = [...this.sessions.values()].filter(o => o !== self && o.st && isFinite(o.st.x));
    let cx = 0, cz = 0;
    if (ps.length) { for (const p of ps) { cx += p.st.x; cz += p.st.z; } cx /= ps.length; cz /= ps.length; }
    else { cx = (Math.random() - 0.5) * 200; cz = (Math.random() - 0.5) * 200; }
    let best = { x: cx, z: cz }, bd = -1;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, r = ps.length ? 130 + Math.random() * 90 : 0;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      let d = 1e9; for (const p of ps) d = Math.min(d, Math.hypot(p.st.x - x, p.st.z - z));
      if (d > bd) { bd = d; best = { x, z }; }
    }
    const h = ps.length ? Math.atan2(-(cx - best.x), -(cz - best.z)) : Math.random() * 6.283;
    return { x: best.x, z: best.z, h };
  }

  send(s, m) { try { s.ws.send(JSON.stringify(m)); } catch { } }
  bc(m, except) { const str = JSON.stringify(m); for (const o of this.sessions.values()) if (o !== except) try { o.ws.send(str); } catch { } }

  async onMsg(s, raw) {
    if (typeof raw !== 'string' || raw.length > 12000) return;
    const now = Date.now();
    if (now - s.win > 1000) { s.win = now; s.n = 0; }
    if (++s.n > 90) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'st':
        s.st = { x: +m.x || 0, z: +m.z || 0 };
        m.id = s.id; this.bc(m, s); return;
      case 'name': s.name = clean(m.name, 18) || s.name; this.bc({ t: 'name', id: s.id, name: s.name }); return;
      case 'sunk': {
        const by = this.sessions.get(m.by); let score = 0;
        if (by && by !== s) { score = (this.scores.get(by.id) || 0) + 1; this.scores.set(by.id, score); }
        m.id = s.id; m.by = by ? by.id : (typeof m.by === 'string' ? m.by : null); m.score = score; this.bc(m); return;
      }
      case 'respawn': this.send(s, { t: 'spawn', ...this.spawnPoint(s) }); return;
      case 'ping': this.send(s, { t: 'pong', c: +m.c || 0, now, host: this.host }); return;
      case 'chat': { const text = clean(m.text, 120); if (text) this.bc({ t: 'chat', id: s.id, text }); return; }
      // ---- object store ----
      case 'oc': {
        if (!m.o || typeof m.o !== 'object' || this.objs.size > 5000) return;
        const o = m.o; o.id = typeof o.id === 'string' && o.id.length < 40 ? o.id : 'x' + (this.seq++).toString(36);
        if (this.objs.has(o.id)) { this.send(s, { t: 'ocr', rq: m.rq, ok: 0, id: o.id }); return; }
        o.by = s.id; o.at = now;
        this.objs.set(o.id, o); await this.st.put('o:' + o.id, o); await this.st.put('seq', this.seq);
        this.bc({ t: 'oa', o }); if (m.rq) this.send(s, { t: 'ocr', rq: m.rq, ok: 1, id: o.id });
        return;
      }
      case 'ou': {
        const o = this.objs.get(m.id); if (!o || !m.p || typeof m.p !== 'object') return;
        Object.assign(o, m.p); await this.st.put('o:' + o.id, o);
        this.bc({ t: 'ou', id: o.id, p: m.p, by: s.id }); return;
      }
      case 'oi': {
        const o = this.objs.get(m.id); const f = String(m.f || '');
        if (!o || !f || typeof m.d !== 'number') { this.send(s, { t: 'oir', rq: m.rq, ok: 0 }); return; }
        const v = (+o[f] || 0) + m.d, min = typeof m.min === 'number' ? m.min : 0;
        if (v < min && !m.del) { this.send(s, { t: 'oir', rq: m.rq, ok: 0, v: o[f] }); return; }
        if (m.del && v <= 0) { this.objs.delete(o.id); await this.st.delete('o:' + o.id); this.bc({ t: 'od', id: o.id, by: s.id }); }
        else { o[f] = typeof m.max === 'number' ? Math.min(m.max, v) : v; await this.st.put('o:' + o.id, o); this.bc({ t: 'ou', id: o.id, p: { [f]: o[f] }, by: s.id }); }
        this.send(s, { t: 'oir', rq: m.rq, ok: 1, v, d: m.d, id: o.id }); return;
      }
      case 'ot': case 'od': {
        const o = this.objs.get(m.id);
        if (!o) { if (m.t === 'ot') this.send(s, { t: 'otr', rq: m.rq, ok: 0, id: m.id }); return; }
        this.objs.delete(o.id); await this.st.delete('o:' + o.id);
        this.bc({ t: 'od', id: o.id, by: s.id });
        if (m.t === 'ot') this.send(s, { t: 'otr', rq: m.rq, ok: 1, o }); return;
      }
      // ---- profiles ----
      case 'pl': { const k = clean(m.k, 40); this.send(s, { t: 'plr', d: k ? (await this.st.get('p:' + k)) || null : null }); return; }
      case 'ps': { const k = clean(m.k, 40); if (k && m.d && JSON.stringify(m.d).length < 40000) await this.st.put('p:' + k, m.d); return; }
      default: {
        m.id = s.id;
        if (typeof m.to === 'string') { const t = this.sessions.get(m.to); if (t) this.send(t, m); }
        else this.bc(m, s);
      }
    }
  }
}
