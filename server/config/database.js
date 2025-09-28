const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

class DatabaseConnection {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      // Add connection timeout and retry logic
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        connectTimeout: 10000,
        timeout: 10000,
        reconnect: true
      });

      const connection = await this.pool.getConnection();
      console.log('Connected to MySQL database');
      connection.release();

      await this.initializeSchema();
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async initializeSchema() {
    try {
      const createTractorsTable = `
        CREATE TABLE IF NOT EXISTS tractors_trans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tractors_id INT NOT NULL,
          lang VARCHAR(10) NOT NULL DEFAULT 'en',
          brand_id VARCHAR(64) NOT NULL,
          series_id INT DEFAULT 0,
          priceShow INT NOT NULL DEFAULT 0,
          show_emi TINYINT(1) NOT NULL DEFAULT 0,
          ptohp VARCHAR(320) NOT NULL,
          fuel_pump VARCHAR(640) NOT NULL,
          slug VARCHAR(64) NOT NULL,
          model_name VARCHAR(200) NOT NULL,
          uses_tractor VARCHAR(64) NOT NULL,
          engine_air_filter VARCHAR(1000) NOT NULL,
          transmission_gear_box VARCHAR(500) NOT NULL,
          transmission_type VARCHAR(64) NOT NULL,
          wheel_drive VARCHAR(64),
          overview LONGTEXT,
          about_title VARCHAR(255),
          spec_overview LONGTEXT,
          applications TEXT,
          transmission_clutch VARCHAR(200) NOT NULL,
          breaks VARCHAR(500) NOT NULL,
          other_info LONGTEXT,
          hydraulic_point_linkage VARCHAR(500) NOT NULL,
          hydraulic_lifting_capacity VARCHAR(800) NOT NULL,
          steering_column VARCHAR(500) NOT NULL,
          steering_type VARCHAR(200) NOT NULL,
          powertakeoff_rpm VARCHAR(500) NOT NULL,
          powertakeoff_type VARCHAR(500) NOT NULL,
          wheels_tyre_rear VARCHAR(500),
          wheels_tyre_front VARCHAR(500),
          fuel_tank_capacity VARCHAR(100) NOT NULL,
          battery_info VARCHAR(1000) NOT NULL,
          alternator_info VARCHAR(1000) NOT NULL,
          electrical_system TEXT,
          turningradius_with_breaks VARCHAR(100) NOT NULL,
          ground_clearance VARCHAR(100) NOT NULL,
          overall_width VARCHAR(100) NOT NULL,
          overall_length VARCHAR(100) NOT NULL,
          wheel_base VARCHAR(100) NOT NULL,
          total_weight VARCHAR(100) NOT NULL,
          accessories TEXT NOT NULL,
          options TEXT NOT NULL,
          additional_features TEXT NOT NULL,
          speed_forward VARCHAR(100) NOT NULL,
          speed_reverse VARCHAR(100) NOT NULL,
          warranty VARCHAR(100) NOT NULL,
          cooling VARCHAR(200) NOT NULL,
          capacity VARCHAR(200) NOT NULL,
          hp VARCHAR(100) NOT NULL,
          cylinder VARCHAR(200),
          torque VARCHAR(64),
          price VARCHAR(100) NOT NULL,
          price_backup VARCHAR(100),
          min_price INT NOT NULL DEFAULT 0,
          min_price_backup INT DEFAULT 0,
          max_price INT NOT NULL DEFAULT 0,
          max_price_backup INT DEFAULT 0,
          engine_rated_rpm VARCHAR(200) NOT NULL,
          image VARCHAR(128) NOT NULL,
          images VARCHAR(1000),
          alttags VARCHAR(250),
          alttag VARCHAR(55),
          video VARCHAR(999),
          others TEXT,
          status VARCHAR(20) NOT NULL,
          popular VARCHAR(64) NOT NULL,
          latest INT NOT NULL DEFAULT 0,
          mini TINYINT NOT NULL DEFAULT 0,
          ac_cabin TINYINT DEFAULT 0,
          2wd INT NOT NULL DEFAULT 0,
          trem_iv INT NOT NULL DEFAULT 0,
          join_date DATE NOT NULL,
          launch_date DATE NOT NULL,
          valuation_price FLOAT,
          valuation_price_backup FLOAT,
          valuation_category VARCHAR(10) NOT NULL DEFAULT 'A',
          valuation_category_backup VARCHAR(10) DEFAULT 'A',
          ordering INT NOT NULL DEFAULT 0,
          isActive TINYINT NOT NULL DEFAULT 0,
          is_discontinue TINYINT NOT NULL DEFAULT 0,
          product_h1 VARCHAR(100),
          meta_title LONGTEXT NOT NULL,
          meta_keyword LONGTEXT NOT NULL,
          meta_description LONGTEXT NOT NULL,
          spec_meta_title VARCHAR(120),
          spec_meta_desc VARCHAR(300),
          spec_meta_keyword VARCHAR(300),
          tooltip TEXT,
          total_leads INT NOT NULL DEFAULT 0,
          total_quarterly_leads INT UNSIGNED NOT NULL DEFAULT 0,
          brand_model_code VARCHAR(50),
          min_emi DOUBLE,
          min_emi_backup DOUBLE,
          charging_time VARCHAR(64),
          battery_capacity VARCHAR(64),
          battery_type TEXT,
          fast_charging TEXT,
          run_time TEXT,
          tractor_power TEXT,
          motor_power TEXT,
          motor_peak_power VARCHAR(128),
          peak_power TEXT,
          speed_range VARCHAR(64),
          lifting_capacity VARCHAR(64),
          max_power VARCHAR(64),
          share_rank INT NOT NULL DEFAULT 0,
          expert_overview TEXT,
          expert_overview_image TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_brand_id (brand_id),
          INDEX idx_hp (hp),
          INDEX idx_price (price),
          INDEX idx_min_price (min_price),
          INDEX idx_max_price (max_price),
          INDEX idx_status (status),
          INDEX idx_isActive (isActive),
          INDEX idx_popular (popular),
          INDEX idx_share_rank (share_rank),
          INDEX idx_mini (mini),
          INDEX idx_ac_cabin (ac_cabin),
          INDEX idx_2wd (2wd),
          INDEX idx_4wd (4wd),
          INDEX idx_latest (latest)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      // Other tables remain unchanged
      const createChatSessionsTable = `
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(100) UNIQUE NOT NULL,
          user_id VARCHAR(100),
          language VARCHAR(10) DEFAULT 'en',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      const createChatMessagesTable = `
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(100) NOT NULL,
          message_type ENUM('user', 'bot') NOT NULL,
          content TEXT NOT NULL,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_created_at (created_at),
          FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      const createQueryCacheTable = `
        CREATE TABLE IF NOT EXISTS query_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          query_hash VARCHAR(64) UNIQUE NOT NULL,
          query_text TEXT NOT NULL,
          response_data JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_query_hash (query_hash),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      const createAnalyticsTable = `
        CREATE TABLE IF NOT EXISTS chat_analytics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(100),
          query_text TEXT,
          intent VARCHAR(100),
          response_type VARCHAR(50),
          response_time_ms INT,
          user_satisfaction ENUM('positive', 'negative', 'neutral'),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_intent (intent),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await this.pool.execute(createTractorsTable);
      await this.pool.execute(createChatSessionsTable);
      await this.pool.execute(createChatMessagesTable);
      await this.pool.execute(createQueryCacheTable);
      await this.pool.execute(createAnalyticsTable);

      console.log('✅ Database schema initialized');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getConnection() {
    return await this.pool.getConnection();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection closed');
    }
  }

  async searchTractors(searchParams) {
    const {
      query = '',
      brand = '',
      category = '',
      minPrice = null,
      maxPrice = null,
      wheelDrive = null,
      minPower = null,
      maxPower = null,
      minLiftingCapacity = null,
      maxLiftingCapacity = null,
      isMini = null,
      hasAcCabin = null,
      isLatest = null,
      isPopular = null,
      limit = 10,
      offset = 0
    } = searchParams;

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

    const params = [];

    if (query) {
      sql += ` AND (
        tt.model_name LIKE ? OR 
        bt.name LIKE ? OR 
        tt.overview LIKE ? OR 
        tt.applications LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (brand) {
      sql += ` AND bt.name = ?`;
      params.push(brand);
    }

    if (category) {
      sql += ` AND tt.applications LIKE ?`;
      params.push(`%${category}%`);
    }

    if (minPrice !== null) {
      sql += ` AND tt.min_price >= ?`;
      params.push(minPrice);
    }

    if (maxPrice !== null) {
      sql += ` AND tt.max_price <= ?`;
      params.push(maxPrice);
    }

    if (wheelDrive) {
      if (wheelDrive === '2wd') {
        sql += ` AND tt.2wd = 1`;
      } else if (wheelDrive === '4wd') {
        sql += ` AND tt.wheel_drive = ?`;
        params.push('4');
      }
    }

    if (minPower !== null) {
      sql += ` AND CAST(tt.hp AS UNSIGNED) >= ?`;
      params.push(minPower);
    }

    if (maxPower !== null) {
      sql += ` AND CAST(tt.hp AS UNSIGNED) <= ?`;
      params.push(maxPower);
    }

    if (minLiftingCapacity !== null) {
      sql += ` AND CAST(tt.hydraulic_lifting_capacity AS UNSIGNED) >= ?`;
      params.push(minLiftingCapacity);
    }

    if (maxLiftingCapacity !== null) {
      sql += ` AND CAST(tt.hydraulic_lifting_capacity AS UNSIGNED) <= ?`;
      params.push(maxLiftingCapacity);
    }

    if (isMini !== null) {
      sql += ` AND tt.mini = ?`;
      params.push(isMini ? 1 : 0);
    }

    if (hasAcCabin !== null) {
      sql += ` AND tt.ac_cabin = ?`;
      params.push(hasAcCabin ? 1 : 0);
    }

    if (isLatest !== null) {
      sql += ` AND tt.latest = ?`;
      params.push(isLatest ? 1 : 0);
    }

    if (isPopular !== null) {
      sql += ` AND tt.popular != ?`;
      params.push('0');
    }

    sql += ` ORDER BY tt.ordering DESC, tt.share_rank DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return await this.query(sql, params);
  }

  async getTractorById(tractorId) {
    const sql = `
      SELECT 
        tt.*,
        bt.name as brand_name,
        bt.slug as brand_slug
      FROM tractors_trans tt
      LEFT JOIN brands_trans bt ON CAST(tt.brand_id AS UNSIGNED) = bt.brand_id AND bt.lang = 'en'
      WHERE tt.id = ? AND tt.status = 'launched' AND tt.lang = 'en' AND tt.isActive = 1
    `;
    const results = await this.query(sql, [tractorId]);
    return results[0] || null;
  }

  async getBrands() {
    const sql = `
      SELECT DISTINCT bt.name as brand, bt.slug, COUNT(*) as count 
      FROM tractors_trans tt
      LEFT JOIN brands_trans bt ON CAST(tt.brand_id AS UNSIGNED) = bt.brand_id AND bt.lang = 'en'
      WHERE tt.status = 'launched' AND tt.lang = 'en' AND tt.isActive = 1
      GROUP BY bt.name, bt.slug
      ORDER BY count DESC, bt.name ASC
    `;
    return await this.query(sql);
  }

  async getCategories() {
    const sql = `
      SELECT DISTINCT tt.applications as category, COUNT(*) as count 
      FROM tractors_trans tt
      WHERE tt.status = 'launched' AND tt.lang = 'en' AND tt.isActive = 1 AND tt.applications IS NOT NULL
      GROUP BY tt.applications
      ORDER BY count DESC, tt.applications ASC
    `;
    return await this.query(sql);
  }

}

module.exports = new DatabaseConnection();