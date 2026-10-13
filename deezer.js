// Accès à l'API publique Deezer (sans clé) : recherche, top artiste, charts.
// Les extraits "preview" font 30 secondes et sont fournis par Deezer.

const BASE = 'https://api.deezer.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, { headers: { 'Accept': 'application/json' } });
      const json = await res.json();
      if (json && json.error) {
        // code 4 = quota (50 requêtes / 5 s) → on patiente puis on réessaie
        if (json.error.code === 4) { await sleep(1200 + i * 600); continue; }
        throw new Error(json.error.message || 'Erreur Deezer');
      }
      return json;
    } catch (err) {
      lastErr = err;
      await sleep(400 + i * 400);
    }
  }
  throw lastErr || new Error('Deezer ne répond pas');
}

function toTrack(t) {
  const names = [t.artist && t.artist.name, ...((t.contributors || []).map(c => c.name))].filter(Boolean);
  return {
    id: t.id,
    title: t.title_short || t.title,
    artist: t.artist ? t.artist.name : '',
    titles: [t.title_short, t.title].filter(Boolean),
    artists: [...new Set(names)],
    cover: t.album ? (t.album.cover_xl || t.album.cover_big || t.album.cover_medium || '') : '',
    preview: t.preview || '',
    link: t.link || `https://www.deezer.com/track/${t.id}`,
  };
}

async function searchTrack(artist, title) {
  const strict = `artist:"${artist}" track:"${title}"`;
  let j = await api('/search?limit=5&q=' + encodeURIComponent(strict));
  let hit = (j.data || []).find(t => t.preview);
  if (!hit) {
    j = await api('/search?limit=8&q=' + encodeURIComponent(`${artist} ${title}`));
    hit = (j.data || []).find(t => t.preview);
  }
  return hit ? toTrack(hit) : null;
}

async function artistTop(name) {
  const j = await api('/search/artist?limit=1&q=' + encodeURIComponent(name));
  const a = j.data && j.data[0];
  if (!a) return null;
  const top = await api(`/artist/${a.id}/top?limit=60`);
  return { artist: a.name, tracks: (top.data || []).filter(t => t.preview).map(toTrack) };
}

async function chart() {
  const j = await api('/chart/0/tracks?limit=100');
  return (j.data || []).filter(t => t.preview).map(toTrack);
}

// --- Mode test hors-ligne (MOCK=1) : pas d'appel réseau, pas de son ---
const mock = {
  async searchTrack(artist, title) {
    return { id: Math.abs(hash(artist + title)), title, artist, titles: [title], artists: [artist], cover: '', preview: '', link: '' };
  },
  async artistTop(name) {
    const tracks = Array.from({ length: 20 }, (_, i) => ({
      id: 1000 + i, title: `Chanson ${i + 1}`, artist: name, titles: [`Chanson ${i + 1}`], artists: [name], cover: '', preview: '', link: '',
    }));
    return { artist: name, tracks };
  },
  async chart() {
    return Array.from({ length: 30 }, (_, i) => ({
      id: 2000 + i, title: `Tube ${i + 1}`, artist: `Artiste ${i + 1}`, titles: [`Tube ${i + 1}`], artists: [`Artiste ${i + 1}`], cover: '', preview: '', link: '',
    }));
  },
};

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

module.exports = process.env.MOCK === '1' ? mock : { searchTrack, artistTop, chart };
