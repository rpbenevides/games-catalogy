const NodeCache = require('node-cache')
const { logger } = require('../middleware/auth')

/**
 * Serviço de cache em memória
 * Útil para armazenar dados que mudam com frequência
 */
class CacheService {
  constructor(stdTTL = 300, checkPeriod = 60) {
    this.cache = new NodeCache({ stdTTL, checkPeriod })
  }

  /**
   * Obtém valor do cache
   * @param {string} key - Chave do cache
   * @returns {*} Valor ou undefined
   */
  get(key) {
    const value = this.cache.get(key)
    if (value !== undefined) {
      logger.info('Cache hit', { key })
      return value
    }
    logger.info('Cache miss', { key })
    return undefined
  }

  /**
   * Define um valor no cache
   * @param {string} key - Chave
   * @param {*} value - Valor a armazenar
   * @param {number} ttl - TTL em segundos (opcional)
   */
  set(key, value, ttl) {
    if (ttl !== undefined) {
      this.cache.set(key, value, ttl)
    } else {
      this.cache.set(key, value)
    }
    logger.info('Cache set', { key, ttl })
  }

  /**
   * Remove um item do cache
   * @param {string} key - Chave
   */
  delete(key) {
    this.cache.del(key)
    logger.info('Cache deleted', { key })
  }

  /**
   * Remove múltiplas chaves do cache
   * @param {string[]} keys - Array de chaves
   */
  deleteMany(keys) {
    this.cache.del(keys)
    logger.info('Multiple cache items deleted', { count: keys.length })
  }

  /**
   * Limpa todo o cache
   */
  flush() {
    this.cache.flushAll()
    logger.info('Cache flushed')
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    return this.cache.getStats()
  }

  /**
   * Obtém todas as chaves do cache
   */
  getKeys() {
    return this.cache.keys()
  }

  /**
   * Obtém ou executa função se não houver no cache
   * @param {string} key - Chave
   * @param {Function} fetcher - Função que retorna o valor
   * @param {number} ttl - TTL em segundos
   */
  async getOrFetch(key, fetcher, ttl) {
    const cached = this.get(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await fetcher()
    this.set(key, value, ttl)
    return value
  }
}

// Instância singleton do cache
const cacheService = new CacheService()

module.exports = cacheService
