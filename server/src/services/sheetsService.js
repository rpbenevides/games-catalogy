const { google } = require('googleapis')
const { logger } = require('../middleware/auth')
const constants = require('../config/constants')

let sheetsClient = null

const initializeSheets = async (auth) => {
  try {
    sheetsClient = google.sheets({ version: 'v4', auth })
    logger.info('Google Sheets inicializado com sucesso')
    return sheetsClient
  } catch (error) {
    logger.error('Erro ao inicializar Google Sheets', { error: error.message })
    throw error
  }
}

const getSheets = () => {
  if (!sheetsClient) {
    throw new Error('Google Sheets não foi inicializado')
  }
  return sheetsClient
}

const getAllGames = async () => {
  try {
    const sheets = getSheets()
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.SPREADSHEET_ID,
      range: constants.DATA_RANGE
    })

    const rows = result.data.values || []
    const games = rows.map((row, index) => ({
      id: index + 2,
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
    return games
  } catch (error) {
    logger.error('Erro ao carregar jogos', { error: error.message })
    throw error
  }
}

const addGame = async (gameData) => {
  try {
    const sheets = getSheets()
    await sheets.spreadsheets.values.append({
      spreadsheetId: constants.SPREADSHEET_ID,
      range: constants.DATA_RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            gameData.plataforma,
            gameData.nome,
            gameData.dataLancamento || '',
            gameData.genero || '',
            gameData.status || 'Não iniciado',
            gameData.tempo || '',
            gameData.inicio || '',
            gameData.fim || '',
            gameData.nota || ''
          ]
        ]
      }
    })

    logger.info('Jogo adicionado com sucesso', { nome: gameData.nome })
  } catch (error) {
    logger.error('Erro ao adicionar jogo', { error: error.message })
    throw error
  }
}

const updateGame = async (gameId, gameData) => {
  try {
    const sheets = getSheets()
    const rowNumber = gameId

    await sheets.spreadsheets.values.update({
      spreadsheetId: constants.SPREADSHEET_ID,
      range: `${constants.SHEET_NAME}!A${rowNumber}:I${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            gameData.plataforma,
            gameData.nome,
            gameData.dataLancamento || '',
            gameData.genero || '',
            gameData.status || 'Não iniciado',
            gameData.tempo || '',
            gameData.inicio || '',
            gameData.fim || '',
            gameData.nota || ''
          ]
        ]
      }
    })

    logger.info('Jogo atualizado com sucesso', {
      id: gameId,
      nome: gameData.nome
    })
  } catch (error) {
    logger.error('Erro ao atualizar jogo', {
      error: error.message,
      id: gameId
    })
    throw error
  }
}

const deleteGame = async (gameId) => {
  try {
    const sheets = getSheets()

    // Obter todas as linhas
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.SPREADSHEET_ID,
      range: constants.DATA_RANGE
    })

    const rows = result.data.values || []
    const rowIndex = gameId - 2

    if (rowIndex < 0 || rowIndex >= rows.length) {
      throw new Error('Jogo não encontrado')
    }

    // Obter informações da planilha
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: constants.SPREADSHEET_ID
    })

    const sheet = spreadsheet.data.sheets.find(
      s => s.properties.title === constants.SHEET_NAME
    )

    if (!sheet) {
      throw new Error(`Aba "${constants.SHEET_NAME}" não encontrada`)
    }

    const sheetId = sheet.properties.sheetId

    // Deletar a linha
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: constants.SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: gameId - 1,
                endIndex: gameId
              }
            }
          }
        ]
      }
    })

    logger.info('Jogo deletado com sucesso', { id: gameId })
  } catch (error) {
    logger.error('Erro ao deletar jogo', {
      error: error.message,
      id: gameId
    })
    throw error
  }
}

const exportGamesAsCSV = async () => {
  try {
    const sheets = getSheets()
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.SPREADSHEET_ID,
      range: `${constants.SHEET_NAME}!A1:I`
    })

    const rows = result.data.values || []
    const csvRows = rows.map(row => {
      return row
        .map(cell => {
          const cellStr = String(cell || '')
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

    return csvRows.join('\n')
  } catch (error) {
    logger.error('Erro ao exportar jogos', { error: error.message })
    throw error
  }
}

module.exports = {
  initializeSheets,
  getSheets,
  getAllGames,
  addGame,
  updateGame,
  deleteGame,
  exportGamesAsCSV
}
