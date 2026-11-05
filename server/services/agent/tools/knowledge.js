const dbConnection = require('../../../config/database');
const { plainText, newsUrl } = require('./tjUrls');
const { searchKnowledgeStore } = require('../knowledgeStore');

// Cosine distance above this is treated as "not about the question" (text-embedding-3-small)
const MAX_DISTANCE = 0.62;
const SOURCE_LABEL = { news: 'TJ article', faq: 'TJ FAQ', guide: 'Kisan Mitra guide' };

// Semantic search over the farm_knowledge index (scripts/ingest/ingestKnowledge.js)
async function vectorSearch(queries) {
  const hits = await searchKnowledgeStore(queries, { k: 10 });
  const seen = new Set();
  const items = [];
  for (const hit of hits) {
    if (hit.distance > MAX_DISTANCE) continue;
    // One chunk per article keeps the context diverse
    const docKey = hit.id.replace(/:\d+$/, '');
    if (seen.has(docKey)) continue;
    seen.add(docKey);
    items.push({
      kind: SOURCE_LABEL[hit.metadata.source] || hit.metadata.source,
      title: hit.metadata.title,
      date: hit.metadata.date || null,
      url: hit.metadata.url || null,
      relevance: +(1 - hit.distance).toFixed(2),
      text: hit.text
    });
    if (items.length === 5) break;
  }
  return items;
}

// Fallback when ChromaDB is down: keyword match on FAQ questions and article titles
async function keywordSearch(query, lang) {
  const words = String(query || '').split(/\s+/).filter(w => w.length > 2).slice(0, 6);
  if (!words.length) return [];

  const faqParams = [lang];
  const faqWhere = words.map(w => { faqParams.push(`%${w}%`); return 'question LIKE ?'; });
  const faqs = await dbConnection.query(`
    SELECT question, answer FROM faqs
    WHERE lang = ? AND status = 'ACTIVE' AND (${faqWhere.join(' OR ')})
    LIMIT 30`, faqParams);

  const newsParams = [];
  const newsWhere = words.map(w => { newsParams.push(`%${w}%`); return 'n.title LIKE ?'; });
  const news = await dbConnection.query(`
    SELECT n.title, n.description, n.slug, n.date, nc.slug AS category_slug
    FROM news n LEFT JOIN news_category nc ON nc.id = n.category_id
    WHERE n.status = 1 AND (${newsWhere.join(' OR ')})
    ORDER BY n.date DESC LIMIT 30`, newsParams);

  // Rank by how many query words each item contains
  const score = (text) => words.reduce((s, w) => s + (String(text).toLowerCase().includes(w.toLowerCase()) ? 1 : 0), 0);
  return [
    ...faqs.map(f => ({ kind: 'TJ FAQ', title: f.question, text: plainText(f.answer, 400), s: score(f.question) })),
    ...news.map(n => ({ kind: 'TJ article', title: plainText(n.title, 200), date: n.date, text: plainText(n.description, 600), url: newsUrl(n.category_slug, n.slug), s: score(n.title) }))
  ].sort((a, b) => b.s - a.s).slice(0, 5).map(({ s, ...i }) => i);
}

async function searchKnowledge(args, ctx) {
  let items;
  try {
    // Most TJ content is Devanagari Hindi; romanized Hinglish embeds poorly against it, so search all phrasings
    items = await vectorSearch([args.query, args.query_hi, args.query_en]);
  } catch (error) {
    console.log('⚠️ Knowledge vector search unavailable, using keyword search:', error.message);
    items = await keywordSearch(args.query, ctx.dataLang);
  }

  const sources = items.filter(i => i.url).slice(0, 3).map(({ kind, title, date, url }) => ({ kind, title, date, url }));
  return {
    result: items.length
      ? { count: items.length, items }
      : { count: 0, message: 'Is sawaal par TJ knowledge base me jaankari nahi mili. Andaza mat lagao; KVK / Kisan Call Centre 1800-180-1551 ki salah do.' },
    block: sources.length ? { type: 'sources', data: sources } : null
  };
}

module.exports = { searchKnowledge };
