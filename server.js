const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const deezer = require('./deezer');
const { LISTS, ARTIST_IDS, catalog, isValidPlaylist, playlistName } = require('./playlists');
const { base, matchAny, closeAny, splitGuess, artistNames } = require('./match');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const COUNTDOWN_MS = 3000;
const REVEAL_MS = 7000;
const COLORS = ['#ff5a5f', '#ffc145', '#3ddc97', '#4cc9f0', '#b388ff', '#ff8fd8', '#ff9f43', '#9be564'];
const SPEED_POINTS = [300, 220, 170, 130, 100, 80, 60, 50];
const MODES = {
  classic: { name: 'Classique', desc: 'Trouve le titre et l\'artiste. Plus tu es rapide, plus tu marques.' },
  speed: { name: 'Rapidité', desc: 'Seul le titre compte. Le premier à trouver rafle le plus de points.' },
  qcm: { name: 'QCM', desc: 'Quatre propositions, une seule chance. Idéal pour les soirées.' },
  survival: { name: 'Survie', desc: 'Trois vies. Chaque titre raté en coûte une. Le dernier debout gagne.' },
};
const ROUNDS = [5, 10, 15, 20];
const DURATIONS = [10, 15, 20, 30];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });

const rooms = new Map();

// ---------- utilitaires ----------
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cleanName = n => (String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16)) || 'Joueur';
const cleanToken = t => (typeof t === 'string' && /^[a-z0-9-]{8,40}$/i.test(t) ? t : null);

function newCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); } while (rooms.has(c));
  return c;
}

function freeColor(room) {
  const used = new Set([...room.players.values()].map(p => p.color));
  return COLORS.find(c => !used.has(c)) || COLORS[room.players.size % COLORS.length];
}

function publicState(room) {
  const rd = room.round;
  return {
    code: room.code,
    host: room.host,
    phase: room.phase,
    settings: room.settings,
    playlistName: playlistName(room.settings.playlist, room.settings.customArtist),
    roundIndex: rd ? rd.index : -1,
    total: room.tracks.length,
    artistKnown: room.artistKnown,
    players: [...room.players.values()].map(p => {
      const st = rd && rd.status[p.token];
      return {
        token: p.token, name: p.name, color: p.color, score: p.score, lives: p.lives, alive: p.alive,
        connected: p.connected,
        foundTitle: !!(st && st.title), foundArtist: !!(st && st.artist), answered: !!(st && (st.done || st.choice != null)),
      };
    }),
  };
}

function broadcast(room) { io.to(room.code).emit('state', publicState(room)); }

function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }

function connectedPlayers(room) { return [...room.players.values()].filter(p => p.connected); }

