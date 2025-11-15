const express = require('express')

const router = express.Router()

// GET /api/health - Health check
router.get('/', (req, res) => {
  const auth = req.auth || {}
  const health = {
    status: auth.ready ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      googleAuth: auth.ready ? 'ready' : 'not_ready',
      igdb: process.env.TWITCH_CLIENT_ID ? 'configured' : 'not_configured'
    }
  }

  const statusCode = auth.ready ? 200 : 503
  res.status(statusCode).json(health)
})

module.exports = router
