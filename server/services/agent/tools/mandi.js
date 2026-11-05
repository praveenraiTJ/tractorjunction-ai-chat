const dbConnection = require('../../../config/database');
const { getCache, setCache } = require('../../cacheService');

// data.gov.in: "Current Daily Price of Various Commodities from Various Markets (Mandi)"
const RESOURCE_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

// Local / Hindi names → keyword matched (case-insensitive substring) against Agmarknet commodity names,
// which vary in spelling, e.g. "Paddy(Common)", "Paddy(Basmati)", "Red gram/Arhar/Tur(whole)"
const COMMODITY_ALIASES = {
  'gehun': 'wheat', 'gehu': 'wheat', 'गेहूं': 'wheat', 'गेहूँ': 'wheat',
  'dhan': 'paddy', 'dhaan': 'paddy', 'धान': 'paddy', 'basmati': 'paddy(basmati)', 'बासमती': 'paddy(basmati)',
  'chawal': 'rice', 'चावल': 'rice',
  'soybean': 'soyabean', 'सोयाबीन': 'soyabean',
  'sarson': 'mustard', 'सरसों': 'mustard',
  'pyaz': 'onion', 'pyaaz': 'onion', 'प्याज': 'onion',
  'aalu': 'potato', 'aloo': 'potato', 'आलू': 'potato',
  'tamatar': 'tomato', 'टमाटर': 'tomato',
  'chana': 'bengal gram', 'चना': 'bengal gram', 'gram': 'bengal gram',
  'makka': 'maize', 'मक्का': 'maize', 'corn': 'maize',
  'kapas': 'cotton', 'कपास': 'cotton',
  'lahsun': 'garlic', 'लहसुन': 'garlic',
  'hari mirch': 'green chilli', 'हरी मिर्च': 'green chilli', 'mirch': 'chilli', 'मिर्च': 'chilli',
  'arhar': 'arhar', 'tur': 'arhar', 'toor': 'arhar', 'अरहर': 'arhar', 'तुअर': 'arhar',
  'moong': 'moong', 'मूंग': 'moong',
  'urad': 'urd', 'उड़द': 'urd',
  'masoor': 'masur', 'मसूर': 'masur',
  'moongfali': 'groundnut', 'मूंगफली': 'groundnut',
  'bajra': 'bajra', 'बाजरा': 'bajra',
  'jowar': 'jowar', 'ज्वार': 'jowar',
  'jau': 'barley', 'जौ': 'barley',
  'til': 'sesamum', 'तिल': 'sesamum',
  'jeera': 'cumin', 'जीरा': 'cumin',
  'haldi': 'turmeric', 'हल्दी': 'turmeric',
  'dhaniya': 'coriander', 'धनिया': 'coriander',
  'gobhi': 'cauliflower', 'फूलगोभी': 'cauliflower', 'patta gobhi': 'cabbage', 'पत्ता गोभी': 'cabbage',
  'baingan': 'brinjal', 'बैंगन': 'brinjal',
  'bhindi': 'bhindi', 'भिंडी': 'bhindi',
  'adrak': 'ginger', 'अदरक': 'ginger',
  'kela': 'banana', 'केला': 'banana', 'seb': 'apple', 'सेब': 'apple'
};

const commodityKeyword = (name) => {
  const key = String(name).trim().toLowerCase();
  return COMMODITY_ALIASES[key] || key;
};
const contains = (field, value) => !value || String(field || '').toLowerCase().includes(String(value).toLowerCase());

// "04/11/2026" → "2026-11-04" so records sort by date
const isoDate = (d) => (/^\d{2}\/\d{2}\/\d{4}$/.test(d) ? d.split('/').reverse().join('-') : String(d).slice(0, 10));

