const dbConnection = require('../../../config/database');
const { firstImage, tractorUrl, implementUrl, harvesterUrl, plainText } = require('./tjUrls');

const lakh = (rupees) => (rupees ? +(rupees / 100000).toFixed(2) : null);

// Words that carry no search signal; the LLM often passes them in `query`
const STOP_WORDS = new Set(['tractor', 'tractors', 'implement', 'implements', 'harvester', 'harvesters',
  'best', 'price', 'ka', 'ki', 'ke', 'me', 'mein', 'hp', 'new', 'latest', 'kaunsa', 'konsa']);

function keywordConditions(query, columns, params) {
  const words = String(query || '').toLowerCase().split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return words.map(w => {
    columns.forEach(() => params.push(`%${w}%`));
    return `(${columns.map(c => `${c} LIKE ?`).join(' OR ')})`;
  });
}

async function searchTractors(args, ctx) {
  const lang = ctx.dataLang;
  const params = [lang];
  const where = ["tt.lang = ?", "tt.status = 'launched'", 'tt.isActive = 1'];

  // Model names in hi rows are Devanagari, so keyword search always matches the en row's slug/brand too
  where.push(...keywordConditions(args.query, ['tt.model_name', 'tt.slug', 'bt.name'], params));
  if (args.brand) { where.push('(bt.name LIKE ? OR bt.slug LIKE ?)'); params.push(`%${args.brand}%`, `%${args.brand}%`); }
  // tractors_trans.hp is a foreign key into the `hp` lookup table; hp.name holds the engine HP
  if (args.min_hp) { where.push('CAST(h.name AS DECIMAL(5,1)) >= ?'); params.push(args.min_hp); }
  if (args.max_hp) { where.push('CAST(h.name AS DECIMAL(5,1)) <= ?'); params.push(args.max_hp); }
  if (args.max_price_lakh) { where.push('tt.min_price > 0 AND tt.min_price <= ?'); params.push(args.max_price_lakh * 100000); }
  if (args.min_price_lakh) { where.push('tt.max_price >= ?'); params.push(args.min_price_lakh * 100000); }
  if (args.wheel_drive === '4wd') where.push("tt.wheel_drive = '4'");
  if (args.wheel_drive === '2wd') where.push("tt.wheel_drive = '2'");
  if (args.mini) where.push('tt.mini = 1');

  const limit = Math.min(args.limit || 5, 8);
  const rows = await dbConnection.query(`
    SELECT tt.tractors_id, tt.model_name, tt.slug, h.name AS hp, tt.ptohp, tt.price, tt.min_price, tt.max_price,
           tt.wheel_drive, tt.transmission_type, tt.hydraulic_lifting_capacity, tt.fuel_tank_capacity,
           tt.image, tt.images, tt.min_emi, bt.name AS brand_name, bt.slug AS brand_slug
    FROM tractors_trans tt
    LEFT JOIN brands_trans bt ON CAST(tt.brand_id AS UNSIGNED) = bt.brand_id AND bt.lang = 'en'
    LEFT JOIN hp h ON h.id = CAST(tt.hp AS UNSIGNED)
    WHERE ${where.join(' AND ')}
    ORDER BY tt.popular DESC, tt.share_rank DESC, tt.ordering DESC
    LIMIT ${limit}`, params);

  const tractors = rows.map(r => ({
    id: r.tractors_id,
    brand: r.brand_name,
    model: r.model_name,
    hp: r.hp,
    pto_hp: r.ptohp || null,
    price_lakh: r.price || null,
    min_price_lakh: lakh(r.min_price),
    max_price_lakh: lakh(r.max_price),
    wheel_drive: r.wheel_drive ? `${r.wheel_drive}WD` : null,
    transmission: r.transmission_type,
    lifting_capacity: r.hydraulic_lifting_capacity,
    fuel_tank: r.fuel_tank_capacity,
    min_emi: r.min_emi || null,
    image: firstImage(r.images, r.image),
    url: tractorUrl(r.brand_slug, r.slug, ctx.dataLang)
  }));

  return {
    result: { count: tractors.length, tractors: tractors.map(({ image, ...t }) => t) },
    block: tractors.length ? { type: 'tractors', data: tractors } : null
  };
}

// "30 - 55 HP" → [30, 55]
function parseHpRange(text) {
  const nums = String(text || '').match(/\d+/g);
  return nums ? [Number(nums[0]), Number(nums[nums.length - 1])] : null;
}

