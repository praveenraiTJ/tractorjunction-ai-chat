#!/usr/bin/env node
/**
 * Builds the `farm_knowledge` vector index used by the search_knowledge tool.
 * Sources: TJ news/articles (`news` table), TJ FAQs (`faqs`), curated guides (knowledge/*.md).
 * Incremental: unchanged items (same updated_at) are skipped; re-run any time (e.g. nightly).
 *
 *   node scripts/ingest/ingestKnowledge.js [--source=all|news|faqs|curated] [--limit=N] [--force]
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const dbConnection = require('../../server/config/database');
const { upsertDocs, getMetadatas, deleteIds, count } = require('../../server/services/agent/knowledgeStore');
const { newsUrl } = require('../../server/services/agent/tools/tjUrls');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const SOURCE = args.source || 'all';
const LIMIT = args.limit ? Number(args.limit) : null;
const FORCE = !!args.force;

const CHUNK_CHARS = 1400;
const OVERLAP_CHARS = 200;
const ARTICLE_BATCH = 40;
// Not farming knowledge
const SKIP_NEWS_CATEGORIES = ['automobile', 'social'];

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', rupee: '₹' };

function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|table|ul|ol)>|<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Paragraph-aware chunks of ~CHUNK_CHARS with a short overlap so facts spanning a boundary stay findable
function chunkText(text) {
  const pieces = [];
  for (const para of text.split(/\n+/).map(p => p.trim()).filter(Boolean)) {
    if (para.length <= CHUNK_CHARS) { pieces.push(para); continue; }
    // Long paragraph: split on sentence ends (Hindi danda, ., ?, !)
    let buf = '';
    for (const sentence of para.split(/(?<=[।.?!])\s+/)) {
      if (buf && buf.length + sentence.length > CHUNK_CHARS) { pieces.push(buf); buf = ''; }
      buf += (buf ? ' ' : '') + sentence;
    }
    if (buf) pieces.push(buf);
  }

  const chunks = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length > CHUNK_CHARS) {
      chunks.push(current);
      current = current.slice(-OVERLAP_CHARS).replace(/^\S*\s/, '');
    }
    current += (current ? '\n' : '') + piece;
  }
  if (current.trim()) chunks.push(current);
  return chunks.map(c => c.slice(0, CHUNK_CHARS + OVERLAP_CHARS));
}

const isoDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));
const stamp = (d) => (d instanceof Date ? d.toISOString() : String(d || ''));

/**
 * items: [{ key, title, body, sections?, updatedAt, metadata }] → chunked docs `${key}:${i}`.
 * `sections` (pre-split text) replaces paragraph chunking, e.g. one chunk per guide heading.
 * Skips items whose first chunk already has the same updated_at; removes leftover chunks when an item shrinks.
 */
async function indexItems(items, label) {
  const existing = await getMetadatas(items.map(i => `${i.key}:0`));
  const docs = [];
  const staleIds = [];
  let skipped = 0;

  for (const item of items) {
    const prev = existing[`${item.key}:0`];
    if (!FORCE && prev && prev.updated_at === item.updatedAt) { skipped++; continue; }

    const chunks = item.sections || chunkText(item.body);
    if (!chunks.length) continue;
    chunks.forEach((chunk, i) => {
      const text = `${item.title}\n\n${chunk}`;
      docs.push({
        id: `${item.key}:${i}`,
        text,
        metadata: { ...item.metadata, title: item.title, chunk: i, ...(i === 0 ? { chunk_count: chunks.length, updated_at: item.updatedAt } : {}) }
      });
    });
    for (let i = chunks.length; i < (prev?.chunk_count || 0); i++) staleIds.push(`${item.key}:${i}`);
  }

  await deleteIds(staleIds);
  for (let i = 0; i < docs.length; i += 200) await upsertDocs(docs.slice(i, i + 200));
  console.log(`  ${label}: ${items.length - skipped} indexed (${docs.length} chunks), ${skipped} unchanged`);
  return docs.length;
}

