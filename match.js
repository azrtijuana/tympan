// Comparaison tolérante des réponses (accents, ponctuation, fautes de frappe)

const ARTICLES = /^(the|le|la|les|l|un|une|a|el|los)\s+/;

function base(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\$/g, 's')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Retire " - Remastered 2011", "(feat. X)", "[Radio Edit]"…
function cleanTitle(s) {
  let t = String(s || '');
  t = t.replace(/\s[-–—]\s.*$/, '');
  t = t.replace(/\((feat|ft|with)[^)]*\)/gi, '');
  t = t.replace(/\s(feat|ft)\.?\s.*$/i, '');
  return t;
}

function variants(answer) {
  const raw = String(answer || '');
  const out = new Set();
  const noParens = cleanTitle(raw).replace(/[([{][^)\]}]*[)\]}]/g, ' ');
  const keepParens = cleanTitle(raw).replace(/[()[\]{}]/g, ' ');
  for (const v of [noParens, keepParens, raw]) {
    const b = base(v);
    if (b) {
      out.add(b);
      const noArt = b.replace(ARTICLES, '');
      if (noArt) out.add(noArt);
    }
  }
  return [...out];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a, b) {
  const A = a.replace(/ /g, ''), B = b.replace(/ /g, '');
  if (!A || !B) return 0;
  return 1 - levenshtein(A, B) / Math.max(A.length, B.length);
}

function score(guess, answer) {
  const g = base(guess);
  const g2 = g.replace(ARTICLES, '');
  if (!g) return 0;
  let best = 0;
  for (const v of variants(answer)) {
    for (const gg of [g, g2]) {
      if (gg === v) return 1;
      if (v.replace(/ /g, '') === gg.replace(/ /g, '')) return 1;
      best = Math.max(best, similarity(gg, v));
    }
  }
  return best;
}

function threshold(answer) {
  const len = base(cleanTitle(answer)).replace(/ /g, '').length;
  if (len <= 4) return 1; // titres très courts : orthographe exacte
  if (len <= 8) return 0.84;
  return 0.8;
}

function matchAny(guess, answers) {
  return answers.some(a => score(guess, a) >= threshold(a));
}

function closeAny(guess, answers) {
  return answers.some(a => score(guess, a) >= 0.6);
}

// "Daft Punk - One More Time", "One more time par daft punk" → morceaux à tester séparément
function splitGuess(text) {
  const t = String(text || '').trim();
  const parts = t.split(/\s[-–—\/|]\s|\s+par\s+|\s+by\s+|\s+de\s+/i).map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? [t, ...parts] : [t];
}

// "Macklemore & Ryan Lewis" → accepte "Macklemore" seul
function artistNames(names) {
  const out = new Set();
  for (const n of names) {
    if (!n) continue;
    out.add(n);
    for (const p of String(n).split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bx\b|\band\b|\bet\b)\s*/i)) {
      if (p && p.trim().length >= 2) out.add(p.trim());
    }
  }
  return [...out];
}

module.exports = { base, matchAny, closeAny, splitGuess, artistNames, score };
