const dbConnection = require('../../../config/database');

// Reference profiles for India's major soil groups (ICAR / NBSS&LUP classification, typical ranges)
const SOIL_TYPES = {
  'Alluvial Soil': {
    hi: 'जलोढ़ (दोमट) मिट्टी',
    ph: '6.5-8.0', texture: 'Sandy loam to clay loam',
    nutrients: { N: 'low', P: 'low-medium', K: 'medium-high', organic_carbon: 'low' },
    crops: ['Wheat', 'Rice', 'Sugarcane', 'Maize', 'Pulses', 'Oilseeds', 'Vegetables'],
    tips: ['Nitrogen aur phosphorus ki kami aam hai: soil test ke hisaab se urea/DAP dein', 'Gobar khad / hari khad (dhaincha) se organic carbon badhayein', 'Zinc ki kami me 25 kg/ha zinc sulphate']
  },
  'Black Cotton Soil': {
    hi: 'काली (रेगुर) मिट्टी',
    ph: '7.5-8.5', texture: 'Clayey, high water holding, cracks when dry',
    nutrients: { N: 'low', P: 'low', K: 'high', organic_carbon: 'low-medium' },
    crops: ['Cotton', 'Soyabean', 'Wheat', 'Jowar', 'Chickpea', 'Tur', 'Sugarcane'],
    tips: ['Paani nikasi (drainage) zaroori, khet me paani na rukne dein', 'Bhari mitti: zyada HP (45+) tractor aur MB plough / rotavator achha', 'Phosphorus ke liye SSP/DAP, gandhak (sulphur) bhi dein']
  },
  'Red & Yellow Soil': {
    hi: 'लाल और पीली मिट्टी',
    ph: '5.5-7.0', texture: 'Sandy to loamy, porous',
    nutrients: { N: 'low', P: 'low', K: 'medium', organic_carbon: 'low' },
    crops: ['Groundnut', 'Ragi', 'Millets', 'Pulses', 'Rice (irrigated)', 'Tobacco', 'Potato'],
    tips: ['Amliya (acidic) ho to choona (lime) dein', 'Gobar khad aur mulching se nami bachayein', 'Halki mitti: 30-45 HP tractor kaafi']
  },
  'Laterite Soil': {
    hi: 'लेटराइट मिट्टी',
    ph: '4.5-6.0', texture: 'Coarse, leached, low fertility',
    nutrients: { N: 'low', P: 'low', K: 'low', organic_carbon: 'low-medium' },
    crops: ['Tea', 'Coffee', 'Cashew', 'Coconut', 'Rubber', 'Rice'],
    tips: ['Choona dekar pH sudharein', 'Organic khad bahut zaroori', 'Dhalan wale khet me contour bunding']
  },
  'Arid or Desert Soil': {
    hi: 'शुष्क / रेतीली मिट्टी',
    ph: '7.5-8.5', texture: 'Sandy, very low water holding',
    nutrients: { N: 'very low', P: 'medium', K: 'medium', organic_carbon: 'very low' },
    crops: ['Bajra', 'Moth', 'Guar', 'Mustard', 'Cumin', 'Moong'],
    tips: ['Drip/sprinkler sinchai se paani bachayein', 'Mulching aur gobar khad', 'Hawa se mitti katav rokne ke liye ped/hedge']
  },
  'Mountain Soil': {
    hi: 'पर्वतीय मिट्टी',
    ph: '5.0-6.5', texture: 'Loamy, rich in humus, shallow',
    nutrients: { N: 'medium', P: 'low', K: 'low', organic_carbon: 'high' },
    crops: ['Apple', 'Tea', 'Maize', 'Potato', 'Spices'],
    tips: ['Terrace farming', 'Choti/mini tractor ya power tiller behtar']
  }
};

// Lab soil-test thresholds (Soil Health Card norms)
function interpretSoilTest(test) {
  if (!test) return null;
  const out = {};
  if (test.ph != null) out.ph = test.ph < 6.5 ? 'Amliya (acidic): choona dein' : test.ph > 8.5 ? 'Kshariya (alkaline): gypsum dein' : 'Theek (normal)';
  if (test.n != null) out.N = test.n < 280 ? 'Kam (<280 kg/ha)' : test.n > 560 ? 'Zyada (>560 kg/ha)' : 'Madhyam';
  if (test.p != null) out.P = test.p < 10 ? 'Kam (<10 kg/ha)' : test.p > 25 ? 'Zyada (>25 kg/ha)' : 'Madhyam';
  if (test.k != null) out.K = test.k < 110 ? 'Kam (<110 kg/ha)' : test.k > 280 ? 'Zyada (>280 kg/ha)' : 'Madhyam';
  if (test.oc != null) out.organic_carbon = test.oc < 0.5 ? 'Kam (<0.5%)' : test.oc > 0.75 ? 'Achha (>0.75%)' : 'Madhyam';
  return out;
}

async function getSoilInfo(args) {
  let soilType = args.soil_type && Object.keys(SOIL_TYPES).find(k => k.toLowerCase().includes(args.soil_type.toLowerCase()));
  let cropRules = [];

  if (args.state) {
    // TJ's tractor recommendation rules map each state to its dominant soil and the HP/budget per crop
    cropRules = await dbConnection.query(`
      SELECT soil_type, crop_name, hp_min, hp_max, budget_text
      FROM tractor_recommendation_state_crop_rules
      WHERE is_active = 1 AND state_name LIKE ? ${args.crop ? 'AND crop_name LIKE ?' : ''}
      ORDER BY priority LIMIT 8`, args.crop ? [`%${args.state}%`, `%${args.crop}%`] : [`%${args.state}%`]);
    if (!soilType && cropRules[0]) soilType = cropRules[0].soil_type;
  }

  if (!soilType && !args.soil_test) {
    return { result: { error: 'need_location', message: 'State ya mitti ka prakar poochein (jaise kali, lal, domat, retili).' } };
  }

  const data = {
    state: args.state || null,
    district: args.district || null,
    soil_type: soilType || null,
    profile: soilType ? SOIL_TYPES[soilType] : null,
    soil_test: interpretSoilTest(args.soil_test),
    tractor_for_crops: cropRules.map(r => ({ crop: r.crop_name, hp: `${r.hp_min}-${r.hp_max} HP`, budget: r.budget_text })),
    note: 'State ki pramukh mitti ka anuman hai; sahi jaankari ke liye Soil Health Card test karayein (nazdeeki KVK / krishi vibhag).'
  };
  return { result: data, block: { type: 'soil', data } };
}

module.exports = { getSoilInfo, SOIL_TYPES, interpretSoilTest };
