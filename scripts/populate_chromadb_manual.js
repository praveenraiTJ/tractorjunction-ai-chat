const { ChromaClient } = require('chromadb');
const { OpenAIEmbeddingFunction } = require('chromadb');
const dbConnection = require('./server/config/database');

async function populateChromaDB() {
  try {
    console.log('🚀 Starting manual ChromaDB population...');
    
    // Connect to ChromaDB
    const client = new ChromaClient({
      path: 'http://localhost:8000'
    });
    
    // Create embedding function
    const embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: process.env.OPENAI_API_KEY
    });
    
    // Create or get collection
    let collection;
    try {
      collection = await client.createCollection({
        name: 'tractor_knowledge',
        embeddingFunction: embeddingFunction,
        metadata: {
          description: 'Tractor knowledge base for semantic search',
          created_at: new Date().toISOString()
        }
      });
      console.log('✅ Created new collection');
    } catch (error) {
      if (error.message.includes('already exists')) {
        collection = await client.getCollection({ name: 'tractor_knowledge' });
        console.log('✅ Using existing collection');
      } else {
        throw error;
      }
    }
    
    // Check if already populated
    const count = await collection.count();
    if (count > 0) {
      console.log(`✅ Collection already has ${count} documents`);
      return;
    }
    
    // Get tractors from database
    console.log('📊 Fetching tractors from database...');
    const tractors = await dbConnection.query(`
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
      LIMIT 100
    `);
    
    console.log(`📊 Found ${tractors.length} tractors`);
    
    if (tractors.length === 0) {
      console.log('❌ No tractors found');
      return;
    }
    
    // Create searchable content
    const createSearchableContent = (tractor) => {
      const parts = [];
      
      if (tractor.brand_name && tractor.model_name) {
        parts.push(`${tractor.brand_name} ${tractor.model_name}`);
      }
      
      if (tractor.hp) {
        parts.push(`${tractor.hp} HP`);
      }
      
      if (tractor.price) {
        parts.push(`Price: ₹${tractor.price} Lakh`);
      }
      
      if (tractor.fuel_pump) {
        parts.push(`Fuel: ${tractor.fuel_pump}`);
      }
      
      if (tractor.transmission_type) {
        parts.push(`Transmission: ${tractor.transmission_type}`);
      }
      
      if (tractor.wheel_drive) {
        parts.push(`${tractor.wheel_drive}WD`);
      }
      
      if (tractor.hydraulic_lifting_capacity) {
        parts.push(`Lifting: ${tractor.hydraulic_lifting_capacity}`);
      }
      
      if (tractor.applications) {
        parts.push(`Applications: ${tractor.applications}`);
      }
      
      return parts.join(' | ');
    };
    
    // Prepare documents
    const documents = [];
    const metadatas = [];
    const ids = [];
    
    for (const tractor of tractors) {
      const content = createSearchableContent(tractor);
      documents.push(content);
      metadatas.push({
        tractors_id: tractor.tractors_id,
        model_name: tractor.model_name,
        brand_name: tractor.brand_name,
        price: tractor.price,
        hp: tractor.hp,
        fuel_pump: tractor.fuel_pump,
        transmission_type: tractor.transmission_type,
        wheel_drive: tractor.wheel_drive,
        hydraulic_lifting_capacity: tractor.hydraulic_lifting_capacity
      });
      ids.push(`tractor_${tractor.tractors_id}`);
    }
    
    // Add to collection in batches
    const batchSize = 10;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchMetadatas = metadatas.slice(i, i + batchSize);
      const batchIds = ids.slice(i, i + batchSize);
      
      await collection.add({
        ids: batchIds,
        metadatas: batchMetadatas,
        documents: batch
      });
      
      console.log(`📚 Added batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
    }
    
    console.log(`✅ Successfully populated ChromaDB with ${documents.length} documents`);
    
  } catch (error) {
    console.error('❌ Error populating ChromaDB:', error);
  }
}

populateChromaDB();

