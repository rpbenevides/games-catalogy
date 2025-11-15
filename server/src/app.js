const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const path = require('path')
const { google } = require('googleapis')
const rateLimit = require('express-rate-limit')

const {
  validateEnvironment,
  getGoogleCredentials
} = require('./config/environment')
const constants = require('./config/constants')
const { logger, checkAuth } = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')

// Services
const SheetsService = require('./services/sheetsService')
const IGDBService = require('./services/igdbService')

// Routes
const gamesRoutes = require('./routes/games.routes')
const healthRoutes = require('./routes/health.routes')

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

// Instâncias de serviços globais
let sheetsService = null
let igdbService = null
let authReady = false
let authError = null

/**
 * Inicializa os serviços
 */
const initializeServices = async () => {
  try {
    const credentials = getGoogleCredentials()

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: constants.GOOGLE_SHEETS_SCOPES
    })

    // Testar a autenticação
    await auth.getClient()

    // Inicializar Sheets Service
    sheetsService = new SheetsService()
    await sheetsService.initialize(auth)

    // Inicializar IGDB Service
    igdbService = new IGDBService(
      process.env.TWITCH_CLIENT_ID,
      process.env.TWITCH_CLIENT_SECRET
    )

    authReady = true
    logger.info('Serviços inicializados com sucesso')

    // Adicionar auth aos requisitos do app
    app.use((req, res, next) => {
      req.auth = { ready: true, error: null }
      req.sheetsService = sheetsService
      req.igdbService = igdbService
      next()
    })
  } catch (err) {
    authError = err
    logger.error('Falha ao inicializar serviços', { error: err.message })

    app.use((req, res, next) => {
      req.auth = { ready: false, error: authError }
      next()
    })
  }
}

// Inicializar serviços no startup
initializeServices()

/**
 * Rota de busca IGDB
 */
app.get('/search', apiLimiter, async (req, res, next) => {
  try {
    const { name } = req.query
    const safe = String(name ?? '').trim()

    if (!safe) {
      return res.status(400).json({
        message: 'Nome do jogo é obrigatório'
      })
    }

    const results = await req.igdbService.searchGames(safe)
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
