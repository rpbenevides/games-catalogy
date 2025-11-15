const app = require('./src/app')
const { logger } = require('./src/middleware/auth')
const constants = require('./src/config/constants')

const PORT = constants.PORT

app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`, {
    port: PORT,
    environment: constants.NODE_ENV
  })
})
