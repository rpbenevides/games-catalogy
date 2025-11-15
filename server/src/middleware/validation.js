const Joi = require('joi')
const { logger } = require('./auth')

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

module.exports = {
  validateGame,
  gameSchema
}