async function ingestNews() {
  const [{ total }] = await dbConnection.query(`SELECT COUNT(*) AS total FROM news WHERE status = 1`);
  const max = LIMIT ? Math.min(LIMIT, total) : total;
  console.log(`📰 News: ${max} articles`);
  let chunks = 0;
  for (let offset = 0; offset < max; offset += ARTICLE_BATCH) {
    const rows = await dbConnection.query(`
      SELECT n.id, n.title, n.description, n.slug, n.date, n.lang, n.updated_at, nc.slug AS category
      FROM news n LEFT JOIN news_category nc ON nc.id = n.category_id
      WHERE n.status = 1
      ORDER BY n.id DESC
      LIMIT ${Math.min(ARTICLE_BATCH, max - offset)} OFFSET ${offset}`);
    const items = rows
      .filter(r => !SKIP_NEWS_CATEGORIES.includes(r.category))
      .map(r => ({
        key: `news:${r.id}`,
        title: htmlToText(r.title),
        body: htmlToText(r.description),
        updatedAt: stamp(r.updated_at),
        metadata: {
          source: 'news',
          category: r.category || 'tractor',
          lang: r.lang,
          date: isoDate(r.date),
          year: r.date instanceof Date ? r.date.getUTCFullYear() : Number(String(r.date).slice(0, 4)) || 0,
          url: newsUrl(r.category, r.slug)
        }
      }));
    chunks += await indexItems(items, `news ${offset + rows.length}/${max}`);
  }
  return chunks;
}

// The faqs table contains CMS test rows ("Test question", "first question", answer "asdasd")
const isJunkFaq = (r) => htmlToText(r.answer).length < 40 ||
  /test|परीक्षण|question|quertion|quation|quetion|^(first|second|third|hindi)\b/i.test(String(r.question));

async function ingestFaqs() {
  const all = await dbConnection.query(`
    SELECT id, lang, type, question, answer, updated_at FROM faqs
    WHERE status = 'ACTIVE' AND lang IN ('en', 'hi') AND question != '' AND answer != ''
    ORDER BY id ${LIMIT ? `LIMIT ${LIMIT}` : ''}`);
  const junk = all.filter(isJunkFaq);
  await deleteIds(junk.flatMap(r => [0, 1, 2].map(i => `faq:${r.id}:${i}`)));
  const rows = all.filter(r => !isJunkFaq(r));
  console.log(`❓ FAQs: ${rows.length} (skipped ${junk.length} test/empty rows)`);
  let chunks = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const items = rows.slice(i, i + 200).map(r => ({
      key: `faq:${r.id}`,
      title: htmlToText(r.question),
      body: htmlToText(r.answer),
      updatedAt: stamp(r.updated_at),
      metadata: { source: 'faq', category: r.type, lang: r.lang }
    }));
    chunks += await indexItems(items, `faqs ${Math.min(i + 200, rows.length)}/${rows.length}`);
  }
  return chunks;
}

// knowledge/*.md with a simple front matter block (title, topic, lang, source_url, last_verified)
function parseGuide(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  (match ? match[1] : '').split('\n').forEach(line => {
    const at = line.indexOf(':');
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  });
  return { meta, body: (match ? match[2] : raw).trim() };
}

async function ingestCurated() {
  const dir = path.join(__dirname, '..', '..', 'knowledge');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')) : [];
  console.log(`📚 Curated guides: ${files.length}`);
  const items = files.map(f => {
    const full = path.join(dir, f);
    const { meta, body } = parseGuide(full);
    return {
      key: `guide:${f.replace(/\.md$/, '')}`,
      title: meta.title || f,
      // One chunk per "## " section so a question matches the focused section, not a mix of topics
      sections: body.split(/^## /m).map(sec => sec.trim()).filter(Boolean)
        .flatMap(sec => chunkText(sec.replace(/^#+\s*/gm, ''))),
      updatedAt: fs.statSync(full).mtime.toISOString(),
      metadata: {
        source: 'guide',
        category: meta.topic,
        lang: meta.lang || 'hi',
        url: meta.source_url,
        date: meta.last_verified,
        year: Number(String(meta.last_verified || '').slice(0, 4)) || 0
      }
    };
  });
  return indexItems(items, 'guides');
}

(async () => {
  const started = Date.now();
  await dbConnection.initialize();
  let chunks = 0;
  if (SOURCE === 'all' || SOURCE === 'curated') chunks += await ingestCurated();
  if (SOURCE === 'all' || SOURCE === 'faqs') chunks += await ingestFaqs();
  if (SOURCE === 'all' || SOURCE === 'news') chunks += await ingestNews();
  console.log(`✅ Done: ${chunks} chunks written in ${Math.round((Date.now() - started) / 1000)}s; collection now holds ${await count()} chunks`);
  process.exit(0);
})().catch(error => {
  console.error('❌ Ingest failed:', error);
  process.exit(1);
});
