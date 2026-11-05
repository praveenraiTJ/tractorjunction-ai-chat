// Vector store for farming knowledge (TJ news/articles, FAQs, curated guides) in ChromaDB.
// Embeddings are computed here with OpenAI, never by Chroma's default English-only model.
const { ChromaClient } = require('chromadb');
const { embed, EMBED_MODEL } = require('./embeddings');

// Changing the embedding model/dimensions needs a new collection (and a full re-ingest)
const COLLECTION = process.env.KNOWLEDGE_COLLECTION || 'farm_knowledge_v2';
let collectionPromise = null;

// Chroma requires an embedding function object; ours are always passed in explicitly
const noEmbeddingFunction = {
  generate: async () => { throw new Error('farm_knowledge: pass embeddings explicitly'); }
};

function getCollection() {
  if (!collectionPromise) {
    const client = new ChromaClient({ path: `http://${process.env.CHROMA_HOST || 'localhost'}:${process.env.CHROMA_PORT || 8000}` });
    collectionPromise = client.getOrCreateCollection({
      name: COLLECTION,
      metadata: { 'hnsw:space': 'cosine', embedding_model: EMBED_MODEL },
      embeddingFunction: noEmbeddingFunction
    }).catch(error => {
      collectionPromise = null;
      throw error;
    });
  }
  return collectionPromise;
}

// Chroma metadata values must be string | number | boolean
function cleanMetadata(metadata) {
  return Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

/** docs: [{ id, text, embedText?, metadata }] */
async function upsertDocs(docs) {
  if (!docs.length) return;
  const collection = await getCollection();
  const embeddings = await embed(docs.map(d => d.embedText || d.text));
  await collection.upsert({
    ids: docs.map(d => d.id),
    documents: docs.map(d => d.text),
    metadatas: docs.map(d => cleanMetadata(d.metadata)),
    embeddings
  });
}

async function getMetadatas(ids) {
  const collection = await getCollection();
  const res = await collection.get({ ids, include: ['metadatas'] });
  return Object.fromEntries(res.ids.map((id, i) => [id, res.metadatas[i]]));
}

async function deleteIds(ids) {
  if (!ids.length) return;
  const collection = await getCollection();
  await collection.delete({ ids });
}

/**
 * Searches with one or more phrasings of the same question (e.g. Hinglish + Hindi + English) in one
 * embedding call. Returns [{ id, text, metadata, distance }] by best cosine distance (0 = identical).
 */
async function searchKnowledgeStore(queries, { k = 6, where } = {}) {
  const list = [...new Set([].concat(queries).map(q => String(q || '').trim()).filter(Boolean))];
  if (!list.length) return [];
  const collection = await getCollection();
  const res = await collection.query({
    queryEmbeddings: await embed(list),
    nResults: k,
    ...(where ? { where } : {}),
    include: ['documents', 'metadatas', 'distances']
  });

  const best = new Map();
  res.ids.forEach((ids, q) => ids.forEach((id, i) => {
    const distance = res.distances[q][i];
    if (!best.has(id) || distance < best.get(id).distance) {
      best.set(id, { id, text: res.documents[q][i], metadata: res.metadatas[q][i], distance });
    }
  }));
  return [...best.values()].sort((a, b) => a.distance - b.distance);
}

async function count() {
  return (await getCollection()).count();
}

module.exports = { upsertDocs, getMetadatas, deleteIds, searchKnowledgeStore, count, COLLECTION };
