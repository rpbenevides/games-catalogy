require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const axios = require('axios')
const { google } = require('googleapis')
const path = require('path')
const Joi = require('joi')
const rateLimit = require('express-rate-limit')
const { v4: uuidv4 } = require('uuid')

// Validação de variáveis de ambiente obrigatórias
const requiredEnvVars = [
  'SPREADSHEET_ID',
  'GOOGLE_CREDENTIALS_JSON',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET'
]

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
if (missingEnvVars.length > 0) {
  console.error(
    '❌ Variáveis de ambiente obrigatórias ausentes:',
    missingEnvVars.join(', ')
  )
  console.error(
    'Por favor, configure todas as variáveis necessárias no arquivo .env'
  )
  process.exit(1)
}

const app = express()

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas requisições, tente novamente em 15 minutos',
  standardHeaders: true,
  legacyHeaders: false
})

app.use(helmet())
app.use(express.json())
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || [] }))

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

let auth
let authReady = false
let authError = null

;(async () => {
  try {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON
    if (!credentialsJson) {
      throw new Error(
        'A variável de ambiente GOOGLE_CREDENTIALS_JSON não foi definida.'
      )
    }
    const credentials = JSON.parse(credentialsJson)

    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    // Testar a autenticação
    await auth.getClient()
    authReady = true
    logger.info('Autenticação Google inicializada com sucesso')
  } catch (err) {
    authError = err
    logger.error('Falha na autenticação Google', { error: err.message })
  }
})()

const getSheets = () => {
  if (!auth || !authReady) {
    throw new Error('Auth Google não inicializado ou não está pronto')
  }
  return google.sheets({ version: 'v4', auth })
}

// Middleware para verificar se auth está pronto
const checkAuth = (req, res, next) => {
  if (!authReady) {
    return res.status(503).json({
      message:
        'Serviço temporariamente indisponível. Autenticação Google não inicializada.',
      error: authError?.message
    })
  }
  next()
}

// ----------------- Middleware de Validação -----------------
const gameSchema = Joi.object({
  plataforma: Joi.string().trim().required().max(100),
  nome: Joi.string().trim().required().max(200),
  dataLancamento: Joi.string().isoDate().allow(''),
  genero: Joi.string().allow('').max(200),
  status: Joi.string()
    .valid('Não iniciado', 'Jogando', 'Pausado', 'Concluído', 'Dropado')
    .default('Não iniciado'),
  tempo: Joi.string()
    .pattern(/^(\d+h)?\s*(\d+m?)?$/i)
    .allow(''),
  inicio: Joi.string().isoDate().allow(''),
  fim: Joi.string().isoDate().allow(''),
  nota: Joi.number().min(0).max(10).allow(null, '')
})

const validateGame = (req, res, next) => {
  const { error } = gameSchema.validate(req.body)
  if (error) {
    logger.warn('Validação falhou', { errors: error.details })
    return res.status(400).json({
      message: 'Dados inválidos',
      errors: error.details.map(d => d.message)
    })
  }
  next()
}

// ----------------- IGDB -----------------
let igdbToken = null
let igdbTokenExpiry = null

const getIGDBToken = async () => {
  if (igdbToken && igdbTokenExpiry > Date.now()) return igdbToken

  try {
    const resp = await axios.post(`https://id.twitch.tv/oauth2/token`, null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    })
    igdbToken = resp.data.access_token
    igdbTokenExpiry = Date.now() + resp.data.expires_in * 1000
    return igdbToken
  } catch (error) {
    logger.error('Erro ao obter token IGDB', { error: error.message })
    throw error
  }
}