async function fromLocalTable(keyword, args) {
  const params = [`%${keyword}%`];
  let sql = `SELECT state, district, market, commodity, variety, min_price, max_price, modal_price, arrival_date
             FROM mandi_price WHERE commodity LIKE ? AND arrival_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
  if (args.state) { sql += ' AND state LIKE ?'; params.push(`%${args.state}%`); }
  if (args.district) { sql += ' AND district LIKE ?'; params.push(`%${args.district}%`); }
  sql += ' ORDER BY arrival_date DESC LIMIT 200';
  return dbConnection.query(sql, params);
}

const PAGE_SIZE = 2000;
let inflight = null;

// data.gov.in drops large responses mid-transfer, so pages are small and retried once
async function fetchPage(key, offset) {
  const q = new URLSearchParams({ 'api-key': key, format: 'json', limit: String(PAGE_SIZE), offset: String(offset) });
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${RESOURCE_URL}?${q}`);
      if (!res.ok) throw new Error(`data.gov.in ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt >= 1) throw error;
    }
  }
}

// The resource holds only the latest day (~7k rows), so fetch it whole once and match locally
async function fetchTodaysPrices() {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) return null;
  const cached = getCache('mandi_all');
  if (cached) return cached;

  // Concurrent questions share one download
  inflight = inflight || (async () => {
    const first = await fetchPage(key, 0);
    const total = Number(first.total) || 0;
    const rest = [];
    for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) rest.push(fetchPage(key, offset));
    const records = [first, ...(await Promise.all(rest))].flatMap(page => page.records || []);
    setCache('mandi_all', records, 6 * 3600);
    return records;
  })().finally(() => { inflight = null; });
  return inflight;
}

function mostCommon(values) {
  const counts = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

async function getMandiPrice(args) {
  const keyword = commodityKeyword(args.commodity);
  let records = await fromLocalTable(keyword, args);
  let source = 'tj_db';
  if (!records.length) {
    const live = await fetchTodaysPrices();
    if (live === null) {
      return { result: { error: 'mandi_source_not_configured', message: 'Mandi bhav ka data source abhi set nahi hai. User ko batayein ki abhi live bhav uplabdh nahi hai.' } };
    }
    records = live.filter(r => contains(r.commodity, keyword) && contains(r.state, args.state) && contains(r.district, args.district));
    source = 'data.gov.in (Agmarknet)';
  }
  if (args.market) {
    const inMarket = records.filter(r => contains(r.market, args.market));
    if (inMarket.length) records = inMarket;
  }
  if (!records.length) {
    return { result: { error: 'no_data', commodity: args.commodity, state: args.state, district: args.district, message: 'Is mandi/fasal ka aaj ka bhav nahi mila. Paas ke zile ya state ka naam poochein.' } };
  }

  const rows = records.map(r => ({
    state: r.state, district: r.district, market: r.market, variety: r.variety,
    date: isoDate(r.arrival_date instanceof Date ? r.arrival_date.toISOString() : r.arrival_date),
    min: Number(r.min_price), max: Number(r.max_price), modal: Number(r.modal_price)
  })).sort((a, b) => b.date.localeCompare(a.date) || b.modal - a.modal);

  const modals = rows.map(r => r.modal).filter(Boolean);
  const data = {
    // several matched names (e.g. Paddy(Common) + Paddy(Basmati)) → show the most frequent
    commodity: mostCommon(records.map(r => r.commodity)),
    unit: '₹/quintal',
    source,
    latest_date: rows[0].date,
    summary: {
      markets: rows.length,
      avg_modal: Math.round(modals.reduce((s, v) => s + v, 0) / modals.length),
      highest: rows.reduce((a, b) => (b.modal > a.modal ? b : a)),
      lowest: rows.reduce((a, b) => (b.modal < a.modal ? b : a))
    },
    rows: rows.slice(0, 10)
  };
  return { result: data, block: { type: 'mandi_price', data } };
}

// Called at server start and every 6h so the first farmer question doesn't pay for the ~7k-row download
function warmMandiCache() {
  fetchTodaysPrices()
    .then(records => records && console.log(`✅ Mandi prices cached: ${records.length} records`))
    .catch(error => console.log('⚠️ Mandi price prefetch failed:', error.message));
}

module.exports = { getMandiPrice, warmMandiCache, commodityKeyword, COMMODITY_ALIASES };