async function searchImplements(args, ctx) {
  const params = [ctx.dataLang];
  const where = ['it.lang = ?', 'it.status = 1'];
  const words = [args.query, args.category].filter(Boolean).join(' ');
  where.push(...keywordConditions(words, ['it.model_name', 'it.slug', 'itc.name', 'bt.name'], params));
  if (args.brand) { where.push('(bt.name LIKE ? OR bt.slug LIKE ?)'); params.push(`%${args.brand}%`, `%${args.brand}%`); }

  const rows = await dbConnection.query(`
    SELECT it.implements_id, it.model_name, it.slug, it.price, it.min_price, it.max_price, it.tractorPower,
           it.image, it.overview, itc.name AS category, bt.name AS brand_name, bt.slug AS brand_slug
    FROM implements_trans it
    LEFT JOIN implement_type_cate itc ON itc.id = it.implement_cate
    LEFT JOIN brands_trans bt ON bt.brand_id = it.brand AND bt.lang = 'en'
    WHERE ${where.join(' AND ')}
    ORDER BY it.show_priority DESC, it.total_leads DESC
    LIMIT 40`, params);

  let items = rows.map(r => ({
    id: r.implements_id,
    brand: r.brand_name,
    model: r.model_name,
    category: r.category,
    tractor_power: r.tractorPower,
    min_price_lakh: lakh(r.min_price),
    max_price_lakh: lakh(r.max_price),
    summary: plainText(r.overview, 200),
    image: firstImage(null, r.image),
    url: implementUrl(r.brand_slug, r.slug, ctx.dataLang)
  }));

  // HP compatibility is a free-text range, so filter after the query
  if (args.tractor_hp) {
    items = items.filter(i => {
      const range = parseHpRange(i.tractor_power);
      return !range || (args.tractor_hp >= range[0] && args.tractor_hp <= range[1]);
    });
  }
  items = items.slice(0, Math.min(args.limit || 5, 8));

  return {
    result: { count: items.length, implements: items.map(({ image, ...i }) => i) },
    block: items.length ? { type: 'implements', data: items } : null
  };
}

async function searchHarvesters(args, ctx) {
  const params = [ctx.dataLang];
  const where = ['ht.lang = ?', 'ht.status = 1'];
  where.push(...keywordConditions(args.query, ['ht.model_name', 'ht.slug', 'ht.type', 'bt.name'], params));
  if (args.brand) { where.push('(bt.name LIKE ? OR bt.slug LIKE ?)'); params.push(`%${args.brand}%`, `%${args.brand}%`); }
  if (args.crop) {
    // crop column holds a JSON array of harvester_crops ids, e.g. ["1","2"]
    where.push(`EXISTS (SELECT 1 FROM harvester_crops hc WHERE (hc.crop_name_en LIKE ? OR hc.crop_name_hi LIKE ?)
                AND JSON_CONTAINS(ht.crop, JSON_QUOTE(CAST(hc.id AS CHAR))))`);
    params.push(`%${args.crop}%`, `%${args.crop}%`);
  }
  if (args.power_source) { where.push('ht.power_Source LIKE ?'); params.push(`%${args.power_source}%`); }

  const limit = Math.min(args.limit || 5, 8);
  const rows = await dbConnection.query(`
    SELECT ht.harvesters_id, ht.model_name, ht.slug, ht.hprice, ht.show_price, ht.power_Source, ht.type,
           ht.epower, ht.cutterbar, ht.graintank, ht.fuelcapacity, ht.image, ht.crop,
           bt.name AS brand_name, bt.slug AS brand_slug
    FROM harvesters_trans ht
    LEFT JOIN brands_trans bt ON bt.brand_id = CAST(ht.brand AS UNSIGNED) AND bt.lang = 'en'
    WHERE ${where.join(' AND ')}
    ORDER BY ht.total_leads DESC
    LIMIT ${limit}`, params);

  const items = rows.map(r => ({
    id: r.harvesters_id,
    brand: r.brand_name,
    model: r.model_name,
    power_source: r.power_Source === 'self' ? 'Self Propelled' : 'Tractor Mounted',
    type: r.type,
    engine_hp: r.epower || null,
    cutter_bar: r.cutterbar || null,
    grain_tank: r.graintank || null,
    price_lakh: r.show_price && r.hprice ? r.hprice : null,
    image: firstImage(null, r.image),
    url: harvesterUrl(r.harvesters_id, r.brand_slug, r.slug, ctx.dataLang)
  }));

  return {
    result: { count: items.length, harvesters: items.map(({ image, ...h }) => h) },
    block: items.length ? { type: 'harvesters', data: items } : null
  };
}

module.exports = { searchTractors, searchImplements, searchHarvesters, parseHpRange };
