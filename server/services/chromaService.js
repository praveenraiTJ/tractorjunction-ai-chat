const { ChromaClient } = require('chromadb');
const dbConnection = require('../config/database');

class ChromaService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.collectionName = 'tractor_knowledge';
  }

  async initialize() {
    // dbConnection is initialized by server/index.js before this runs (needed for fallback)

    // Check if ChromaDB is disabled via environment variable
    if (process.env.DISABLE_CHROMADB === 'true') {
      console.log('ℹ️ ChromaDB disabled via environment variable, using fallback database search');
      this.client = null;
      return;
    }

    try {
      // Initialize ChromaDB client
      this.client = new ChromaClient({
        path: `http://${process.env.CHROMA_HOST || 'localhost'}:${process.env.CHROMA_PORT || 8000}`
      });

      // Test connection with timeout
      await Promise.race([
        this.client.heartbeat(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ChromaDB connection timeout')), 5000)
        )
      ]);
      console.log('✅ ChromaDB client connected');

      // Create or get collection
      await this.initializeCollection();

      // Populate collection with tractor data if empty
      await this.populateCollection();

      console.log('✅ ChromaDB service initialized');
    } catch (error) {
      console.log('⚠️ ChromaDB not available, using fallback database search');
      // Continue without ChromaDB if it fails
      this.client = null;
    }
  }

  async initializeCollection() {
    try {
      // Use getOrCreateCollection to handle both new and existing collections
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: {
          description: 'Tractor knowledge base for semantic search',
          created_at: new Date().toISOString()
        }
      });
      console.log('✅ ChromaDB collection ready');
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      throw error;
    }
  }

  async populateCollection() {
    try {
      if (!this.collection) return;

      // Check if collection is empty
      const count = await this.collection.count();
      if (count > 0) {
        console.log(`✅ ChromaDB collection already has ${count} documents`);
        return;
      }

      console.log('📚 Populating ChromaDB collection with tractor data...');

      // Get all tractors from database - using correct column names
      const tractors = await dbConnection.query(`
        SELECT 
          tt.id,
          tt.tractors_id,
          tt.model_name,
          tt.brand_id,
          tt.hp,
          tt.fuel_pump,
          tt.transmission_type,
          tt.wheel_drive,
          tt.price,
          tt.min_price,
          tt.max_price,
          tt.overview,
          tt.applications,
          tt.additional_features,
          bt.name as brand_name
        FROM tractors_trans tt
        LEFT JOIN brands_trans bt ON CAST(tt.brand_id AS UNSIGNED) = bt.brand_id AND bt.lang = 'en'
        WHERE tt.status = 'launched' AND tt.lang = 'en' AND tt.isActive = 1
        LIMIT 1000
      `);

      if (tractors.length === 0) {
        console.log('⚠️ No tractors found in database to populate ChromaDB');
        return;
      }

      // Prepare documents for ChromaDB
      const documents = [];
      const metadatas = [];
      const ids = [];

      for (const tractor of tractors) {
        // Create searchable text content
        const content = this.createSearchableContent(tractor);

        documents.push(content);
        metadatas.push({
          tractor_id: tractor.tractors_id,
          brand: tractor.brand_name || 'Unknown',
          model: tractor.model_name,
          category: tractor.applications || 'General',
          price: tractor.min_price || 0,
          engine_power: tractor.hp || 'N/A',
          fuel_type: tractor.fuel_pump || 'N/A',
          transmission: tractor.transmission_type || 'N/A'
        });
        ids.push(`tractor_${tractor.tractors_id}`);
      }

      // Add documents to collection in batches
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);
        const batchIds = ids.slice(i, i + batchSize);

        const payload = {
          documents: batch,
          metadatas: batchMetadatas.map(m => this._sanitizeMetadata(m)),
          ids: batchIds
        };
        try {
          await this.collection.add(payload);
        } catch (error) {
          // Embedding runs client-side and can outlast the server's keep-alive,
          // leaving a stale socket (ECONNRESET). Retry once on a fresh connection.
          if (error.name !== 'ChromaConnectionError') throw error;
          await this.collection.add(payload);
        }

      }

      console.log(`✅ Populated ChromaDB with ${documents.length} tractor documents`);
    } catch (error) {
      console.error('Failed to populate ChromaDB collection:', error);
    }
  }

  createSearchableContent(tractor) {
    const parts = [
      `Brand: ${tractor.brand_name || 'Unknown'}`,
      `Model: ${tractor.model_name}`,
      `Category: ${tractor.applications || 'General'}`,
      `Engine Power: ${tractor.hp} HP`,
      `Fuel Type: ${tractor.fuel_pump || 'N/A'}`,
      `Transmission: ${tractor.transmission_type || 'N/A'}`,
      `Price: ₹${tractor.min_price?.toLocaleString() || 'Contact for price'}`
    ];

    if (tractor.overview) {
      parts.push(`Description: ${tractor.overview}`);
    }

    if (tractor.additional_features) {
      parts.push(`Features: ${tractor.additional_features}`);
    }

    return parts.join('\n');
  }

  /**
   * Sanitizes metadata to ensure only strings, numbers, and booleans are passed to ChromaDB.
   * ChromaDB does not support nested objects or arrays in metadata.
   */
  _sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return {};

    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        continue;
      }

      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        sanitized[key] = value;
      } else {
        // Stringify complex types (objects, arrays)
        sanitized[key] = JSON.stringify(value);
      }
    }
    return sanitized;
  }

  async searchSimilar(query, limit = 5, filters = {}) {
    try {
      if (!this.collection) {
        console.log('⚠️ ChromaDB not available, falling back to database search');
        return await this.fallbackSearch(query, limit, filters);
      }

      console.log(`🔍 ChromaDB: Searching similar documents for: "${query}" (limit: ${limit})`);

      // Build where clause for filtering
      const whereClause = {};
      if (filters.brand) whereClause.brand = filters.brand;
      if (filters.category) whereClause.category = filters.category;
      if (filters.minPrice || filters.maxPrice) {
        whereClause.price = {};
        if (filters.minPrice) whereClause.price.$gte = filters.minPrice;
        if (filters.maxPrice) whereClause.price.$lte = filters.maxPrice;
      }


      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined
      });


      // Format results
      const formattedResults = results.documents[0].map((doc, index) => ({
        tractor_id: results.metadatas[0][index].tractor_id,
        brand: results.metadatas[0][index].brand,
        model: results.metadatas[0][index].model,
        category: results.metadatas[0][index].category,
        price: results.metadatas[0][index].price,
        engine_power: results.metadatas[0][index].engine_power,
        fuel_type: results.metadatas[0][index].fuel_type,
        transmission: results.metadatas[0][index].transmission,
        similarity_score: results.distances[0][index],
        content: doc
      }));

      console.log(`✅ ChromaDB: Found ${formattedResults.length} similar documents` + (formattedResults.length > 0 ? ` (Top match: ${formattedResults[0].brand} ${formattedResults[0].model}, score: ${formattedResults[0].similarity_score.toFixed(4)})` : ''));
      return formattedResults;
    } catch (error) {
      console.error('ChromaDB search error:', error);
      console.log('🔄 Falling back to database search due to ChromaDB error');
      return await this.fallbackSearch(query, limit, filters);
    }
  }

  async fallbackSearch(query, limit = 5, filters = {}) {
    try {
      console.log(`🔄 Fallback: Using database search for: "${query}"`);

      // Check database connection first
      const dbConnected = await this.checkDatabaseConnection();

      if (!dbConnected) {
        console.log('⚠️ Database not available, returning empty results');
        return [];
      }

      const searchParams = {
        query: query,
        brand: filters.brand,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        limit: limit
      };

      const results = await dbConnection.searchTractors(searchParams);

      console.log(`✅ Fallback search found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('❌ Fallback search error:', error);
      return [];
    }
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

  async addTractor(tractorData) {
    try {
      if (!this.collection) {
        console.log('⚠️ ChromaDB collection not available, skipping tractor addition');
        return false;
      }

      console.log(`📝 ChromaDB: Adding tractor: ${tractorData.brand} ${tractorData.model} (ID: ${tractorData.tractor_id})`);

      const content = this.createSearchableContent(tractorData);
      const metadata = {
        tractor_id: tractorData.tractor_id,
        brand: tractorData.brand,
        model: tractorData.model,
        category: tractorData.category,
        price: tractorData.price,
        engine_power: tractorData.engine_power,
        fuel_type: tractorData.fuel_type,
        transmission: tractorData.transmission
      };


      await this.collection.add({
        documents: [content],
        metadatas: [this._sanitizeMetadata(metadata)],
        ids: [`tractor_${tractorData.tractor_id}`]
      });

      console.log(`✅ ChromaDB: Successfully added tractor ${tractorData.tractor_id}`);
      return true;
    } catch (error) {
      console.error('❌ ChromaDB: Failed to add tractor:', error.message);
      return false;
    }
  }

  async updateTractor(tractorId, tractorData) {
    try {
      if (!this.collection) return false;

      // Delete existing document
      await this.collection.delete({ ids: [`tractor_${tractorId}`] });

      // Add updated document
      return await this.addTractor(tractorData);
    } catch (error) {
      console.error('Failed to update tractor in ChromaDB:', error);
      return false;
    }
  }

  async addDocument(documentData) {
    try {
      if (!this.collection) {
        console.log('⚠️ ChromaDB collection not available, skipping document addition');
        return false;
      }

      console.log(`📝 ChromaDB: Adding response document for: "${documentData.query.substring(0, 50)}..."`);

      const content = `${documentData.query}\n\n${documentData.text}`;
      const metadata = {
        query: documentData.query,
        response: documentData.text,
        context: documentData.context || '',
        language: documentData.language || 'en',
        model: documentData.model || 'gpt-4o-mini',
        usage_tokens: documentData.usage?.total_tokens || 0,
        has_tractors: documentData.hasTractors || false,
        tractors_count: documentData.tractors?.length || 0,
        search_intent: documentData.searchIntent || 'general',
        timestamp: documentData.timestamp || new Date().toISOString()
      };


      const documentId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.collection.add({
        documents: [content],
        metadatas: [this._sanitizeMetadata(metadata)],
        ids: [documentId]
      });

      console.log(`✅ ChromaDB: Successfully added response document (ID: ${documentId})`);
      return true;
    } catch (error) {
      console.error('❌ ChromaDB: Failed to add document:', error.message);
      console.error('   Error details:', error);
      return false;
    }
  }

  async deleteTractor(tractorId) {
    try {
      if (!this.collection) return false;

      await this.collection.delete({ ids: [`tractor_${tractorId}`] });
      console.log(`✅ Deleted tractor ${tractorId} from ChromaDB`);
      return true;
    } catch (error) {
      console.error('Failed to delete tractor from ChromaDB:', error);
      return false;
    }
  }

  async getCollectionStats() {
    try {
      if (!this.collection) return null;

      const count = await this.collection.count();
      return {
        documentCount: count,
        collectionName: this.collectionName,
        status: 'active'
      };
    } catch (error) {
      console.error('Failed to get collection stats:', error);
      return null;
    }
  }
}

const chromaService = new ChromaService();

// Initialize ChromaDB service
async function initializeChromaDB() {
  await chromaService.initialize();
}

module.exports = {
  chromaService,
  initializeChromaDB
};
