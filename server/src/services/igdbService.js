const axios = require('axios')
const { logger } = require('../middleware/auth')

/**
 * Serviço para integração com IGDB API
 * Gerencia autenticação com Twitch e buscas de jogos
 */
class IGDBService {
  constructor(clientId, clientSecret) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.token = null
    this.tokenExpiry = null
    this.authUrl = 'https://id.twitch.tv/oauth2/token'
    this.apiUrl = 'https://api.igdb.com/v4/games'
  }

  /**
   * Obtém token de autenticação da Twitch/IGDB
   * Reutiliza token em cache se ainda for válido
   */
  async getToken() {
    if (this.token && this.tokenExpiry > Date.now()) {
      return this.token
    }

    try {
      const response = await axios.post(this.authUrl, null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }
      })

      this.token = response.data.access_token
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000

      logger.info('Token IGDB obtido com sucesso', {
        expiresIn: response.data.expires_in
      })

      return this.token
    } catch (error) {
      logger.error('Falha ao obter token IGDB', {
        error: error.message,
        status: error.response?.status
      })
      throw new Error(`Falha na autenticação IGDB: ${error.message}`)
    }
  }

  /**
   * Busca jogos na IGDB por nome
   * @param {string} query - Nome do jogo a buscar
   * @returns {Promise<Array>} Array com resultados da busca
   */
  async searchGames(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query deve ser uma string não vazia')
    }

    try {
      const token = await this.getToken()
      const escaped = query.replace(/"/g, '\\"')
      const igdbQuery = `search \"${escaped}\"; fields name, first_release_date, platforms.name, genres.name; limit 10;`

      logger.info('Buscando jogos na IGDB', { query })

      const response = await axios.post(this.apiUrl, igdbQuery, {
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        timeout: 10000
      })

      logger.info('Busca IGDB realizada com sucesso', {
        query,
        results: response.data.length
      })

      return response.data || []
    } catch (error) {
      logger.error('Erro ao buscar jogos na IGDB', {
        error: error.message,
        query
      })
      throw error
    }
  }

  /**
   * Limpa token em cache (útil para logout ou teste)
   */
  clearToken() {
    this.token = null
    this.tokenExpiry = null
  }
}

module.exports = IGDBService
