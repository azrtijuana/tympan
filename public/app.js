/* Tympan — client */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sset(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* */ } },
  };

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }

  let token = store.get('tympan.token');
  if (!token || !/^[a-z0-9-]{8,40}$/i.test(token)) {
    token = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    store.set('tympan.token', token);
  }

  const S = {
    catalog: null, modes: {}, rounds: [5, 10, 15, 20], durations: [10, 15, 20, 30], maxPlayers: 8,
    room: null, code: store.sget('tympan.room'), offset: 0, cat: null,
    round: null, my: null, revealData: null, ranking: null, feed: [], prevScores: {},
  };

  const socket = io({ transports: ['websocket', 'polling'] });
  const audio = $('#audio');
  const isHost = () => S.room && S.room.host === token;
  const local = serverT => serverT - S.offset;
  const player = t => S.room && S.room.players.find(p => p.token === t);

  // ---------- son ----------
  let unlocked = false;
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    try {
      audio.src = silentWav();
      const p = audio.play();
      if (p) p.then(() => audio.pause()).catch(() => { unlocked = false; });
    } catch { unlocked = false; }
  }
  const vol = $('#volume');
  vol.value = store.get('tympan.vol', '0.7');
  audio.volume = Number(vol.value);
  vol.addEventListener('input', () => { audio.volume = Number(vol.value); store.set('tympan.vol', vol.value); });

  let playTimer = null;
  function scheduleAudio(r) {
    clearTimeout(playTimer);
    audio.pause();
    if (!r.preview) { setStatusNote('Extrait audio indisponible pour cette manche.'); return; }
    audio.src = r.preview;
    audio.load();
    const go = () => {
      const elapsed = (Date.now() - local(r.startsAt)) / 1000;
      if (elapsed > 0.4) { try { audio.currentTime = Math.min(elapsed, 29); } catch { /* */ } }
      const p = audio.play();
      if (p) p.catch(() => needTap());
    };
    playTimer = setTimeout(go, Math.max(0, local(r.startsAt) - Date.now()));
  }
  function needTap() {
    const line = $('#status-line');
    line.replaceChildren(el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Activer le son', onclick: () => { audio.play().catch(() => {}); } }));
  }
  function fadeOut() {
    const start = audio.volume;
    let i = 0;
    const id = setInterval(() => {
      i++;
      audio.volume = Math.max(0, start * (1 - i / 10));
      if (i >= 10) { clearInterval(id); audio.pause(); audio.volume = Number(vol.value); }
    }, 60);
  }

  // ---------- horloge serveur ----------
  async function syncClock() {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const st = await new Promise(res => socket.timeout(3000).emit('time', t0, (err, t) => res(err ? null : t)));
      const t1 = Date.now();
      if (st) samples.push({ rtt: t1 - t0, off: st - (t0 + t1) / 2 });
    }
    if (samples.length) S.offset = samples.sort((a, b) => a.rtt - b.rtt)[0].off;
  }

  // ---------- toasts ----------
  function toast(text, kind = '') {
    const t = el('div', { class: 'toast ' + kind, text });
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ---------- écrans ----------
  const screens = { home: $('#screen-home'), lobby: $('#screen-lobby'), game: $('#screen-game'), end: $('#screen-end') };
  function show(name) { for (const [k, n] of Object.entries(screens)) n.hidden = k !== name; }

  function route() {
    const r = S.room;
    if (!r) return show('home');
    if (r.phase === 'lobby') { show('lobby'); renderLobby(); }
    else if (r.phase === 'ended') { show('end'); renderEnd(); }
    else { show('game'); renderGame(); }
  }

  // ---------- accueil ----------
  const nameInput = $('#name');
  nameInput.value = store.get('tympan.name', '');
  const codeInput = $('#code');
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) codeInput.value = urlRoom.toUpperCase().slice(0, 4);
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  function getName() {
    const n = nameInput.value.trim();
    if (!n) { toast('Choisis un pseudo pour jouer.', 'error'); nameInput.focus(); return null; }
    store.set('tympan.name', n);
    return n;
  }
  function entered(code) {
    S.code = code;
    store.sset('tympan.room', code);
    history.replaceState(null, '', '/?room=' + code);
  }
  $('#btn-create').addEventListener('click', () => {
    const name = getName(); if (!name) return;
    unlockAudio();
    socket.emit('create', { name, token }, res => { if (res && res.ok) entered(res.code); else toast((res && res.error) || 'Erreur', 'error'); });
  });
  $('#form-join').addEventListener('submit', e => {
    e.preventDefault();
    const name = getName(); if (!name) return;
    const code = codeInput.value.trim();
    if (code.length !== 4) { toast('Le code fait 4 lettres.', 'error'); codeInput.focus(); return; }
    unlockAudio();
    socket.emit('join', { name, token, code }, res => { if (res && res.ok) entered(res.code); else toast((res && res.error) || 'Erreur', 'error'); });
  });
  $('#form-name').addEventListener('submit', e => { e.preventDefault(); (codeInput.value.length === 4 ? $('#form-join').requestSubmit() : $('#btn-create').click()); });

  function leaveRoom() {
    socket.emit('leave');
    S.room = null; S.code = null; S.round = null; S.ranking = null;
    store.sset('tympan.room', null);
    audio.pause();
    history.replaceState(null, '', '/');
    route();
  }
  $('#btn-leave').addEventListener('click', leaveRoom);
  $('#btn-quit').addEventListener('click', leaveRoom);

  // ---------- salon ----------
  const shareUrl = () => location.origin + '/?room=' + (S.room ? S.room.code : '');
  $('#btn-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl()); toast('Lien copié. Envoie-le à tes potes !'); }
    catch {
      const r = document.createRange(); r.selectNodeContents($('#share-url'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Sélectionne le lien et copie-le.');
    }
  });

  function initials(name) { return (name || '?').trim().charAt(0).toUpperCase(); }
  function avatar(p) { return el('span', { class: 'avatar', style: `--c:${p.color}`, text: initials(p.name), 'aria-hidden': 'true' }); }

  function renderLobby() {
    const r = S.room;
    $('#lobby-code').textContent = r.code;
    $('#share-url').textContent = shareUrl();
    $('#player-count').textContent = `${r.players.length} / ${S.maxPlayers}`;

    const slots = $('#slots');
    slots.replaceChildren();
    r.players.forEach(p => {
      slots.append(el('li', { class: 'slot' + (p.connected ? '' : ' offline') },
        avatar(p),
        el('span', { class: 'slot-name', text: p.name }),
        p.token === r.host ? el('span', { class: 'tag', text: 'Hôte' }) : null,
        p.token === token ? el('span', { class: 'tag me', text: 'Toi' }) : null,
      ));
    });
    for (let i = r.players.length; i < S.maxPlayers; i++) slots.append(el('li', { class: 'slot empty', text: 'Place libre' }));

    const host = isHost();
    $('#settings').classList.toggle('readonly', !host);
    const hostP = player(r.host);
    $('#host-note').textContent = host ? 'Tu es l\'hôte' : `Réglages choisis par ${hostP ? hostP.name : 'l\'hôte'}`;
    $('#btn-start').hidden = !host;
    $('#wait-note').hidden = host;

    const s = r.settings;
    const send = patch => { if (isHost()) socket.emit('settings', patch); };

    // modes
    const modes = $('#modes');
    modes.replaceChildren(...Object.entries(S.modes).map(([id, m]) =>
      el('button', { class: 'opt', type: 'button', role: 'radio', 'aria-checked': String(s.mode === id), tabindex: host ? null : '-1', onclick: () => send({ mode: id }) },
        el('span', { class: 'opt-name', text: m.name }), el('span', { class: 'opt-desc', text: m.desc }))));

    // catégories + playlists
    if (!S.catalog) return;
    const current = S.catalog.playlists.find(p => p.id === s.playlist);
    if (!S.cat || !host) S.cat = current ? current.cat : S.catalog.categories[0].id;
    $('#cat-tabs').replaceChildren(...S.catalog.categories.map(c =>
      el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(S.cat === c.id), onclick: () => { S.cat = c.id; renderLobby(); } }, c.label)));
    $('#playlists').replaceChildren(...S.catalog.playlists.filter(p => p.cat === S.cat).map(p =>
      el('button', { class: 'opt', type: 'button', role: 'radio', 'aria-checked': String(s.playlist === p.id), tabindex: host ? null : '-1', onclick: () => send({ playlist: p.id }) },
        el('span', { class: 'opt-name', text: p.name }), el('span', { class: 'opt-desc', text: p.tagline }))));

    const ca = $('#custom-artist');
    $('#custom-artist-wrap').hidden = s.playlist !== 'custom';
    ca.readOnly = !host;
    if (document.activeElement !== ca) ca.value = s.customArtist || '';

    const seg = (node, values, cur, key, fmt) => node.replaceChildren(...values.map(v =>
      el('button', { type: 'button', role: 'radio', 'aria-checked': String(cur === v), tabindex: host ? null : '-1', onclick: () => send({ [key]: v }) }, fmt(v))));
    seg($('#seg-rounds'), S.rounds, s.rounds, 'rounds', v => String(v));
    seg($('#seg-duration'), S.durations, s.duration, 'duration', v => v + ' s');
  }
  let caTimer = null;
  $('#custom-artist').addEventListener('input', e => {
    clearTimeout(caTimer);
    const v = e.target.value;
    caTimer = setTimeout(() => { if (isHost()) socket.emit('settings', { customArtist: v }); }, 350);
  });
  $('#btn-start').addEventListener('click', () => { unlockAudio(); socket.emit('start'); });

  // ---------- partie ----------
  const answerInput = $('#answer');
  const ringBar = $('#ring-bar');
  const CIRC = 2 * Math.PI * 104;

  function needArtist() { return S.room && !S.room.artistKnown && S.room.settings.mode !== 'speed' && S.room.settings.mode !== 'qcm'; }

  function setStatusNote(text) { $('#status-line').textContent = text; }

  function renderGame() {
    const r = S.room;
    const modeName = (S.modes[r.settings.mode] || {}).name || '';
    $('#round-meta').textContent = `${modeName} · ${r.playlistName}`;
    $('#host-controls').hidden = !isHost();
    $('#btn-skip').disabled = r.phase !== 'playing';
    if (r.phase === 'loading') {
      $('#round-num').textContent = 'Préparation';
      setStatusNote('Recherche des extraits sur Deezer…');
      $('#disc-text').textContent = '…';
      $('#reveal').hidden = true;
      $('#disc').classList.remove('spin');
      $('#eq').classList.remove('on');
      ringBar.style.strokeDashoffset = '0';
      setInputs(false);
      $('#found').hidden = true;
      $('#feedback').textContent = '';
    } else if (r.roundIndex >= 0) {
      $('#round-num').textContent = `Manche ${r.roundIndex + 1} / ${r.total}`;
    }
    $('#chip-artist').hidden = !needArtist();
    $('#chip-title').textContent = r.settings.mode === 'qcm' ? 'Réponse' : 'Titre';
    renderScores();
  }

  function renderScores() {
    const r = S.room;
    const surv = r.settings.mode === 'survival';
    const list = [...r.players].sort((a, b) => (surv ? (b.alive - a.alive) || (b.lives - a.lives) : 0) || b.score - a.score);
    const ol = $('#scores');
    ol.replaceChildren(...list.map((p, i) => {
      const marks = el('span', { class: 'marks' });
      if (r.settings.mode === 'qcm') marks.append(el('i', { class: 'mark' + (p.answered ? (r.phase === 'reveal' ? (p.foundTitle ? ' on' : '') : ' wait') : ''), title: 'A répondu' }));
      else {
        marks.append(el('i', { class: 'mark' + (p.foundTitle ? ' on' : ''), title: 'Titre' }));
        if (needArtist()) marks.append(el('i', { class: 'mark' + (p.foundArtist ? ' on' : ''), title: 'Artiste' }));
      }
      if (surv) {
        const h = el('span', { class: 'hearts', 'aria-label': `${p.lives} vies` });
        for (let k = 0; k < 3; k++) h.append(el('span', { class: k < p.lives ? '' : 'lost', text: '♥' }));
        marks.append(h);
      }
      const bumped = S.prevScores[p.token] != null && S.prevScores[p.token] < p.score;
      return el('li', { class: 'score-row' + (p.token === token ? ' me' : '') + (surv && !p.alive ? ' out' : '') + (p.connected ? '' : ' offline') + (bumped ? ' bump' : '') },
        el('span', { class: 'pos', text: String(i + 1) }),
        avatar(p),
        el('span', { class: 'who' }, el('b', { text: p.name + (p.token === token ? ' (toi)' : '') }), marks),
        el('span', { class: 'pts', text: String(p.score) }));
    }));
    S.prevScores = Object.fromEntries(r.players.map(p => [p.token, p.score]));
  }

  function renderFeed() {
    $('#feed').replaceChildren(...S.feed.slice(0, 6).map(f => el('li', {}, el('b', { text: f.name }), ' ' + f.text)));
  }

  function setInputs(on) {
    const qcm = S.round && S.round.mode === 'qcm';
    $('#form-answer').hidden = qcm;
    $('#choices').hidden = !qcm;
    const me = player(token);
    const canPlay = on && me && me.alive && !(S.my && S.my.done);
    answerInput.disabled = !canPlay;
    $('#btn-answer').disabled = !canPlay;
    for (const b of document.querySelectorAll('.choice')) b.disabled = !canPlay || (S.my && S.my.choice != null);
  }

  function updateChips() {
    $('#chip-title').dataset.on = String(!!(S.my && S.my.title));
    $('#chip-artist').dataset.on = String(!!(S.my && S.my.artist));
  }

  function feedback(text, cls) {
    const f = $('#feedback');
    f.textContent = text;
    f.className = 'feedback ' + (cls || '');
  }

  function onRound(r) {
    S.round = r;
    S.revealData = null;
    S.my = { title: false, artist: false, done: false, choice: null };
    S.inputsOpen = false;
    const me = player(token);
    $('#reveal').hidden = true;
    $('#found').hidden = false;
    $('#disc-label').style.backgroundImage = '';
    feedback(me && !me.alive ? 'Tu es éliminé. Regarde les autres jouer.' : '');
    updateChips();
    answerInput.value = '';
    answerInput.placeholder = r.artistKnown ? 'Le titre de la chanson…' : (r.mode === 'speed' ? 'Le titre, vite !' : 'Titre, artiste, ou les deux…');
    if (r.mode === 'qcm') {
      $('#choices').replaceChildren(...r.choices.map((c, i) =>
        el('button', { class: 'choice', type: 'button', 'data-i': String(i), onclick: () => pick(i) }, el('span', { class: 'k', text: 'ABCD'[i] }), c)));
    }
    setInputs(false);
    scheduleAudio(r);
    route();
    tick();
  }

  function pick(i) {
    if (!S.round || S.my.choice != null) return;
    S.my.choice = i;
    for (const b of document.querySelectorAll('.choice')) { b.disabled = true; if (Number(b.dataset.i) === i) b.dataset.picked = 'true'; }
    socket.emit('answer', { choice: i }, res => {
      if (res && res.ok) feedback('Réponse verrouillée. Verdict à la fin de la manche.', 'close');
      else { S.my.choice = null; setInputs(true); }
    });
  }

  $('#form-answer').addEventListener('submit', e => {
    e.preventDefault();
    const text = answerInput.value.trim();
    if (!text || !S.round) return;
    answerInput.value = '';
    socket.emit('answer', { text }, res => {
      if (!res || !res.ok) {
        if (res && res.reason === 'eliminated') feedback('Tu es éliminé pour cette partie.', 'bad');
        return;
      }
      S.my.title = res.foundTitle; S.my.artist = res.foundArtist;
      updateChips();
      if (res.title && res.artist) feedback(`Titre et artiste ! +${res.gain} pts`, 'good');
      else if (res.title) feedback(needArtist() && !res.foundArtist ? 'Titre trouvé ! Et l\'artiste ?' : 'Titre trouvé !', 'good');
      else if (res.artist) feedback(res.foundTitle ? 'Artiste trouvé !' : 'Artiste trouvé ! Et le titre ?', 'good');
      else if (res.close) feedback('Presque… vérifie l\'orthographe.', 'close');
      else { feedback('Non, essaie encore.', 'bad'); const f = $('#form-answer'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
      const done = res.foundTitle && (!needArtist() || res.foundArtist);
      if (done) { S.my.done = true; setInputs(false); }
    });
  });

  // boucle d'animation : compte à rebours, anneau, disque
  let raf = null;
  function tick() {
    cancelAnimationFrame(raf);
    const loop = () => {
      const r = S.round;
      if (!r || !S.room || S.room.phase !== 'playing') { $('#disc').classList.remove('spin'); $('#eq').classList.remove('on'); return; }
      const now = Date.now();
      const start = local(r.startsAt), end = local(r.endsAt);
      if (now < start) {
        const n = Math.ceil((start - now) / 1000);
        $('#disc-text').textContent = String(n);
        $('#disc').classList.remove('spin');
        $('#eq').classList.remove('on');
        ringBar.style.strokeDashoffset = '0';
        ringBar.classList.remove('low');
        if (!$('#status-line').querySelector('button')) setStatusNote('Prépare-toi…');
      } else {
        const left = Math.max(0, end - now);
        const frac = left / (end - start);
        $('#disc-text').textContent = '♪';
        $('#disc').classList.add('spin');
        $('#eq').classList.toggle('on', !audio.paused);
        ringBar.style.strokeDashoffset = String(CIRC * (1 - frac));
        ringBar.classList.toggle('low', frac < 0.25);
        if (!$('#status-line').querySelector('button')) {
          const line = $('#status-line');
          line.replaceChildren(el('b', { text: String(Math.ceil(left / 1000)) }), ' s pour trouver');
        }
        const open = left > 0;
        if (open !== S.inputsOpen) { S.inputsOpen = open; setInputs(open); if (open && r.mode !== 'qcm' && !answerInput.disabled && matchMedia('(pointer:fine)').matches) answerInput.focus(); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function onReveal(d) {
    S.revealData = d;
    setInputs(false);
    $('#disc').classList.remove('spin');
    $('#eq').classList.remove('on');
    const t = d.track;
    $('#reveal-title').textContent = t.title;
    const ar = $('#reveal-artist');
    ar.replaceChildren(t.artist, t.year ? el('span', {}, ' · ', el('span', { class: 'yr', text: String(t.year) })) : null);
    const link = $('#reveal-link');
    link.hidden = !t.link;
    if (t.link) link.href = t.link;
    const cover = $('#reveal-cover');
    cover.textContent = '';
    if (t.cover) { cover.style.backgroundImage = `url("${t.cover.replace(/"/g, '')}")`; $('#disc-label').style.backgroundImage = cover.style.backgroundImage; }
    else { cover.style.backgroundImage = ''; cover.textContent = '♪'; }

    const mode = S.room.settings.mode;
    const gains = $('#gains');
    const rows = d.results.map(x => ({ ...x, p: player(x.token) })).filter(x => x.p).sort((a, b) => b.gain - a.gain);
    gains.replaceChildren(...rows.map(x => {
      let detail = '';
      if (mode === 'qcm') detail = x.choice == null ? 'pas de réponse' : (x.title ? 'bonne réponse' : 'raté');
      else detail = [x.title && 'titre', x.artist && 'artiste'].filter(Boolean).join(' + ') || 'rien trouvé';
      return el('li', {}, avatar(x.p),
        el('span', { class: 'g-name', text: `${x.p.name} — ${detail}` }),
        x.eliminated ? el('span', { class: 'g-life', text: 'éliminé' }) : (x.lostLife ? el('span', { class: 'g-life', text: '−1 vie' }) : null),
        el('span', { class: 'g-pts' + (x.gain ? '' : ' zero'), text: '+' + x.gain }));
    }));
    if (mode === 'qcm' && d.correct != null) {
      for (const b of document.querySelectorAll('.choice')) {
        const i = Number(b.dataset.i);
        if (i === d.correct) b.dataset.result = 'right';
        else if (b.dataset.picked === 'true') b.dataset.result = 'wrong';
      }
      const mine = d.results.find(x => x.token === token);
      if (mine) feedback(mine.choice == null ? 'Pas de réponse cette fois.' : (mine.title ? `Bonne réponse ! +${mine.gain} pts` : 'Raté…'), mine.title ? 'good' : 'bad');
    }
    const fill = $('#next-fill');
    fill.style.transition = 'none'; fill.style.width = '0';
    const ms = Math.max(0, local(d.nextAt) - Date.now());
    requestAnimationFrame(() => { fill.style.transition = `width ${ms}ms linear`; fill.style.width = '100%'; });
    setTimeout(() => { $('#reveal').hidden = false; }, mode === 'qcm' ? 1400 : 0);
    if (S.round && d.index === S.round.index) setTimeout(fadeOut, Math.max(0, ms - 800));
  }

  $('#btn-skip').addEventListener('click', () => socket.emit('skip'));
  $('#btn-stop').addEventListener('click', () => {
    const b = $('#btn-stop');
    if (b.dataset.confirm === 'true') { socket.emit('stop'); b.dataset.confirm = ''; b.textContent = 'Terminer'; return; }
    b.dataset.confirm = 'true'; b.textContent = 'Confirmer ?';
    setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Terminer'; }, 3000);
  });

  // ---------- fin ----------
  function renderEnd() {
    const r = S.room;
    const surv = r.settings.mode === 'survival';
    const ranking = S.ranking || [...r.players].sort((a, b) => (surv ? (b.alive - a.alive) || (b.lives - a.lives) : 0) || b.score - a.score);
    const top = ranking[0];
    const tie = ranking[1] && !surv && ranking[1].score === top.score;
    $('#end-eyebrow').textContent = `${(S.modes[r.settings.mode] || {}).name || ''} · ${r.playlistName}`;
    $('#end-title').textContent = !top ? 'Partie terminée' : tie ? 'Égalité au sommet !' : (top.token === token ? 'Tu gagnes !' : `${top.name} l'emporte !`);

    const order = [ranking[1], ranking[0], ranking[2]];
    $('#podium').replaceChildren(...order.map((p, i) => {
      if (!p) return el('div', { class: 'step' });
      const place = [2, 1, 3][i];
      return el('div', { class: `step p${place}` },
        avatar(p), el('span', { class: 'step-name', text: p.name }),
        el('span', { class: 'step-pts', text: `${p.score} pts` }),
        el('div', { class: 'step-block', text: String(place) }));
    }));
    $('#final').replaceChildren(...ranking.slice(3).map((p, i) =>
      el('li', {}, el('span', { class: 'pos', text: String(i + 4) }), avatar(p), el('span', { class: 'nm', text: p.name }), el('span', { class: 'pts', text: String(p.score) }))));
    $('#btn-again').hidden = !isHost();
    $('#end-wait').hidden = isHost();
  }
  $('#btn-again').addEventListener('click', () => socket.emit('lobby'));

  // ---------- socket ----------
  socket.on('connect', async () => {
    $('#conn').dataset.on = 'true';
    await syncClock();
    const name = store.get('tympan.name');
    if (S.code && name) {
      socket.emit('join', { code: S.code, name, token }, res => {
        if (!res || !res.ok) { S.code = null; store.sset('tympan.room', null); S.room = null; route(); if (res && res.error) toast(res.error, 'error'); }
      });
    }
  });
  socket.on('disconnect', () => { $('#conn').dataset.on = 'false'; });
  socket.on('hello', h => {
    S.catalog = h.catalog; S.modes = h.modes; S.rounds = h.rounds; S.durations = h.durations; S.maxPlayers = h.maxPlayers;
    if (S.room) route();
  });
  socket.on('state', st => {
    const prevPhase = S.room && S.room.phase;
    S.room = st;
    if (st.phase === 'lobby' && prevPhase !== 'lobby') { S.ranking = null; S.feed = []; S.round = null; renderFeed(); }
    if (st.phase === 'loading' && prevPhase !== 'loading') { S.feed = []; renderFeed(); S.prevScores = {}; }
    if (st.phase === 'ended' && prevPhase !== 'ended') { audio.pause(); }
    route();
  });
  socket.on('round', onRound);
  socket.on('reveal', onReveal);
  socket.on('feed', f => {
    const p = player(f.token);
    if (!p) return;
    const text = f.what === 'title' ? (f.rank === 1 ? 'trouve le titre en premier !' : 'a trouvé le titre') : 'a trouvé l\'artiste';
    S.feed.unshift({ name: p.token === token ? 'Toi' : p.name, text });
    S.feed = S.feed.slice(0, 12);
    renderFeed();
  });
  socket.on('ended', d => { S.ranking = d.ranking; if (S.room) route(); });
  socket.on('toast', t => toast(t.text, t.kind));
  socket.on('kicked', t => { toast(t.text, 'error'); S.room = null; S.code = null; route(); });

  route();
})();
