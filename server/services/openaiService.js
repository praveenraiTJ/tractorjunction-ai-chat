const OpenAI = require('openai');
const crypto = require('crypto');
const dbConnection = require('../config/database');
const { getCache, setCache } = require('./cacheService');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  // Helper function to check database connectivity
  async checkDatabaseConnection() {
    try {
      await dbConnection.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate hash for query caching
  generateQueryHash(query, context = '') {
    return crypto
      .createHash('sha256')
      .update(query.toLowerCase().trim() + context)
      .digest('hex');
  }

  // Check if response exists in cache
  async getCachedResponse(query, context = '') {
    try {
      const queryHash = this.generateQueryHash(query, context);

      // Check in-memory cache first
      const cachedResponse = getCache(`openai_${queryHash}`);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Check database connection before attempting database cache
      const dbConnected = await this.checkDatabaseConnection();

      if (dbConnected) {
        // Check database cache
        const cacheResult = await dbConnection.query(
          'SELECT response_data FROM query_cache WHERE query_hash = ? AND expires_at > NOW()',
          [queryHash]
        );

        if (cacheResult.length > 0) {
          const responseData = cacheResult[0].response_data;
          // Store in memory cache for faster access
          setCache(`openai_${queryHash}`, responseData, 3600); // 1 hour
          return responseData;
        }
      } else {
        console.log('⚠️ Database not available, using memory cache only');
      }

      return null;
    } catch (error) {
      console.error('Error checking cache:', error);
      return null;
    }
  }

  // Store response in cache
  async cacheResponse(query, context, response, ttl = 3600) {
    try {
      const queryHash = this.generateQueryHash(query, context);
      const expiresAt = new Date(Date.now() + ttl * 1000);

      // Check database connection before attempting database cache
      const dbConnected = await this.checkDatabaseConnection();

      if (dbConnected) {
        // Store in database cache
        await dbConnection.query(
          'INSERT INTO query_cache (query_hash, query_text, response_data, expires_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE response_data = VALUES(response_data), expires_at = VALUES(expires_at)',
          [queryHash, query, JSON.stringify(response), expiresAt]
        );
      } else {
        console.log('⚠️ Database not available, using memory cache only');
      }

      // Store in memory cache (always available)
      setCache(`openai_${queryHash}`, response, ttl);

    } catch (error) {
      console.error('Error caching response:', error);
    }
  }

  // Detect language from query
  detectLanguage(query) {
    const hindiRegex = /[\u0900-\u097F]/;
    const tamilRegex = /[\u0B80-\u0BFF]/;

    if (hindiRegex.test(query)) return 'hi';
    if (tamilRegex.test(query)) return 'ta';
    return 'en';
  }

  // Generate system prompt based on language and context
  generateSystemPrompt(language = 'en', tractorsData = []) {
    const basePrompt = `You are an AI assistant for Tractor Junction (https://www.tractorjunction.com/), a leading platform for tractor sales and information in India.

Your role:
- Provide helpful, accurate information about tractors
- Help users find the right tractor based on their needs
- Guide users to relevant product pages, listings, and tools
- Support queries in English, Hindi, and Tamil
- Always be friendly, professional, and helpful

Available tractor data: ${JSON.stringify(tractorsData.slice(0, 5))}

Response format:
- Always respond in the same language as the user's query
- For product queries, provide structured information with links
- For general queries, provide helpful text responses
- Include relevant links to Tractor Junction pages when appropriate

Important links:
- Product listings: https://www.tractorjunction.com/tractors
- EMI Calculator: https://www.tractorjunction.com/emi-calculator
- News: https://www.tractorjunction.com/news
- Brand pages: https://www.tractorjunction.com/tractors/[brand-name]`;

    const languagePrompts = {
      en: basePrompt,
      hi: `आप ट्रैक्टर जंक्शन (https://www.tractorjunction.com/) के लिए एक AI सहायक हैं, जो भारत में ट्रैक्टर बिक्री और जानकारी के लिए एक अग्रणी प्लेटफॉर्म है।

आपकी भूमिका:
- ट्रैक्टर के बारे में सहायक, सटीक जानकारी प्रदान करना
- उपयोगकर्ताओं की आवश्यकताओं के आधार पर सही ट्रैक्टर खोजने में मदद करना
- उपयोगकर्ताओं को प्रासंगिक उत्पाद पृष्ठों, सूचियों और उपकरणों के लिए निर्देशित करना
- हिंदी, अंग्रेजी और तमिल में प्रश्नों का समर्थन करना
- हमेशा मित्रवत, पेशेवर और सहायक रहना

उपलब्ध ट्रैक्टर डेटा: ${JSON.stringify(tractorsData.slice(0, 5))}

प्रतिक्रिया प्रारूप:
- हमेशा उपयोगकर्ता के प्रश्न की भाषा में प्रतिक्रिया दें
- उत्पाद प्रश्नों के लिए, लिंक के साथ संरचित जानकारी प्रदान करें
- सामान्य प्रश्नों के लिए, सहायक पाठ प्रतिक्रियाएं प्रदान करें
- जब उपयुक्त हो तो ट्रैक्टर जंक्शन पृष्ठों के प्रासंगिक लिंक शामिल करें`,

      ta: `நீங்கள் டிராக்டர் ஜங்க்ஷன் (https://www.tractorjunction.com/) க்கான AI உதவியாளர், இது இந்தியாவில் டிராக்டர் விற்பனை மற்றும் தகவல்களுக்கான முன்னணி தளமாகும்.

உங்கள் பங்கு:
- டிராக்டர்கள் பற்றி உதவியான, துல்லியமான தகவல்களை வழங்குதல்
- பயனர்களின் தேவைகளின் அடிப்படையில் சரியான டிராக்டரைக் கண்டறிய உதவுதல்
- பயனர்களை தொடர்புடைய தயாரிப்பு பக்கங்கள், பட்டியல்கள் மற்றும் கருவிகளுக்கு வழிநடத்துதல்
- ஆங்கிலம், இந்தி மற்றும் தமிழில் கேள்விகளை ஆதரித்தல்
- எப்போதும் நட்பு, தொழில்முறை மற்றும் உதவியாக இருத்தல்

கிடைக்கும் டிராக்டர் தரவு: ${JSON.stringify(tractorsData.slice(0, 5))}

பதில் வடிவம்:
- எப்போதும் பயனரின் கேள்வியின் அதே மொழியில் பதிலளிக்கவும்
- தயாரிப்பு கேள்விகளுக்கு, இணைப்புகளுடன் கட்டமைக்கப்பட்ட தகவல்களை வழங்கவும்
- பொதுவான கேள்விகளுக்கு, உதவியான உரை பதில்களை வழங்கவும்
- பொருத்தமான போது டிராக்டர் ஜங்க்ஷன் பக்கங்களுக்கு தொடர்புடைய இணைப்புகளை சேர்க்கவும்`
    };

    return languagePrompts[language] || basePrompt;
  }

  // Generate response using OpenAI
  async generateResponse(query, context = '', tractorsData = [], enhancedPrompt = null) {
    try {
      console.log(`🔍 OpenAI: Generating response for: "${query}" (${tractorsData.length} tractors in context)`);

      // Step 1: Check Memory Cache
      const cacheKey = enhancedPrompt ? `enhanced_${query}_${tractorsData.length}` : query;
      const cachedResponse = await this.getCachedResponse(cacheKey, context);

      if (cachedResponse) {
        console.log(`✅ Cache Hit: Found cached response (${cachedResponse.text?.length || 0} chars)`);
        return cachedResponse;
      }

      // Step 2: Check ChromaDB
      try {
        const { chromaService } = require('./chromaService');
        const chromaResults = await chromaService.searchSimilar(query, 3);

        // Filter to only get actual AI responses (not chat messages or sessions)
        const validResponses = chromaResults.filter(result =>
          result.response &&
          result.response.length > 50 && // Must have substantial content
          result.model &&
          result.model.startsWith('gpt') // Only OpenAI generated responses
        );

        if (validResponses && validResponses.length > 0) {
          console.log(`✅ ChromaDB Hit: Found similar response (${validResponses[0].response?.length || 0} chars)`);

          // Store in memory cache for faster future access
          const response = {
            text: validResponses[0].response,
            language: validResponses[0].language || 'en',
            model: validResponses[0].model || 'gpt-4o-mini',
            usage: validResponses[0].usage_tokens ? { total_tokens: validResponses[0].usage_tokens } : null,
            timestamp: new Date().toISOString(),
            tractors: tractorsData.length > 0 ? tractorsData : [],
            hasTractors: tractorsData.length > 0,
            searchIntent: enhancedPrompt ? 'tractor_search' : 'general',
            source: 'chromadb'
          };

          // Cache the ChromaDB result
          if (!enhancedPrompt) {
            await this.cacheResponse(query, context, response, 3600);
          } else {
            const enhancedCacheKey = `enhanced_${query}_${tractorsData.length}`;
            await this.cacheResponse(enhancedCacheKey, context, response, 1800);
          }

          return response;
        } else {
          console.log('❌ CHROMADB MISS: No similar AI-generated response found');
        }
      } catch (error) {
        console.log('⚠️ CHROMADB ERROR:', error.message);
      }


      // Step 4: OpenAI Generation
      const language = this.detectLanguage(query);
      let systemPrompt;
      let userMessage;

      if (enhancedPrompt) {
        // Use enhanced prompt with tractor data
        systemPrompt = `You are a helpful agricultural equipment expert. Respond in ${language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'English'}.`;
        userMessage = enhancedPrompt;
      } else {
        // Use standard system prompt
        systemPrompt = this.generateSystemPrompt(language, tractorsData);
        userMessage = query;
      }

      console.log(`🤖 OpenAI: Requesting completion (model: ${this.model}, lang: ${language})`);

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      console.log(`📥 OpenAI: Received response (${completion.usage?.total_tokens || 0} tokens, ${completion.choices[0].message.content.length} chars)`);

      const response = {
        text: completion.choices[0].message.content,
        language: language,
        model: this.model,
        usage: completion.usage,
        timestamp: new Date().toISOString(),
        tractors: tractorsData.length > 0 ? tractorsData : [],
        hasTractors: tractorsData.length > 0,
        searchIntent: enhancedPrompt ? 'tractor_search' : 'general'
      };

      // Step 5: Store response in multiple systems
      // Step 5: Storage

      // Store in Memory Cache
      if (!enhancedPrompt) {
        await this.cacheResponse(query, context, response, 3600);
      } else {
        const enhancedCacheKey = `enhanced_${query}_${tractorsData.length}`;
        await this.cacheResponse(enhancedCacheKey, context, response, 1800);
      }
      console.log('✅ Storage: Memory cache updated');
      // LLM responses are not written to ChromaDB: that collection holds product knowledge only.

      return response;
    } catch (error) {
      console.error('OpenAI API error:', error);

      // Fallback response
      const language = this.detectLanguage(query);
      const fallbackResponses = {
        en: "I'm having trouble processing your request right now. Please try again or explore our tractor listings at https://www.tractorjunction.com/tractors",
        hi: "मैं अभी आपके अनुरोध को संसाधित करने में परेशानी हो रही है। कृपया पुनः प्रयास करें या https://www.tractorjunction.com/tractors पर हमारी ट्रैक्टर सूचियों को देखें",
        ta: "உங்கள் கோரிக்கையை இப்போது செயலாக்குவதில் சிக்கல் உள்ளது. மீண்டும் முயற்சிக்கவும் அல்லது https://www.tractorjunction.com/tractors இல் எங்கள் டிராக்டர் பட்டியல்களை ஆராயவும்"
      };

      return {
        text: fallbackResponses[language] || fallbackResponses.en,
        language: language,
        error: true,
        tractors: tractorsData.length > 0 ? tractorsData : [],
        hasTractors: tractorsData.length > 0,
        searchIntent: 'general',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Extract intent from query
  async extractIntent(query) {
    try {
      const intentPrompt = `Analyze this query and determine the intent. Return only the intent category.

Query: "${query}"

Intent categories:
- product_search: Looking for specific tractors or products
- brand_query: Asking about specific brands
- price_query: Asking about pricing or EMI
- general_info: General tractor information
- comparison: Comparing tractors
- news: Asking about latest news
- support: Need help or support

Return only the intent category name.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: intentPrompt
          }
        ],
        max_tokens: 20,
        temperature: 0.1
      });

      return completion.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
      console.error('Intent extraction error:', error);
      return 'general_info';
    }
  }

  // Generate product recommendations
  async generateProductRecommendations(query, tractorsData) {
    try {
      const language = this.detectLanguage(query);
      const systemPrompt = `You are a tractor expert. Based on the user query and available tractor data, provide relevant product recommendations.

Available tractors: ${JSON.stringify(tractorsData)}

Return a JSON response with:
{
  "recommendations": [
    {
      "tractor_id": "string",
      "reason": "string",
      "priority": "high|medium|low"
    }
  ],
  "summary": "string"
}

Respond in ${language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'English'}.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Product recommendation error:', error);
      return {
        recommendations: [],
        summary: "Unable to generate recommendations at this time."
      };
    }
  }
}

module.exports = new OpenAIService();