// ---------- construction de la playlist ----------
async function resolveCurated(entries, n) {
  const out = [];
  let i = 0;
  const seen = new Set();
  async function worker() {
    while (out.length < n && i < entries.length) {
      const [artist, title, year] = entries[i++];
      try {
        const t = await deezer.searchTrack(artist, title);
        if (t && out.length < n && !seen.has(t.id)) {
          seen.add(t.id);
          out.push({
            ...t,
            title, artist, year,
            titles: [title, ...t.titles],
            artists: artistNames([artist, ...t.artists]),
          });
        }
      } catch (_) { /* morceau introuvable : on passe au suivant */ }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

function dedupeByTitle(tracks) {
  const seen = new Set();
  return tracks.filter(t => {
    const k = base(String(t.title).replace(/[([].*$/, ''));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function buildGame(settings) {
  const n = settings.rounds;
  const pl = settings.playlist;
  if (LISTS[pl] || pl === 'mix') {
    const entries = pl === 'mix' ? Object.values(LISTS).flatMap(l => l.tracks) : LISTS[pl].tracks;
    const uniq = [...new Map(entries.map(e => [base(e[0] + e[1]), e])).values()];
    const tracks = await resolveCurated(shuffle(uniq), n);
    const pool = uniq.map(([artist, title]) => ({ artist, title }));
    return { tracks, pool, artistKnown: false };
  }
  if (ARTIST_IDS[pl] || pl === 'custom') {
    const name = pl === 'custom' ? settings.customArtist : ARTIST_IDS[pl];
    if (!name) throw new Error('Indique un nom d\'artiste.');
    const res = await deezer.artistTop(name);
    if (!res || !res.tracks.length) throw new Error(`Aucun titre trouvé pour « ${name} ».`);
    const all = dedupeByTitle(res.tracks).map(t => ({ ...t, artists: artistNames(t.artists) }));
    return { tracks: shuffle(all).slice(0, n), pool: all.map(t => ({ title: t.title, artist: t.artist })), artistKnown: true, artistName: res.artist };
  }
  if (pl === 'charts') {
    const all = dedupeByTitle(await deezer.chart()).map(t => ({ ...t, artists: artistNames(t.artists) }));
    return { tracks: shuffle(all).slice(0, n), pool: all.map(t => ({ title: t.title, artist: t.artist })), artistKnown: false };
  }
  throw new Error('Playlist inconnue.');
}

function makeChoices(room, track) {
  const label = t => room.artistKnown ? t.title : `${t.title} — ${t.artist}`;
  const right = label(track);
  const others = shuffle(room.pool.filter(p => base(p.title) !== base(track.title)));
  const picked = [];
  const seen = new Set([base(right)]);
  for (const o of others) {
    const l = label(o);
    if (!seen.has(base(l))) { seen.add(base(l)); picked.push(l); }
    if (picked.length === 3) break;
  }
  const choices = shuffle([right, ...picked]);
  return { choices, correct: choices.indexOf(right) };
}

// ---------- déroulé d'une partie ----------
async function startGame(room) {
  clearTimer(room);
  const buildId = (room.buildId = (room.buildId || 0) + 1);
  room.phase = 'loading';
  room.round = null;
  room.tracks = [];
  for (const p of room.players.values()) { p.score = 0; p.lives = 3; p.alive = true; }
  broadcast(room);
  try {
    const g = await buildGame(room.settings);
    if (!rooms.has(room.code) || room.buildId !== buildId || room.phase !== 'loading') return;
    if (g.tracks.length < 3) throw new Error('Pas assez d\'extraits disponibles pour cette playlist. Essaie-en une autre.');
    room.tracks = g.tracks;
    room.pool = g.pool;
    room.artistKnown = g.artistKnown;
    startRound(room, 0);
  } catch (err) {
    if (!rooms.has(room.code) || room.buildId !== buildId) return;
    room.phase = 'lobby';
    broadcast(room);
    io.to(room.code).emit('toast', { kind: 'error', text: err.message || 'Impossible de préparer la partie.' });
  }
}

function roundPayload(room) {
  const rd = room.round;
  return {
    index: rd.index, total: room.tracks.length, mode: room.settings.mode,
    preview: rd.track.preview, startsAt: rd.startsAt, endsAt: rd.endsAt,
    choices: rd.choices || null, artistKnown: room.artistKnown, now: Date.now(),
  };
}

function startRound(room, index) {
  clearTimer(room);
  const track = room.tracks[index];
  const startsAt = Date.now() + COUNTDOWN_MS;
  const rd = {
    index, track, startsAt, endsAt: startsAt + room.settings.duration * 1000,
    status: {}, order: 0, eligible: new Set(),
  };
  for (const p of room.players.values()) if (p.connected && p.alive) rd.eligible.add(p.token);
  if (room.settings.mode === 'qcm') Object.assign(rd, makeChoices(room, track));
  room.round = rd;
  room.phase = 'playing';
  broadcast(room);
  io.to(room.code).emit('round', roundPayload(room));
  room.timer = setTimeout(() => reveal(room), rd.endsAt - Date.now() + 250);
}

function checkAllDone(room) {
  const rd = room.round;
  const active = [...room.players.values()].filter(p => p.connected && rd.eligible.has(p.token));
  if (active.length && active.every(p => { const s = rd.status[p.token]; return s && (s.done || s.choice != null); })) {
    clearTimer(room);
    room.timer = setTimeout(() => reveal(room), 900);
  }
}

function reveal(room) {
  if (room.phase !== 'playing') return;
  clearTimer(room);
  const rd = room.round;
  const mode = room.settings.mode;
  const results = [];
  for (const p of room.players.values()) {
    const st = rd.status[p.token] || {};
    let lostLife = false;
    if (mode === 'survival' && rd.eligible.has(p.token) && p.alive && !st.title) {
      p.lives -= 1;
      lostLife = true;
      if (p.lives <= 0) { p.lives = 0; p.alive = false; }
    }
    results.push({
      token: p.token, gain: st.gain || 0, title: !!st.title, artist: !!st.artist,
      choice: st.choice ?? null, lostLife, eliminated: lostLife && !p.alive,
    });
  }
  room.phase = 'reveal';
  broadcast(room);
  io.to(room.code).emit('reveal', {
    index: rd.index,
    track: { title: rd.track.title, artist: rd.track.artist, cover: rd.track.cover, year: rd.track.year || null, link: rd.track.link },
    correct: rd.correct ?? null,
    results,
    nextAt: Date.now() + REVEAL_MS,
  });

  const alive = [...room.players.values()].filter(p => p.alive);
  const survivalOver = mode === 'survival' && (room.players.size > 1 ? alive.length <= 1 : alive.length === 0);
  const last = rd.index >= room.tracks.length - 1;
  room.timer = setTimeout(() => {
    if (survivalOver || last) endGame(room);
    else startRound(room, rd.index + 1);
  }, REVEAL_MS);
}

function endGame(room) {
  clearTimer(room);
  room.phase = 'ended';
  broadcast(room);
  const ranking = [...room.players.values()]
    .sort((a, b) => (room.settings.mode === 'survival' ? (b.alive - a.alive) || (b.lives - a.lives) : 0) || b.score - a.score)
    .map(p => ({ token: p.token, name: p.name, color: p.color, score: p.score, lives: p.lives, alive: p.alive }));
  io.to(room.code).emit('ended', { ranking, mode: room.settings.mode });
}

// ---------- réponses ----------
function handleAnswer(room, player, payload) {
  const rd = room.round;
  const now = Date.now();
  if (room.phase !== 'playing' || !rd) return { ok: false, reason: 'closed' };
  if (now < rd.startsAt - 150 || now > rd.endsAt + 400) return { ok: false, reason: 'closed' };
  if (!player.alive) return { ok: false, reason: 'eliminated' };
  if (!rd.eligible.has(player.token)) rd.eligible.add(player.token); // arrivé en cours de manche
  const st = (rd.status[player.token] ||= { title: false, artist: false, done: false, gain: 0, choice: null });
  if (st.done || st.choice != null) return { ok: false, reason: 'done' };

  const mode = room.settings.mode;
  const remaining = Math.max(0, Math.min(1, (rd.endsAt - now) / (rd.endsAt - rd.startsAt)));
  const timed = pts => Math.round(pts * (0.5 + 0.5 * remaining));

  if (mode === 'qcm') {
    const choice = Number(payload && payload.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return { ok: false, reason: 'invalid' };
    st.choice = choice;
    if (choice === rd.correct) { st.title = true; st.gain = 100 + Math.round(100 * remaining); player.score += st.gain; }
    st.done = true;
    broadcast(room);
    checkAllDone(room);
    return { ok: true, locked: true };
  }

  const text = String((payload && payload.text) || '').slice(0, 100);
  if (!text.trim()) return { ok: false, reason: 'empty' };
  const parts = splitGuess(text);
  const needArtist = !room.artistKnown && mode !== 'speed';
  const res = { ok: true, title: false, artist: false, close: false };

  if (!st.title && parts.some(g => matchAny(g, rd.track.titles))) {
    st.title = true; res.title = true;
    let pts;
    if (mode === 'speed') pts = SPEED_POINTS[Math.min(rd.order++, SPEED_POINTS.length - 1)];
    else pts = timed(room.artistKnown ? 200 : 100);
    st.gain += pts; player.score += pts;
    io.to(room.code).emit('feed', { token: player.token, what: 'title', rank: mode === 'speed' ? rd.order : null });
  }
  if (needArtist && !st.artist && parts.some(g => matchAny(g, rd.track.artists))) {
    st.artist = true; res.artist = true;
    const pts = timed(100);
    st.gain += pts; player.score += pts;
    io.to(room.code).emit('feed', { token: player.token, what: 'artist' });
  }
  if (!res.title && !res.artist) {
    const targets = [...(st.title ? [] : rd.track.titles), ...(needArtist && !st.artist ? rd.track.artists : [])];
    res.close = parts.some(g => closeAny(g, targets));
  }
  st.done = st.title && (!needArtist || st.artist);
  res.foundTitle = st.title;
  res.foundArtist = st.artist;
  res.gain = st.gain;
  if (res.title || res.artist) { broadcast(room); checkAllDone(room); }
  return res;
}

// ---------- connexions ----------
function attach(socket, room, player) {
  socket.join(room.code);
  socket.data.code = room.code;
  socket.data.token = player.token;
  player.connected = true;
  player.socketId = socket.id;
  if (!room.players.get(room.host) || !room.players.get(room.host).connected) room.host = player.token;
  if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
}

function current(socket) {
  const room = rooms.get(socket.data.code);
  if (!room) return {};
  const player = room.players.get(socket.data.token);
  if (!player || player.socketId !== socket.id) return {};
  return { room, player, isHost: room.host === player.token };
}

function leave(socket, hard) {
  const { room, player } = current(socket);
  if (!room) return;
  socket.leave(room.code);
  socket.data.code = null;
  if (hard || room.phase === 'lobby') room.players.delete(player.token);
  else player.connected = false;
  if (room.host === player.token) {
    const next = connectedPlayers(room)[0];
    if (next) room.host = next.token;
  }
  if (!connectedPlayers(room).length) {
    clearTimer(room);
    room.emptyTimer = setTimeout(() => { if (!connectedPlayers(room).length) rooms.delete(room.code); }, 120000);
  } else {
    broadcast(room);
    if (room.phase === 'playing') checkAllDone(room);
  }
}

function sendSnapshot(socket, room) {
  socket.emit('state', publicState(room));
  if (room.phase === 'playing' && room.round) socket.emit('round', roundPayload(room));
}

io.on('connection', socket => {
  socket.emit('hello', { catalog: catalog(), modes: MODES, rounds: ROUNDS, durations: DURATIONS, maxPlayers: MAX_PLAYERS });

  socket.on('time', (_t, cb) => { if (typeof cb === 'function') cb(Date.now()); });

  socket.on('create', (data, cb) => {
    if (typeof cb !== 'function') return;
    const token = cleanToken(data && data.token);
    if (!token) return cb({ ok: false, error: 'Session invalide, recharge la page.' });
    leave(socket, true);
    const room = {
      code: newCode(), host: token, players: new Map(), phase: 'lobby', tracks: [], pool: [], round: null,
      artistKnown: false, timer: null,
      settings: { mode: 'classic', playlist: 'y00', customArtist: '', rounds: 10, duration: 20 },
    };
    rooms.set(room.code, room);
    const player = { token, name: cleanName(data.name), color: COLORS[0], score: 0, lives: 3, alive: true, connected: true };
    room.players.set(token, player);
    attach(socket, room, player);
    cb({ ok: true, code: room.code });
    sendSnapshot(socket, room);
  });

  socket.on('join', (data, cb) => {
    if (typeof cb !== 'function') return;
    const token = cleanToken(data && data.token);
    const code = String((data && data.code) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const room = rooms.get(code);
    if (!token) return cb({ ok: false, error: 'Session invalide, recharge la page.' });
    if (!room) return cb({ ok: false, error: 'Ce salon n\'existe pas ou a expiré.' });
    let player = room.players.get(token);
    if (!player) {
      if (room.players.size >= MAX_PLAYERS) return cb({ ok: false, error: `Salon complet (${MAX_PLAYERS} joueurs maximum).` });
      player = { token, name: cleanName(data.name), color: freeColor(room), score: 0, lives: 3, alive: room.phase === 'lobby' || room.settings.mode !== 'survival', connected: true };
      room.players.set(token, player);
    } else if (data.name) {
      player.name = cleanName(data.name);
    }
    if (socket.data.code && socket.data.code !== code) leave(socket, true);
    // même joueur ouvert dans un autre onglet : l'ancien onglet est détaché
    if (player.socketId && player.socketId !== socket.id) {
      const old = io.sockets.sockets.get(player.socketId);
      if (old) { old.leave(code); old.data.code = null; old.emit('kicked', { text: 'Tu as rejoint ce salon depuis un autre onglet.' }); }
    }
    attach(socket, room, player);
    cb({ ok: true, code });
    broadcast(room);
    sendSnapshot(socket, room);
  });

  socket.on('settings', patch => {
    const { room, isHost } = current(socket);
    if (!room || !isHost || room.phase !== 'lobby' || !patch || typeof patch !== 'object') return;
    const s = room.settings;
    if (MODES[patch.mode]) s.mode = patch.mode;
    if (isValidPlaylist(patch.playlist)) s.playlist = patch.playlist;
    if (typeof patch.customArtist === 'string') s.customArtist = patch.customArtist.replace(/[<>]/g, '').trim().slice(0, 40);
    if (ROUNDS.includes(Number(patch.rounds))) s.rounds = Number(patch.rounds);
    if (DURATIONS.includes(Number(patch.duration))) s.duration = Number(patch.duration);
    broadcast(room);
  });

  socket.on('start', () => {
    const { room, isHost } = current(socket);
    if (!room || !isHost || !['lobby', 'ended'].includes(room.phase)) return;
    if (room.settings.playlist === 'custom' && !room.settings.customArtist) {
      socket.emit('toast', { kind: 'error', text: 'Tape le nom d\'un artiste avant de lancer.' });
      return;
    }
    startGame(room);
  });

  socket.on('answer', (payload, cb) => {
    const { room, player } = current(socket);
    const res = room ? handleAnswer(room, player, payload) : { ok: false, reason: 'closed' };
    if (typeof cb === 'function') cb(res);
  });

  socket.on('skip', () => {
    const { room, isHost } = current(socket);
    if (room && isHost && room.phase === 'playing') reveal(room);
  });

  socket.on('stop', () => {
    const { room, isHost } = current(socket);
    if (room && isHost && ['playing', 'reveal', 'loading'].includes(room.phase)) {
      room.buildId = (room.buildId || 0) + 1;
      endGame(room);
    }
  });

  socket.on('lobby', () => {
    const { room, isHost } = current(socket);
    if (!room || !isHost || room.phase !== 'ended') return;
    room.phase = 'lobby';
    room.round = null;
    for (const [t, p] of room.players) if (!p.connected) room.players.delete(t);
    for (const p of room.players.values()) { p.score = 0; p.lives = 3; p.alive = true; }
    broadcast(room);
  });

  socket.on('leave', () => leave(socket, true));
  socket.on('disconnect', () => leave(socket, false));
});

server.listen(PORT, () => {
  console.log(`Tympan lancé sur http://localhost:${PORT}${process.env.MOCK === '1' ? ' (mode test, sans audio)' : ''}`);
});
