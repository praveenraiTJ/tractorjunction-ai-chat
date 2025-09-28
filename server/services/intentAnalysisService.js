const { OpenAI } = require('openai');

class IntentAnalysisService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async analyzeIntent(query) {
    try {
      const prompt = `
Analyze the following user query and determine if it's related to tractors or agricultural equipment based on the tractors_trans table schema.

Query: "${query}"

Table columns: id, tractors_id, lang, brand_id, series_id, price, min_price, max_price, hp, fuel_pump, transmission_type, wheel_drive, lifting_capacity, applications, model_name, status, valuation_category, mini (TINYINT), ac_cabin (TINYINT), 2wd (INT), 4wd (INT), latest (INT), popular (VARCHAR), etc.

Respond with a JSON object containing:
{
  "isTractorRelated": boolean,
  "intent": "search" | "compare" | "recommend" | "specifications" | "price" | "general",
  "searchTerms": ["term1", "term2", ...],
  "filters": {
    "brand": "string or null",
    "category": "string or null",
    "priceRange": {"min": number, "max": number} or null,
    "powerRange": {"min": number, "max": number} or null,
    "fuelType": "string or null",
    "wheelDrive": "2wd" | "4wd" | null,
    "liftingCapacity": {"min": number, "max": number} or null,
    "isMini": boolean or null,
    "hasAcCabin": boolean or null,
    "isLatest": boolean or null,
    "isPopular": boolean or null,
    "isElectric": boolean or null
  },
  "confidence": number (0-1)
}

Examples:
- "Show me Mahindra mini tractors" → {"isTractorRelated": true, "intent": "search", "searchTerms": ["Mahindra", "mini"], "filters": {"brand": "Mahindra", "isMini": true}, "confidence": 0.9}
- "Price of latest John Deere tractors" → {"isTractorRelated": true, "intent": "price", "searchTerms": ["John Deere", "latest"], "filters": {"brand": "John Deere", "isLatest": true}, "confidence": 0.95}
- "Best 4WD tractor for small farms" → {"isTractorRelated": true, "intent": "recommend", "searchTerms": ["small farms", "4WD"], "filters": {"wheelDrive": "4wd"}, "confidence": 0.85}
- "Electric tractors for farming" → {"isTractorRelated": true, "intent": "search", "searchTerms": ["electric", "farming"], "filters": {"isElectric": true}, "confidence": 0.9}
- "Hello, how are you?" → {"isTractorRelated": false, "intent": "general", "searchTerms": [], "filters": {}, "confidence": 0.1}
`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing agricultural equipment queries. Respond with ONLY valid JSON. Do not include markdown, code blocks, or additional text.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      let content = response.choices[0].message.content.trim();
      if (content.includes('```json')) {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) content = jsonMatch[1].trim();
      } else if (content.includes('```')) {
        const jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) content = jsonMatch[1].trim();
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        isTractorRelated: false,
        intent: 'general',
        searchTerms: [],
        filters: {},
        confidence: 0
      };
    }
  }

  generateSQLQuery(intentData) {
    if (!intentData.isTractorRelated) return null;

    let sql = `
      SELECT 
        tt.id,
        tt.tractors_id,
        tt.model_name,
        tt.price,
        tt.min_price,
        tt.max_price,
        tt.hp,
        tt.fuel_pump,
        tt.transmission_type,
        tt.wheel_drive,
        tt.hydraulic_lifting_capacity,
        tt.applications,
        tt.image,
        tt.images,
        tt.status,
        tt.brand_id,
        tt.mini,
        tt.ac_cabin,
        tt.2wd,
        tt.latest,
        tt.popular,
        bt.name as brand_name,
        bt.slug as brand_slug
      FROM tractors_trans tt
      LEFT JOIN brands_trans bt ON CAST(tt.brand_id AS UNSIGNED) = bt.brand_id AND bt.lang = 'en'
      WHERE tt.status = 'launched' AND tt.lang = 'en' AND tt.isActive = 1
    `;

    const conditions = [];
    const params = [];

    if (intentData.searchTerms?.length > 0) {
      const allVariations = [];
      intentData.searchTerms.forEach(term => {
        const variations = [
          term,
          term.replace(/(\d+)([A-Z])/g, '$1 $2'),
          term.replace(/([A-Z])(\d+)/g, '$1 $2'),
          term.replace(/(\d+)([a-z])/g, '$1 $2')
        ];
        variations.forEach(variation => {
          if (!allVariations.includes(variation)) allVariations.push(variation);
        });
      });

      const searchConditions = allVariations.map(variation => {
        params.push(`%${variation}%`, `%${variation}%`, `%${variation}%`, `%${variation}%`);
        return `(tt.model_name LIKE ? OR bt.name LIKE ? OR tt.overview LIKE ? OR tt.applications LIKE ?)`;
      });
      conditions.push(`(${searchConditions.join(' OR ')})`);
    }

    if (intentData.filters.brand) {
      conditions.push('bt.name = ?');
      params.push(intentData.filters.brand);
    }

    if (intentData.filters.category && intentData.filters.category !== 'tractor') {
      conditions.push('tt.applications LIKE ?');
      params.push(`%${intentData.filters.category}%`);
    }

    if (intentData.filters.priceRange) {
      if (intentData.filters.priceRange.min) {
        conditions.push('tt.min_price >= ?');
        params.push(intentData.filters.priceRange.min);
      }
      if (intentData.filters.priceRange.max) {
        conditions.push('tt.max_price <= ?');
        params.push(intentData.filters.priceRange.max);
      }
    }

    if (intentData.filters.powerRange) {
      if (intentData.filters.powerRange.min) {
        conditions.push('CAST(tt.hp AS UNSIGNED) >= ?');
        params.push(intentData.filters.powerRange.min);
      }
      if (intentData.filters.powerRange.max) {
        conditions.push('CAST(tt.hp AS UNSIGNED) <= ?');
        params.push(intentData.filters.powerRange.max);
      }
    }

    if (intentData.filters.fuelType) {
      conditions.push('tt.fuel_pump LIKE ?');
      params.push(`%${intentData.filters.fuelType}%`);
    }

    if (intentData.filters.wheelDrive) {
      if (intentData.filters.wheelDrive === '2wd') {
        conditions.push('tt.2wd = 1');
      } else if (intentData.filters.wheelDrive === '4wd') {
        conditions.push('tt.wheel_drive = ?');
        params.push('4');
      }
    }

    if (intentData.filters.liftingCapacity) {
      if (intentData.filters.liftingCapacity.min) {
        conditions.push('CAST(tt.hydraulic_lifting_capacity AS UNSIGNED) >= ?');
        params.push(intentData.filters.liftingCapacity.min);
      }
      if (intentData.filters.liftingCapacity.max) {
        conditions.push('CAST(tt.hydraulic_lifting_capacity AS UNSIGNED) <= ?');
        params.push(intentData.filters.liftingCapacity.max);
      }
    }

    if (intentData.filters.isMini !== null) {
      conditions.push('tt.mini = ?');
      params.push(intentData.filters.isMini ? 1 : 0);
    }

    if (intentData.filters.hasAcCabin !== null) {
      conditions.push('tt.ac_cabin = ?');
      params.push(intentData.filters.hasAcCabin ? 1 : 0);
    }

    if (intentData.filters.isLatest !== null) {
      conditions.push('tt.latest = ?');
      params.push(intentData.filters.isLatest ? 1 : 0);
    }

    if (intentData.filters.isPopular !== null) {
      conditions.push('tt.popular != ?');
      params.push('0');
    }

    if (intentData.filters.isElectric !== null) {
      if (intentData.filters.isElectric) {
        conditions.push('tt.electrical_system IS NOT NULL AND tt.electrical_system != ""');
      } else {
        conditions.push('(tt.electrical_system IS NULL OR tt.electrical_system = "")');
      }
    }

    if (conditions.length > 0) {
      sql += ` AND ${conditions.join(' AND ')}`;
    }

    switch (intentData.intent) {
      case 'price':
        sql += ' ORDER BY tt.min_price ASC';
        break;
      case 'recommend':
        sql += ' ORDER BY tt.popular DESC, tt.latest DESC, tt.hp DESC';
        break;
      case 'specifications':
        sql += ' ORDER BY tt.hp DESC, tt.ordering DESC';
        break;
      default:
        sql += ' ORDER BY tt.ordering DESC, tt.share_rank DESC';
    }

    sql += ' LIMIT 10';

    return { sql, params };
  }

  createEnhancedPrompt(originalQuery, intentData, tractorData) {
    if (!intentData.isTractorRelated || !tractorData || tractorData.length === 0) {
      return null;
    }

    const tractorInfo = tractorData.map(tractor => ({
      id: tractor.id,
      brand: tractor.brand_name || 'Unknown',
      model: tractor.model_name,
      price: tractor.price || 'Contact for price',
      min_price: tractor.min_price,
      max_price: tractor.max_price,
      engine_power: tractor.hp,
      fuel_type: tractor.fuel_pump || 'Not specified',
      transmission: tractor.transmission_type || 'Not specified',
      wheel_drive: tractor.wheel_drive || (tractor['2wd'] ? '2WD' : 'Not specified'),
      lifting_capacity: tractor.hydraulic_lifting_capacity || 'Not specified',
      category: tractor.applications || 'General Purpose',
      is_mini: tractor.mini ? 'Mini Tractor' : 'Standard Tractor',
      has_ac_cabin: tractor.ac_cabin ? 'AC Cabin' : 'No AC Cabin',
      is_latest: tractor.latest ? 'Latest Model' : 'Standard Model',
      is_popular: tractor.popular !== '0' ? 'Popular' : 'Standard',
      is_electric: tractor.electrical_system ? 'Electric Tractor' : 'Standard Tractor',
      description: tractor.overview?.substring(0, 200) + '...' || 'No description available'
    }));

    const prompt = `
You are an agricultural equipment expert. The user asked: "${originalQuery}"

Found ${tractorData.length} relevant tractors:

${tractorInfo.map((tractor, index) => `
${index + 1}. ${tractor.brand} ${tractor.model}
   - Price: ₹${tractor.min_price?.toLocaleString('en-IN') || 'Contact for price'} - ₹${tractor.max_price?.toLocaleString('en-IN') || 'Contact for price'}
   - Engine Power: ${tractor.engine_power} HP
   - Fuel Type: ${tractor.fuel_type}
   - Transmission: ${tractor.transmission}
   - Wheel Drive: ${tractor.wheel_drive}
   - Lifting Capacity: ${tractor.lifting_capacity}
   - Category: ${tractor.category}
   - Type: ${tractor.is_mini}
   - Cabin: ${tractor.has_ac_cabin}
   - Power Source: ${tractor.is_electric}
   - Status: ${tractor.is_latest}, ${tractor.is_popular}
   - Description: ${tractor.description}
`).join('\n')}

Provide a response that:
1. Answers the user's question directly
2. References relevant tractors by model and brand
3. Highlights key features (e.g., HP, lifting capacity, wheel drive, mini/latest/popular status)
4. Suggests contacting dealers for quotes or demos
5. Keeps the tone conversational, under 300 words
6. Uses Indian currency format (₹) for prices
`;

    return prompt;
  }
}

module.exports = new IntentAnalysisService();