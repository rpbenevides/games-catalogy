const NodeCache = require('node-cache')
const { logger } = require('../middleware/auth')

const cache = new NodeCache({ stdTTL: 300 }) // 5 minutos de TTL

const get = (key) => {
  const value = cache.get(key)
  if (value) {
    logger.info('Cache hit', { key })
  }
  return value
}

const set = (key, value, ttl = undefined) => {
  cache.set(key, value, ttl)
  logger.info('Cache set', { key })
}

const delete_ = (key) => {
  cache.del(key)
  logger.info('Cache deleted', { key })
}

const flush = () => {
  cache.flushAll()
  logger.info('Cache flushed')
}

module.exports = {
  get,
  set,
  delete: delete_,
  flush
}
