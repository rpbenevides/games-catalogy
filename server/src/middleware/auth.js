// Logging estruturado
const logger = {
  info: (message, meta = {}) =>
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      })
    ),
  error: (message, meta = {}) =>
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      })
    ),
  warn: (message, meta = {}) =>
    console.warn(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      })
    )
}

const checkAuth = (req, res, next) => {
  if (!req.auth || !req.auth.ready) {
    return res.status(503).json({
      message:
        'Serviço temporariamente indisponível. Autenticação Google não inicializada.',
      error: req.auth?.error?.message
    })
  }
  next()
}

module.exports = {
  logger,
  checkAuth
}
