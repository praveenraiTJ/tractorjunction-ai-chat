const mysql = require('mysql2/promise');
require('dotenv').config();

// Sample tractor data
const sampleTractors = [
  {
    tractor_id: 'TJ_MH_001',
    brand: 'Mahindra',
    model: 'Mahindra 275 DI TU',
    price: 450000,
    engine_power: '27 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Utility Tractor',
    description: 'Reliable and efficient utility tractor perfect for small to medium farms. Features advanced hydraulics and comfortable operator station.',
    specifications: {
      'Engine Type': '4-stroke, water-cooled',
      'PTO Power': '22 HP',
      'Hydraulic Lift Capacity': '1200 kg',
      'Wheelbase': '1650 mm',
      'Ground Clearance': '350 mm',
      'Fuel Tank Capacity': '35 liters'
    },
    features: [
      'Power Steering',
      'Dual Clutch',
      'Oil Immersed Brakes',
      'Comfortable Seat',
      'Easy Maintenance'
    ],
    images: [
      'https://example.com/mahindra-275-di-tu-1.jpg',
      'https://example.com/mahindra-275-di-tu-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_JD_001',
    brand: 'John Deere',
    model: 'John Deere 5050D',
    price: 850000,
    engine_power: '50 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Heavy Duty Tractor',
    description: 'Heavy-duty tractor designed for large-scale farming operations. Excellent for plowing, tilling, and hauling operations.',
    specifications: {
      'Engine Type': '4-stroke, turbocharged',
      'PTO Power': '45 HP',
      'Hydraulic Lift Capacity': '2000 kg',
      'Wheelbase': '2100 mm',
      'Ground Clearance': '400 mm',
      'Fuel Tank Capacity': '60 liters'
    },
    features: [
      'Turbocharged Engine',
      'Power Steering',
      '4WD Option',
      'Air Conditioning',
      'Advanced Hydraulics'
    ],
    images: [
      'https://example.com/john-deere-5050d-1.jpg',
      'https://example.com/john-deere-5050d-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_TA_001',
    brand: 'Tata',
    model: 'Tata 407 DI',
    price: 320000,
    engine_power: '40 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Compact Tractor',
    description: 'Compact and affordable tractor ideal for small farms and orchards. Easy to maneuver and maintain.',
    specifications: {
      'Engine Type': '4-stroke, direct injection',
      'PTO Power': '35 HP',
      'Hydraulic Lift Capacity': '800 kg',
      'Wheelbase': '1400 mm',
      'Ground Clearance': '300 mm',
      'Fuel Tank Capacity': '25 liters'
    },
    features: [
      'Compact Design',
      'Easy Maintenance',
      'Fuel Efficient',
      'Comfortable Operation',
      'Affordable'
    ],
    images: [
      'https://example.com/tata-407-di-1.jpg',
      'https://example.com/tata-407-di-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_ES_001',
    brand: 'Eicher',
    model: 'Eicher 380',
    price: 380000,
    engine_power: '38 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Utility Tractor',
    description: 'Versatile utility tractor with excellent fuel efficiency and low maintenance requirements.',
    specifications: {
      'Engine Type': '4-stroke, water-cooled',
      'PTO Power': '32 HP',
      'Hydraulic Lift Capacity': '1000 kg',
      'Wheelbase': '1500 mm',
      'Ground Clearance': '320 mm',
      'Fuel Tank Capacity': '30 liters'
    },
    features: [
      'Fuel Efficient',
      'Low Maintenance',
      'Power Steering',
      'Comfortable Cabin',
      'Reliable Engine'
    ],
    images: [
      'https://example.com/eicher-380-1.jpg',
      'https://example.com/eicher-380-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_SW_001',
    brand: 'Swaraj',
    model: 'Swaraj 744 FE',
    price: 420000,
    engine_power: '44 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Farm Tractor',
    description: 'Robust farm tractor designed for Indian farming conditions. Excellent for various agricultural operations.',
    specifications: {
      'Engine Type': '4-stroke, direct injection',
      'PTO Power': '38 HP',
      'Hydraulic Lift Capacity': '1500 kg',
      'Wheelbase': '1800 mm',
      'Ground Clearance': '380 mm',
      'Fuel Tank Capacity': '40 liters'
    },
    features: [
      'Robust Design',
      'High Lifting Capacity',
      'Comfortable Operation',
      'Easy Serviceability',
      'Value for Money'
    ],
    images: [
      'https://example.com/swaraj-744-fe-1.jpg',
      'https://example.com/swaraj-744-fe-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_NE_001',
    brand: 'New Holland',
    model: 'New Holland 3630 TX',
    price: 750000,
    engine_power: '60 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Heavy Duty Tractor',
    description: 'Advanced heavy-duty tractor with modern technology and superior performance for large-scale farming.',
    specifications: {
      'Engine Type': '4-stroke, turbocharged',
      'PTO Power': '55 HP',
      'Hydraulic Lift Capacity': '2500 kg',
      'Wheelbase': '2200 mm',
      'Ground Clearance': '420 mm',
      'Fuel Tank Capacity': '70 liters'
    },
    features: [
      'Advanced Technology',
      'Turbocharged Engine',
      '4WD System',
      'Climate Control',
      'Digital Dashboard'
    ],
    images: [
      'https://example.com/new-holland-3630-tx-1.jpg',
      'https://example.com/new-holland-3630-tx-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_MA_001',
    brand: 'Massey Ferguson',
    model: 'Massey Ferguson 1035',
    price: 680000,
    engine_power: '35 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Utility Tractor',
    description: 'Reliable utility tractor with excellent fuel efficiency and low operating costs.',
    specifications: {
      'Engine Type': '4-stroke, water-cooled',
      'PTO Power': '30 HP',
      'Hydraulic Lift Capacity': '1200 kg',
      'Wheelbase': '1600 mm',
      'Ground Clearance': '340 mm',
      'Fuel Tank Capacity': '35 liters'
    },
    features: [
      'Fuel Efficient',
      'Low Operating Cost',
      'Easy Maintenance',
      'Comfortable Operation',
      'Reliable Performance'
    ],
    images: [
      'https://example.com/massey-ferguson-1035-1.jpg',
      'https://example.com/massey-ferguson-1035-2.jpg'
    ]
  },
  {
    tractor_id: 'TJ_KI_001',
    brand: 'Kubota',
    model: 'Kubota B2601',
    price: 520000,
    engine_power: '26 HP',
    fuel_type: 'Diesel',
    transmission: 'Manual',
    category: 'Compact Tractor',
    description: 'Premium compact tractor with advanced features and superior build quality.',
    specifications: {
      'Engine Type': '4-stroke, liquid-cooled',
      'PTO Power': '22 HP',
      'Hydraulic Lift Capacity': '900 kg',
      'Wheelbase': '1450 mm',
      'Ground Clearance': '310 mm',
      'Fuel Tank Capacity': '28 liters'
    },
    features: [
      'Premium Quality',
      'Advanced Features',
      'Compact Design',
      'Easy Operation',
      'Low Maintenance'
    ],
    images: [
      'https://example.com/kubota-b2601-1.jpg',
      'https://example.com/kubota-b2601-2.jpg'
    ]
  }
];

async function insertSampleData() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'tractor_junction'
    });

    console.log('Connected to MySQL database');

    // Insert sample tractors
    for (const tractor of sampleTractors) {
      const sql = `
        INSERT INTO tractors_trans (
          tractor_id, brand, model, price, engine_power, fuel_type, 
          transmission, category, description, specifications, features, images, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          brand = VALUES(brand),
          model = VALUES(model),
          price = VALUES(price),
          engine_power = VALUES(engine_power),
          fuel_type = VALUES(fuel_type),
          transmission = VALUES(transmission),
          category = VALUES(category),
          description = VALUES(description),
          specifications = VALUES(specifications),
          features = VALUES(features),
          images = VALUES(images),
          updated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        tractor.tractor_id,
        tractor.brand,
        tractor.model,
        tractor.price,
        tractor.engine_power,
        tractor.fuel_type,
        tractor.transmission,
        tractor.category,
        tractor.description,
        JSON.stringify(tractor.specifications),
        JSON.stringify(tractor.features),
        JSON.stringify(tractor.images),
        'active'
      ];

      await connection.execute(sql, values);
      console.log(`✅ Inserted/Updated: ${tractor.brand} ${tractor.model}`);
    }

    console.log(`\n🎉 Successfully inserted ${sampleTractors.length} sample tractors!`);
    
    // Show summary
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as total FROM tractors_trans WHERE status = "active"'
    );
    console.log(`📊 Total active tractors in database: ${countResult[0].total}`);

    // Show brands
    const [brandsResult] = await connection.execute(
      'SELECT brand, COUNT(*) as count FROM tractors_trans WHERE status = "active" GROUP BY brand ORDER BY count DESC'
    );
    console.log('\n📈 Brands in database:');
    brandsResult.forEach(row => {
      console.log(`  - ${row.brand}: ${row.count} tractors`);
    });

  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  insertSampleData()
    .then(() => {
      console.log('\n✅ Sample data insertion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Sample data insertion failed:', error);
      process.exit(1);
    });
}

module.exports = { insertSampleData, sampleTractors };
