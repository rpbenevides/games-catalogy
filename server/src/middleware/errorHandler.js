const { logger } = require('./auth')

const errorHandler = (err, req, res, next) => {
  logger.error('Erro não tratado', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  })

  const statusCode = err.statusCode || 500
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'Ocorreu um erro inesperado no servidor.'

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  })
}

module.exports = errorHandler
