const { ChromaClient } = require('chromadb');
const dbConnection = require('../config/database');

class ChromaService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.collectionName = 'tractor_knowledge';
  }

  async initialize() {
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
      console.log('   This is normal if ChromaDB server is not running');
      console.log('   To disable ChromaDB permanently, set DISABLE_CHROMADB=true in .env');
      // Continue without ChromaDB if it fails
      this.client = null;
    }
  }

  async initializeCollection() {
    try {
      // Check if collection exists
      const collections = await this.client.listCollections();
      const existingCollection = collections.find(col => col.name === this.collectionName);

      if (existingCollection) {
        this.collection = await this.client.getCollection({ name: this.collectionName });
        console.log('✅ Using existing ChromaDB collection');
      } else {
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: {
            description: 'Tractor knowledge base for semantic search',
            created_at: new Date().toISOString()
          }
        });
        console.log('✅ Created new ChromaDB collection');
      }
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

      // Get all tractors from database
      const tractors = await dbConnection.query(`
        SELECT 
          tractor_id,
          brand,
          model,
          price,
          engine_power,
          fuel_type,
          transmission,
          category,
          description,
          specifications,
          features
        FROM tractors_trans 
        WHERE status = 'active'
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
          tractor_id: tractor.tractor_id,
          brand: tractor.brand,
          model: tractor.model,
          category: tractor.category,
          price: tractor.price,
          engine_power: tractor.engine_power,
          fuel_type: tractor.fuel_type,
          transmission: tractor.transmission
        });
        ids.push(`tractor_${tractor.tractor_id}`);
      }

      // Add documents to collection in batches
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);
        const batchIds = ids.slice(i, i + batchSize);

        await this.collection.add({
          documents: batch,
          metadatas: batchMetadatas,
          ids: batchIds
        });

        console.log(`📚 Added batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
      }

      console.log(`✅ Populated ChromaDB with ${documents.length} tractor documents`);
    } catch (error) {
      console.error('Failed to populate ChromaDB collection:', error);
    }
  }

  createSearchableContent(tractor) {
    const parts = [
      `Brand: ${tractor.brand}`,
      `Model: ${tractor.model}`,
      `Category: ${tractor.category}`,
      `Engine Power: ${tractor.engine_power}`,
      `Fuel Type: ${tractor.fuel_type}`,
      `Transmission: ${tractor.transmission}`,
      `Price: ₹${tractor.price?.toLocaleString() || 'Contact for price'}`
    ];

    if (tractor.description) {
      parts.push(`Description: ${tractor.description}`);
    }

    if (tractor.specifications) {
      try {
        const specs = typeof tractor.specifications === 'string' 
          ? JSON.parse(tractor.specifications) 
          : tractor.specifications;
        
        Object.entries(specs).forEach(([key, value]) => {
          parts.push(`${key}: ${value}`);
        });
      } catch (error) {
        console.error('Error parsing specifications:', error);
      }
    }

    if (tractor.features) {
      try {
        const features = typeof tractor.features === 'string' 
          ? JSON.parse(tractor.features) 
          : tractor.features;
        
        if (Array.isArray(features)) {
          parts.push(`Features: ${features.join(', ')}`);
        }
      } catch (error) {
        console.error('Error parsing features:', error);
      }
    }

    return parts.join('\n');
  }

  async searchSimilar(query, limit = 5, filters = {}) {
    try {
      if (!this.collection) {
        console.log('⚠️ ChromaDB not available, falling back to database search');
        return await this.fallbackSearch(query, limit, filters);
      }

      console.log('='.repeat(60));
      console.log(`🔍 CHROMADB: SEARCHING SIMILAR DOCUMENTS`);
      console.log('='.repeat(60));
      console.log('   Query:', query);
      console.log('   Limit:', limit);
      console.log('   Filters:', JSON.stringify(filters, null, 2));

      // Build where clause for filtering
      const whereClause = {};
      if (filters.brand) whereClause.brand = filters.brand;
      if (filters.category) whereClause.category = filters.category;
      if (filters.minPrice || filters.maxPrice) {
        whereClause.price = {};
        if (filters.minPrice) whereClause.price.$gte = filters.minPrice;
        if (filters.maxPrice) whereClause.price.$lte = filters.maxPrice;
      }

      console.log('   Where clause:', JSON.stringify(whereClause, null, 2));

      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined
      });

      console.log('   Raw results:', {
        documents_count: results.documents[0]?.length || 0,
        metadatas_count: results.metadatas[0]?.length || 0,
        distances_count: results.distances[0]?.length || 0
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

      console.log('─'.repeat(40));
      console.log(`✅ CHROMADB: FOUND ${formattedResults.length} SIMILAR DOCUMENTS`);
      console.log('─'.repeat(40));
      if (formattedResults.length > 0) {
        console.log('   Top result similarity score:', formattedResults[0].similarity_score);
        console.log('   Top result brand:', formattedResults[0].brand);
        console.log('   Top result model:', formattedResults[0].model);
      }
      console.log('='.repeat(60));
      return formattedResults;
    } catch (error) {
      console.error('ChromaDB search error:', error);
      console.log('🔄 Falling back to database search due to ChromaDB error');
      return await this.fallbackSearch(query, limit, filters);
    }
  }

  async fallbackSearch(query, limit = 5, filters = {}) {
    try {
      console.log('🔄 Using fallback database search');
      console.log('   Query:', query);
      console.log('   Filters:', JSON.stringify(filters, null, 2));
      
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

      console.log('📝 ChromaDB: Adding tractor to collection...');
      console.log('   Tractor ID:', tractorData.tractor_id);
      console.log('   Brand:', tractorData.brand);
      console.log('   Model:', tractorData.model);

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

      console.log('   Content length:', content.length, 'characters');
      console.log('   Metadata:', JSON.stringify(metadata, null, 2));

      await this.collection.add({
        documents: [content],
        metadatas: [metadata],
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

      console.log('='.repeat(60));
      console.log('📝 CHROMADB: ADDING QUERY RESPONSE DOCUMENT');
      console.log('='.repeat(60));
      console.log('   Query:', documentData.query);
      console.log('   Response length:', documentData.text?.length || 0, 'characters');
      console.log('   Language:', documentData.language);
      console.log('   Model:', documentData.model);
      console.log('   Has Tractors:', documentData.hasTractors);
      console.log('   Tractors count:', documentData.tractors?.length || 0);

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

      console.log('   Content length:', content.length, 'characters');
      console.log('   Metadata keys:', Object.keys(metadata));
      console.log('   Usage tokens:', metadata.usage_tokens);

      const documentId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.collection.add({
        documents: [content],
        metadatas: [metadata],
        ids: [documentId]
      });

      console.log('─'.repeat(40));
      console.log(`✅ CHROMADB: SUCCESSFULLY ADDED DOCUMENT`);
      console.log('─'.repeat(40));
      console.log('   Document ID:', documentId);
      console.log('   Collection:', this.collectionName);
      console.log('='.repeat(60));
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
