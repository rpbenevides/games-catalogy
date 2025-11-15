const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const path = require('path')
const { google } = require('googleapis')

const { validateEnvironment, getGoogleCredentials } = require('./config/environment')
const constants = require('./config/constants')
const { logger, checkAuth } = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')
const { initializeSheets } = require('./services/sheetsService')
const { searchGames } = require('./services/igdbService')

const gamesRoutes = require('./routes/games.routes')
const healthRoutes = require('./routes/health.routes')

const rateLimit = require('express-rate-limit')

// Validar ambiente
validateEnvironment()

const app = express()

// Middleware de segurança e parsing
app.use(helmet())
app.use(express.json())
app.use(cors({ origin: constants.CORS_ORIGINS }))

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: constants.RATE_LIMIT_WINDOW,
  max: constants.RATE_LIMIT_MAX_REQUESTS,
  message: 'Muitas requisições, tente novamente em 15 minutos',
  standardHeaders: true,
  legacyHeaders: false
})

// Inicializar Google Auth
let authReady = false
let authError = null

;(async () => {
  try {
    const credentials = getGoogleCredentials()

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: constants.GOOGLE_SHEETS_SCOPES
    })

    // Testar a autenticação
    await auth.getClient()

    // Inicializar Sheets
    await initializeSheets(auth)

    authReady = true
    logger.info('Autenticação Google inicializada com sucesso')

    // Adicionar auth aos requisitos do app
    app.use((req, res, next) => {
      req.auth = { ready: true, error: null }
      next()
    })
  } catch (err) {
    authError = err
    logger.error('Falha na autenticação Google', { error: err.message })

    app.use((req, res, next) => {
      req.auth = { ready: false, error: authError }
      next()
    })
  }
})()

// Rota de busca IGDB
app.get('/search', apiLimiter, async (req, res, next) => {
  try {
    const { name } = req.query
    const safe = String(name ?? '').trim()

    if (!safe) {
      return res.status(400).json({
        message: 'Nome do jogo é obrigatório'
      })
    }

    const results = await searchGames(safe)
    res.json(results)
  } catch (error) {
    next(error)
  }
})

// Rotas da API
app.use('/games', gamesRoutes)
app.use('/health', healthRoutes)

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../../client/src')))

// Middleware de tratamento de erros
app.use(errorHandler)

// Rota padrão para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/src', 'index.html'))
})

module.exports = app
