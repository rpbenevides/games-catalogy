module.exports = {
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  SHEET_NAME: 'Jogos',
  DATA_RANGE: 'Jogos!A2:I',
  HEADER_ROW: 1,
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  RATE_LIMIT_WINDOW: 15 * 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 100,
  IGDB_API_URL: 'https://api.igdb.com/v4/games',
  TWITCH_AUTH_URL: 'https://id.twitch.tv/oauth2/token',
  GOOGLE_SHEETS_SCOPES: ['https://www.googleapis.com/auth/spreadsheets'],
  CORS_ORIGINS: process.env.FRONTEND_ORIGIN?.split(',') || []
}
