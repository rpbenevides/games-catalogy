const { google } = require('googleapis')
const { logger } = require('../middleware/auth')
const constants = require('../config/constants')

/**
 * Serviço para gerenciar dados de jogos no Google Sheets
 * Realiza operações CRUD e exportação
 */
class SheetsService {
  constructor() {
    this.client = null
    this.spreadsheetId = constants.SPREADSHEET_ID
    this.sheetName = constants.SHEET_NAME
    this.dataRange = constants.DATA_RANGE
  }

  /**
   * Inicializa a conexão com Google Sheets
   * @param {GoogleAuth} auth - Cliente autenticado do Google
   */
  async initialize(auth) {
    try {
      this.client = google.sheets({ version: 'v4', auth })
      logger.info('Google Sheets inicializado com sucesso')
      return this
    } catch (error) {
      logger.error('Erro ao inicializar Google Sheets', {
        error: error.message
      })
      throw error
    }
  }

  /**
   * Verifica se está inicializado
   */
  isInitialized() {
    return this.client !== null
  }

  /**
   * Obtém todas os jogos da planilha
   */
  async getAll() {
    try {
      if (!this.isInitialized()) {
        throw new Error('Google Sheets não foi inicializado')
      }

      const result = await this.client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.dataRange
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

  /**
   * Adiciona um novo jogo
   * @param {Object} gameData - Dados do jogo
   */
  async add(gameData) {
    try {
      if (!this.isInitialized()) {
        throw new Error('Google Sheets não foi inicializado')
      }

      await this.client.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.dataRange,
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

  /**
   * Atualiza um jogo existente
   * @param {number} gameId - ID do jogo (número da linha)
   * @param {Object} gameData - Dados atualizados
   */
  async update(gameId, gameData) {
    try {
      if (!this.isInitialized()) {
        throw new Error('Google Sheets não foi inicializado')
      }

      const rowNumber = gameId

      await this.client.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A${rowNumber}:I${rowNumber}`,
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

  /**
   * Deleta um jogo
   * @param {number} gameId - ID do jogo (número da linha)
   */
  async delete(gameId) {
    try {
      if (!this.isInitialized()) {
        throw new Error('Google Sheets não foi inicializado')
      }

      // Obter todas as linhas para validar índice
      const result = await this.client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.dataRange
      })

      const rows = result.data.values || []
      const rowIndex = gameId - 2

      if (rowIndex < 0 || rowIndex >= rows.length) {
        throw new Error('Jogo não encontrado')
      }

      // Obter informações da planilha
      const spreadsheet = await this.client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      })

      const sheet = spreadsheet.data.sheets.find(
        s => s.properties.title === this.sheetName
      )

      if (!sheet) {
        throw new Error(`Aba "${this.sheetName}" não encontrada`)
      }

      const sheetId = sheet.properties.sheetId

      // Deletar a linha
      await this.client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
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

  /**
   * Exporta todos os jogos como CSV
   */
  async exportAsCSV() {
    try {
      if (!this.isInitialized()) {
        throw new Error('Google Sheets não foi inicializado')
      }

      const result = await this.client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:I`
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

      logger.info('Dados exportados como CSV', { rows: csvRows.length })
      return csvRows.join('\n')
    } catch (error) {
      logger.error('Erro ao exportar jogos', { error: error.message })
      throw error
    }
  }
}

module.exports = SheetsService
