const axios = require('axios')
const { logger } = require('../middleware/auth')

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

const searchGames = async (query) => {
  try {
    const token = await getIGDBToken()
    const escaped = query.replace(/"/g, '\\"')
    const igdbQuery = `search \"${escaped}\"; fields name, first_release_date, platforms.name, genres.name; limit 10;`

    const response = await axios.post('https://api.igdb.com/v4/games', igdbQuery, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`
      },
      timeout: 10000
    })

    logger.info('Busca IGDB realizada', {
      query,
      results: response.data.length
    })

    return response.data
  } catch (error) {
    logger.error('Erro na busca IGDB', { error: error.message })
    throw error
  }
}

module.exports = {
  searchGames,
  getIGDBToken
}
