const { searchTractors, searchImplements, searchHarvesters } = require('./products');
const { getWeatherForecast, resolveLocation } = require('./weather');
const { getMandiPrice } = require('./mandi');
const { getSoilInfo } = require('./soil');
const { searchKnowledge } = require('./knowledge');
const { findVehicleMuhurat, todayIST } = require('../../panchang');

async function getTractorMuhurat(args) {
  let lat = args.latitude;
  let lon = args.longitude;
  if ((!lat || !lon) && args.location) {
    const loc = await resolveLocation(args.location);
    if (loc) ({ lat, lon } = loc);
  }
  // Models sometimes guess a past year; never search before today
  const fromDate = args.from_date && args.from_date > todayIST() ? args.from_date : todayIST();
  const data = findVehicleMuhurat({ fromDate, days: args.days || 30, lat, lon });
  data.note = 'Paramparik panchang maanyata par aadharit. Rahu kaal me kharid/booking na karein.';
  return { result: data, block: { type: 'muhurat', data } };
}

const definitions = [
  {
    name: 'search_tractors',
    description: 'Search Tractor Junction tractor catalogue (price, HP, brand, specs). Use for any tractor buying, price, comparison or spec question.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Model/brand keywords in English, e.g. "575 DI", "swaraj 744"' },
        brand: { type: 'string', description: 'Brand in English, e.g. Mahindra, Swaraj, Sonalika, John Deere' },
        min_hp: { type: 'number' },
        max_hp: { type: 'number' },
        min_price_lakh: { type: 'number' },
        max_price_lakh: { type: 'number' },
        wheel_drive: { type: 'string', enum: ['2wd', '4wd'] },
        mini: { type: 'boolean', description: 'Mini/compact tractors for orchards, small farms' },
        limit: { type: 'number', description: 'Max results, default 5' }
      }
    }
  },
  {
    name: 'search_implements',
    description: 'Search farm implements (rotavator, cultivator, plough, seed drill, sprayer, baler, thresher, trolley, etc.) with price and required tractor HP.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Implement type/model keywords in English, e.g. "rotavator", "seed drill"' },
        category: { type: 'string', description: 'e.g. Tillage, Seeding & Plantation, Crop Protection, Harvest, Post Harvest, Haulage' },
        brand: { type: 'string' },
        tractor_hp: { type: 'number', description: "User's tractor HP, to keep only compatible implements" },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'search_harvesters',
    description: 'Search combine harvesters (self-propelled or tractor-mounted) by brand, crop, model.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        brand: { type: 'string' },
        crop: { type: 'string', description: 'Crop in English, e.g. Wheat, Paddy, Soyabean, Maize' },
        power_source: { type: 'string', enum: ['self', 'tractor'] },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'get_mandi_price',
    description: 'Get latest mandi (APMC market) prices for a crop/commodity, optionally filtered by state/district/market. Prices are ₹ per quintal.',
    parameters: {
      type: 'object',
      properties: {
        commodity: { type: 'string', description: 'Crop name in English or Hindi, e.g. Wheat, Soyabean, Onion, gehun' },
        state: { type: 'string', description: 'State in English, e.g. Madhya Pradesh' },
        district: { type: 'string', description: 'District in English, e.g. Indore' },
        market: { type: 'string', description: 'Mandi name, e.g. Indore, Khandwa' }
      },
      required: ['commodity']
    }
  },
  {
    name: 'get_weather_forecast',
    description: 'Weather forecast (up to 14 days) with farm advisories for spraying, irrigation, harvest.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'District/city/village name in English, e.g. Sehore, Ludhiana' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        days: { type: 'number', description: 'Forecast days, default 7' }
      }
    }
  },
  {
    name: 'get_tractor_muhurat',
    description: 'Find auspicious dates (shubh muhurat) to buy a tractor/vehicle using Hindu panchang (tithi, nakshatra, vaar) and Rahu kaal.',
    parameters: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD start date. Omit to start from today; set only for a specific future month/date the user named' },
        days: { type: 'number', description: 'How many days ahead to search, default 30, max 90' },
        location: { type: 'string', description: 'District/city for sunrise and Rahu kaal' }
      }
    }
  },
  {
    name: 'get_soil_info',
    description: 'Soil information: soil type of a state, pH, nutrients, suitable crops, fertilizer tips, recommended tractor HP per crop; or interpret a soil test report.',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'State in English' },
        district: { type: 'string' },
        crop: { type: 'string', description: 'Crop in English' },
        soil_type: { type: 'string', description: 'If user names it: alluvial, black, red, laterite, desert, mountain' },
        soil_test: {
          type: 'object',
          description: 'Soil test values if the user shares them',
          properties: { ph: { type: 'number' }, n: { type: 'number' }, p: { type: 'number' }, k: { type: 'number' }, oc: { type: 'number' } }
        }
      }
    }
  },
  {
    name: 'search_knowledge',
    description: 'Semantic search over Tractor Junction\'s farming knowledge base (6,000+ agri articles, FAQs, curated guides): crop cultivation, varieties, pests and diseases, fertilizer, irrigation, government schemes (PM-Kisan, fasal bima, KCC, subsidy), loans, weather news, tractor maintenance and buying advice. Use it for any farming "how/what/why" question before answering from memory.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The question as a full sentence in the user\'s own words, e.g. "PM Kisan e-KYC kaise kare"' },
        query_hi: { type: 'string', description: 'Same question in Hindi, Devanagari script, e.g. "पीएम किसान ई-केवाईसी कैसे करें"' },
        query_en: { type: 'string', description: 'Same question in English, e.g. "How to do PM Kisan e-KYC"' }
      },
      required: ['query', 'query_hi', 'query_en']
    }
  }
];

const handlers = {
  search_tractors: searchTractors,
  search_implements: searchImplements,
  search_harvesters: searchHarvesters,
  get_mandi_price: getMandiPrice,
  get_weather_forecast: getWeatherForecast,
  get_tractor_muhurat: getTractorMuhurat,
  get_soil_info: getSoilInfo,
  search_knowledge: searchKnowledge
};

const TOOL_TIMEOUT_MS = 20000;

async function executeTool(name, args, ctx) {
  const handler = handlers[name];
  if (!handler) return { result: { error: `unknown_tool ${name}` } };
  try {
    return await Promise.race([
      handler(args || {}, ctx),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tool timeout')), TOOL_TIMEOUT_MS))
    ]);
  } catch (error) {
    console.error(`❌ Tool ${name} failed:`, error.message);
    return { result: { error: 'tool_failed', message: 'Data abhi uplabdh nahi hai, baad me koshish karein.' } };
  }
}

module.exports = {
  tools: definitions.map(fn => ({ type: 'function', function: fn })),
  executeTool
};
