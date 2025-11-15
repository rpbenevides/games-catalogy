require('dotenv').config()

const requiredEnvVars = [
  'SPREADSHEET_ID',
  'GOOGLE_CREDENTIALS_JSON',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET'
]

const validateEnvironment = () => {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  if (missingVars.length > 0) {
    console.error(
      '❌ Variáveis de ambiente obrigatórias ausentes:',
      missingVars.join(', ')
    )
    console.error(
      'Por favor, configure todas as variáveis necessárias no arquivo .env'
    )
    process.exit(1)
  }
}

const getGoogleCredentials = () => {
  try {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
  } catch (err) {
    console.error('Erro ao fazer parse das credenciais Google:', err.message)
    process.exit(1)
  }
}

module.exports = {
  validateEnvironment,
  getGoogleCredentials
}
