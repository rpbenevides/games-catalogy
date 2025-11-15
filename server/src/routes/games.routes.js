const express = require('express')
const rateLimit = require('express-rate-limit')
const { validateGame } = require('../middleware/validation')
const { checkAuth, logger } = require('../middleware/auth')
const {
  getAllGames,
  addGame,
  updateGame,
  deleteGame,
  exportGamesAsCSV
} = require('../services/sheetsService')
const constants = require('../config/constants')

const router = express.Router()

const apiLimiter = rateLimit({
  windowMs: constants.RATE_LIMIT_WINDOW,
  max: constants.RATE_LIMIT_MAX_REQUESTS,
  message: 'Muitas requisições, tente novamente em 15 minutos',
  standardHeaders: true,
  legacyHeaders: false
})

// GET /api/games - Listar todos os jogos
router.get('/', apiLimiter, checkAuth, async (req, res, next) => {
  try {
    const games = await getAllGames()
    res.json(games)
  } catch (error) {
    next(error)
  }
})

// POST /api/games - Adicionar novo jogo
router.post('/', apiLimiter, checkAuth, validateGame, async (req, res, next) => {
  try {
    await addGame(req.body)
    res.status(201).json({ message: 'Jogo adicionado com sucesso' })
  } catch (error) {
    next(error)
  }
})

// PUT /api/games/:id - Atualizar jogo
router.put(
  '/:id',
  apiLimiter,
  checkAuth,
  validateGame,
  async (req, res, next) => {
    try {
      const gameId = parseInt(req.params.id, 10)
      if (isNaN(gameId) || gameId < 2) {
        return res.status(400).json({ message: 'ID de jogo inválido' })
      }

      await updateGame(gameId, req.body)
      res.json({ message: 'Jogo atualizado com sucesso' })
    } catch (error) {
      next(error)
    }
  }
)

// DELETE /api/games/:id - Deletar jogo
router.delete('/:id', apiLimiter, checkAuth, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.id, 10)
    if (isNaN(gameId) || gameId < 2) {
      return res.status(400).json({ message: 'ID de jogo inválido' })
    }

    await deleteGame(gameId)
    res.json({ message: 'Jogo deletado com sucesso' })
  } catch (error) {
    next(error)
  }
})

// GET /api/games/export - Exportar jogos como CSV
router.get('/export', apiLimiter, checkAuth, async (req, res, next) => {
  try {
    const csv = await exportGamesAsCSV()
    const filename = `meus-jogos-${new Date().toISOString().split('T')[0]}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    next(error)
  }
})

module.exports = router
