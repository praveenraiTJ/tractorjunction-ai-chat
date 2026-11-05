const OpenAI = require('openai');

// -large is much better on Hindi than -small (same-meaning Hindi pairs: cosine distance ~0.55 vs ~0.75).
// 1024 dims keeps most of its quality at a third of the storage.
const MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-large';
const DIMENSIONS = Number(process.env.OPENAI_EMBED_DIMENSIONS) || 1024;
const BATCH = 96;
let client = null;

// Created lazily so requiring this module never needs OPENAI_API_KEY at load time
const openai = () => client || (client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function embedBatch(texts) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await openai().embeddings.create({ model: MODEL, input: texts, dimensions: DIMENSIONS });
      return res.data.map(d => d.embedding);
    } catch (error) {
      // 429 is also used for an empty credit balance, which retrying cannot fix
      const retriable = (error.status === 429 && error.code !== 'insufficient_quota' && error.type !== 'insufficient_quota') ||
        error.status >= 500 || !error.status;
      if (!retriable || attempt >= 5) throw error;
      await sleep(Math.min(30000, 1000 * 2 ** attempt));
    }
  }
}

// Multilingual embeddings (Hindi + English share one vector space)
async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...await embedBatch(texts.slice(i, i + BATCH)));
  }
  return out;
}

module.exports = { embed, EMBED_MODEL: `${MODEL}@${DIMENSIONS}` };
