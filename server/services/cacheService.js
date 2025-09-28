const NodeCache = require('node-cache');

class CacheService {
  constructor() {
    this.cache = null;
  }

  initialize() {
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour default
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false,
      deleteOnExpire: true
    });

    console.log('✅ Cache service initialized');
  }

  get(key) {
    if (!this.cache) return null;
    return this.cache.get(key);
  }

  set(key, value, ttl = null) {
    if (!this.cache) return false;
    return this.cache.set(key, value, ttl);
  }

  del(key) {
    if (!this.cache) return false;
    return this.cache.del(key);
  }

  flush() {
    if (!this.cache) return false;
    return this.cache.flushAll();
  }

  getStats() {
    if (!this.cache) return null;
    return this.cache.getStats();
  }

  // Session-specific cache methods
  getSessionData(sessionId, key) {
    return this.get(`session_${sessionId}_${key}`);
  }

  setSessionData(sessionId, key, value, ttl = 1800) { // 30 minutes default
    return this.set(`session_${sessionId}_${key}`, value, ttl);
  }

  clearSessionData(sessionId) {
    const keys = this.cache.keys();
    const sessionKeys = keys.filter(key => key.startsWith(`session_${sessionId}_`));
    sessionKeys.forEach(key => this.del(key));
  }

  // Product cache methods
  getProductData(productId) {
    return this.get(`product_${productId}`);
  }

  setProductData(productId, data, ttl = 7200) { // 2 hours default
    return this.set(`product_${productId}`, data, ttl);
  }

  // Search cache methods
  getSearchResults(query, filters = {}) {
    const searchKey = this.generateSearchKey(query, filters);
    return this.get(`search_${searchKey}`);
  }

  setSearchResults(query, filters, results, ttl = 1800) { // 30 minutes default
    const searchKey = this.generateSearchKey(query, filters);
    return this.set(`search_${searchKey}`, results, ttl);
  }

  generateSearchKey(query, filters) {
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return require('crypto')
      .createHash('md5')
      .update(query.toLowerCase() + filterString)
      .digest('hex');
  }

  // Analytics cache methods
  getAnalyticsData(key) {
    return this.get(`analytics_${key}`);
  }

  setAnalyticsData(key, data, ttl = 3600) { // 1 hour default
    return this.set(`analytics_${key}`, data, ttl);
  }
}

const cacheService = new CacheService();

// Initialize cache service
function initializeCache() {
  cacheService.initialize();
}

// Export individual functions for easier use
function getCache(key) {
  return cacheService.get(key);
}

function setCache(key, value, ttl = null) {
  return cacheService.set(key, value, ttl);
}

function deleteCache(key) {
  return cacheService.del(key);
}

function getSessionData(sessionId, key) {
  return cacheService.getSessionData(sessionId, key);
}

function setSessionData(sessionId, key, value, ttl = 1800) {
  return cacheService.setSessionData(sessionId, key, value, ttl);
}

function clearSessionData(sessionId) {
  return cacheService.clearSessionData(sessionId);
}

module.exports = {
  cacheService,
  initializeCache,
  getCache,
  setCache,
  deleteCache,
  getSessionData,
  setSessionData,
  clearSessionData
};