app.get('/games/search', apiLimiter, async (req, res, next) => {
  try {
    const { name } = req.query
    const safe = String(name ?? '').trim()
    if (!safe) return res.status(400).send('Nome do jogo é obrigatório.')

    const token = await getIGDBToken()
    const escaped = safe.replace(/"/g, '\\"')
    const query = `search \"${escaped}\"; fields name, first_release_date, platforms.name, genres.name; limit 10;`

    const igdbResp = await axios.post('https://api.igdb.com/v4/games', query, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`
      },
      timeout: 10000
    })

    logger.info('Busca IGDB realizada', {
      query: safe,
      results: igdbResp.data.length
    })
    res.json(igdbResp.data)
  } catch (err) {
    logger.error('Erro na busca IGDB', { error: err.message })
    next(err)
  }
})

// ----------------- Google Sheets -----------------
const SPREADSHEET_ID = process.env.SPREADSHEET_ID
if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID ausente')

const SHEET_NAME = 'Jogos'
const DATA_RANGE = `${SHEET_NAME}!A2:I`
const HEADER_ROW = 1 // Linha 1 é o cabeçalho

// Função auxiliar para converter linha do Sheets em índice (começando em 0)
const getRowIndex = rowNumber => rowNumber - HEADER_ROW - 1

app.get('/games', apiLimiter, checkAuth, async (req, res, next) => {
  try {
    const sheets = getSheets()
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: DATA_RANGE
    })
    const rows = result.data.values || []

    const games = rows.map((row, index) => ({
      id: index + 2, // ID baseado na linha do Sheets (linha 2 = índice 0)
      plataforma: row[0] || '',
      nome: row[1] || '',
      dataLancamento: row[2] || '',
      genero: row[3] || '',
      status: row[4] || '',
      tempo: row[5] || '',
      inicio: row[6] || '',
      fim: row[7] || '',
      nota: row[8] || ''
    }))

    logger.info('Jogos carregados', { count: games.length })
    res.json(games)
  } catch (err) {
    logger.error('Erro ao carregar jogos', { error: err.message })
    next(err)
  }
})

app.post(
  '/games',
  apiLimiter,
  checkAuth,
  validateGame,
  async (req, res, next) => {
    try {
      const data = req.body

      const sheets = getSheets()
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: DATA_RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              data.plataforma,
              data.nome,
              data.dataLancamento || '',
              data.genero || '',
              data.status || 'Não iniciado',
              data.tempo || '',
              data.inicio || '',
              data.fim || '',
              data.nota || ''
            ]
          ]
        }
      })

      logger.info('Jogo adicionado com sucesso', { nome: data.nome })
      res.status(201).json({ message: 'Jogo adicionado com sucesso' })
    } catch (err) {
      logger.error('Erro ao adicionar jogo', { error: err.message })
      next(err)
    }
  }
)

// PUT /games/:id - Atualizar jogo
app.put(
  '/games/:id',
  apiLimiter,
  checkAuth,
  validateGame,
  async (req, res, next) => {
    try {
      const gameId = parseInt(req.params.id, 10)
      if (isNaN(gameId) || gameId < 2) {
        return res.status(400).json({ message: 'ID de jogo inválido' })
      }

      const data = req.body
      const rowNumber = gameId // ID corresponde à linha no Sheets

      const sheets = getSheets()
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${rowNumber}:I${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              data.plataforma,
              data.nome,
              data.dataLancamento || '',
              data.genero || '',
              data.status || 'Não iniciado',
              data.tempo || '',
              data.inicio || '',
              data.fim || '',
              data.nota || ''
            ]
          ]
        }
      })

      logger.info('Jogo atualizado com sucesso', {
        id: gameId,
        nome: data.nome
      })
      res.json({ message: 'Jogo atualizado com sucesso' })
    } catch (err) {
      logger.error('Erro ao atualizar jogo', {
        error: err.message,
        id: req.params.id
      })
      next(err)
    }
  }
)

// DELETE /games/:id - Deletar jogo
app.delete('/games/:id', apiLimiter, checkAuth, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.id, 10)
    if (isNaN(gameId) || gameId < 2) {
      return res.status(400).json({ message: 'ID de jogo inválido' })
    }

    const sheets = getSheets()

    // Obter todas as linhas para encontrar a linha correta pelo índice
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: DATA_RANGE
    })

    const rows = result.data.values || []

    // Verificar se o índice é válido
    const rowIndex = gameId - 2 // Converter ID para índice (ID 2 = index 0)
    if (rowIndex < 0 || rowIndex >= rows.length) {
      return res.status(404).json({ message: 'Jogo não encontrado' })
    }

    // Obter informações da planilha para encontrar o sheetId correto
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    })

    const sheet = spreadsheet.data.sheets.find(
      s => s.properties.title === SHEET_NAME
    )

    if (!sheet) {
      return res
        .status(404)
        .json({ message: 'Aba "Jogos" não encontrada na planilha' })
    }

    const sheetId = sheet.properties.sheetId

    // Deletar a linha (linha no Sheets = index + 2, pois começa em 1 e tem cabeçalho)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: gameId - 1, // Ajustado: gameId = row number - 1
                endIndex: gameId
              }
            }
          }
        ]
      }
    })

    logger.info('Jogo deletado com sucesso', { id: gameId })
    res.json({ message: 'Jogo deletado com sucesso' })
  } catch (err) {
    logger.error('Erro ao deletar jogo', {
      error: err.message,
      id: req.params.id,
      stack: err.stack
    })
    next(err)
  }
})

// GET /games/export - Exportar jogos como CSV
app.get('/games/export', apiLimiter, checkAuth, async (req, res, next) => {
  try {
    const sheets = getSheets()
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:I` // Inclui cabeçalho
    })
    const rows = result.data.values || []

    // Converter para CSV
    const csvRows = rows.map(row => {
      return row
        .map(cell => {
          const cellStr = String(cell || '')
          // Escapar aspas e envolver em aspas se contém vírgula, quebra de linha ou aspas
          if (
            cellStr.includes(',') ||
            cellStr.includes('\n') ||
            cellStr.includes('"')
          ) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        })
        .join(',')
    })

    const csv = csvRows.join('\n')
    const filename = `meus-jogos-${new Date().toISOString().split('T')[0]}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('\ufeff' + csv) // BOM para Excel reconhecer UTF-8
  } catch (err) {
    logger.error('Erro ao exportar jogos', { error: err.message })
    next(err)
  }
})

// ----------------- Health Check -----------------
app.get('/health', (req, res) => {
  const health = {
    status: authReady ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      googleAuth: authReady ? 'ready' : 'not_ready',
      igdb: process.env.TWITCH_CLIENT_ID ? 'configured' : 'not_configured'
    }
  }

  const statusCode = authReady ? 200 : 503
  res.status(statusCode).json(health)
})

// ----------------- Servir frontend -----------------
app.use(express.static(path.join(__dirname, 'public')))

// ----------------- Middleware de Tratamento de Erros -----------------
app.use((err, req, res, next) => {
  logger.error('Erro não tratado', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  })

  res.status(500).json({
    message: 'Ocorreu um erro inesperado no servidor.',
    error:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error'
  })
})

// Rota padrão para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ----------------- Inicia o servidor -----------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  })
})
