# Testing Guide

## Unit Tests com Jest

### Setup

```bash
npm install --save-dev jest supertest
```

### Configurar Jest

```json
// server/package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "collectCoverageFrom": ["src/**/*.js"]
  }
}
```

## Testando Services

### Test IGDBService

```javascript
// server/src/services/__tests__/igdbService.test.js
const IGDBService = require('../igdbService')
const axios = require('axios')

jest.mock('axios')

describe('IGDBService', () => {
  let service
  const clientId = 'test-client-id'
  const clientSecret = 'test-secret'

  beforeEach(() => {
    service = new IGDBService(clientId, clientSecret)
    jest.clearAllMocks()
  })

  describe('getToken()', () => {
    it('deve obter token da Twitch', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'mock-token',
          expires_in: 3600
        }
      })

      const token = await service.getToken()

      expect(token).toBe('mock-token')
      expect(axios.post).toHaveBeenCalledWith(
        'https://id.twitch.tv/oauth2/token',
        null,
        expect.any(Object)
      )
    })

    it('deve reutilizar token em cache', async () => {
      service.token = 'cached-token'
      service.tokenExpiry = Date.now() + 1000

      const token = await service.getToken()

      expect(token).toBe('cached-token')
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('deve lançar erro se falhar', async () => {
      axios.post.mockRejectedValueOnce(new Error('Auth failed'))

      await expect(service.getToken()).rejects.toThrow()
    })
  })

  describe('searchGames()', () => {
    it('deve buscar jogos com sucesso', async () => {
      axios.post.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Game' }]
      })
      service.token = 'valid-token'
      service.tokenExpiry = Date.now() + 1000

      const results = await service.searchGames('Witcher')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Game')
    })

    it('deve validar query', async () => {
      await expect(service.searchGames('')).rejects.toThrow()
      await expect(service.searchGames(null)).rejects.toThrow()
    })
  })

  describe('clearToken()', () => {
    it('deve limpar token', () => {
      service.token = 'some-token'
      service.tokenExpiry = Date.now()

      service.clearToken()

      expect(service.token).toBeNull()
      expect(service.tokenExpiry).toBeNull()
    })
  })
})
```

### Test SheetsService

```javascript
// server/src/services/__tests__/sheetsService.test.js
const SheetsService = require('../sheetsService')
const { google } = require('googleapis')

jest.mock('googleapis')

describe('SheetsService', () => {
  let service
  let mockAuth
  let mockSheetsClient

  beforeEach(() => {
    mockSheetsClient = {
      spreadsheets: {
        values: {
          get: jest.fn(),
          append: jest.fn(),
          update: jest.fn()
        },
        get: jest.fn(),
        batchUpdate: jest.fn()
      }
    }

    google.sheets = jest.fn().mockReturnValue(mockSheetsClient)
    mockAuth = {}
  })

  describe('constructor()', () => {
    it('deve inicializar com auth e spreadsheetId', () => {
      service = new SheetsService(mockAuth, 'test-sheet-id')

      expect(service.isInitialized()).toBe(true)
      expect(service.spreadsheetId).toBe('test-sheet-id')
    })

    it('deve usar ID padrão se não fornecido', () => {
      service = new SheetsService(mockAuth)

      expect(service.spreadsheetId).toBe(process.env.SPREADSHEET_ID || constants.SPREADSHEET_ID)
    })

    it('deve lançar erro se auth não fornecido', () => {
      expect(() => new SheetsService(null)).toThrow()
      expect(() => new SheetsService(undefined)).toThrow()
    })
  })

  describe('isInitialized()', () => {
    it('deve retornar true se construído com sucesso', () => {
      service = new SheetsService(mockAuth)
      expect(service.isInitialized()).toBe(true)
    })
  })

  describe('getAll()', () => {
    beforeEach(() => {
      service = new SheetsService(mockAuth, 'test-sheet-id')
    })

    it('deve retornar lista de jogos', async () => {
      mockSheetsClient.spreadsheets.values.get.mockResolvedValueOnce({
        data: {
          values: [
            [
              'PC',
              'Witcher 3',
              '2015-05-19',
              'RPG',
              'Concluído',
              '100h',
              '',
              '',
              '9'
            ]
          ]
        }
      })

      const games = await service.getAll()

      expect(games).toHaveLength(1)
      expect(games[0].nome).toBe('Witcher 3')
    })

    it('deve lançar erro se não inicializado', async () => {
      await expect(service.getAll()).rejects.toThrow()
    })
  })

  describe('add()', () => {
    it('deve adicionar jogo', async () => {
      service.client = mockSheetsClient

      const gameData = {
        plataforma: 'PC',
        nome: 'Game',
        dataLancamento: '2025-01-01',
        genero: 'RPG',
        status: 'Não iniciado',
        tempo: '',
        inicio: '',
        fim: '',
        nota: ''
      }

      await service.add(gameData)

      expect(mockSheetsClient.spreadsheets.values.append).toHaveBeenCalled()
    })
  })

  describe('update()', () => {
    it('deve atualizar jogo', async () => {
      service.client = mockSheetsClient

      await service.update(2, { nome: 'Updated' })

      expect(mockSheetsClient.spreadsheets.values.update).toHaveBeenCalled()
    })
  })

  describe('delete()', () => {
    it('deve deletar jogo', async () => {
      service.client = mockSheetsClient

      mockSheetsClient.spreadsheets.values.get.mockResolvedValueOnce({
        data: { values: [['PC', 'Game']] }
      })

      mockSheetsClient.spreadsheets.get.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { title: 'Jogos', sheetId: 0 } }]
        }
      })

      await service.delete(2)

      expect(mockSheetsClient.spreadsheets.batchUpdate).toHaveBeenCalled()
    })

    it('deve lançar erro se jogo não existe', async () => {
      service.client = mockSheetsClient

      mockSheetsClient.spreadsheets.values.get.mockResolvedValueOnce({
        data: { values: [] }
      })

      await expect(service.delete(2)).rejects.toThrow()
    })
  })
})
```

### Test CacheService

```javascript
// server/src/services/__tests__/cacheService.test.js
const cacheService = require('../cacheService')

describe('CacheService', () => {
  beforeEach(() => {
    cacheService.flush()
  })

  describe('get/set', () => {
    it('deve armazenar e recuperar valor', () => {
      cacheService.set('key', 'value')
      const result = cacheService.get('key')

      expect(result).toBe('value')
    })

    it('deve retornar undefined se não existe', () => {
      const result = cacheService.get('nonexistent')

      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('deve remover item', () => {
      cacheService.set('key', 'value')
      cacheService.delete('key')

      expect(cacheService.get('key')).toBeUndefined()
    })
  })

  describe('deleteMany', () => {
    it('deve remover múltiplos itens', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')

      cacheService.deleteMany(['key1', 'key2'])

      expect(cacheService.get('key1')).toBeUndefined()
      expect(cacheService.get('key2')).toBeUndefined()
    })
  })

  describe('flush', () => {
    it('deve limpar todo cache', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')

      cacheService.flush()

      expect(cacheService.getKeys()).toHaveLength(0)
    })
  })

  describe('getOrFetch', () => {
    it('deve retornar valor do cache se existe', async () => {
      cacheService.set('key', 'cached')
      const fetcher = jest.fn()

      const result = await cacheService.getOrFetch('key', fetcher)

      expect(result).toBe('cached')
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('deve executar fetcher se não existe', async () => {
      const fetcher = jest.fn().mockResolvedValueOnce('fetched')

      const result = await cacheService.getOrFetch('key', fetcher, 300)

      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('deve retornar estatísticas', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')

      const stats = cacheService.getStats()

      expect(stats.keys).toBe(2)
    })
  })

  describe('getKeys', () => {
    it('deve retornar lista de chaves', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')

      const keys = cacheService.getKeys()

      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
    })
  })
})
```

## Testando Routes

### Test Games Routes

```javascript
// server/src/routes/__tests__/games.routes.test.js
const request = require('supertest')
const express = require('express')
const gamesRoutes = require('../games.routes')

describe('Games Routes', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())

    // Mock middleware
    app.use((req, res, next) => {
      req.auth = { ready: true }
      req.sheetsService = {
        getAll: jest.fn(),
        add: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        exportAsCSV: jest.fn()
      }
      next()
    })

    app.use('/games', gamesRoutes)
  })

  describe('GET /games', () => {
    it('deve retornar lista de jogos', async () => {
      app._router.stack.forEach(middleware => {
        if (middleware.name === 'router') {
          middleware.handle.stack[0].handle = (req, res, next) => {
            req.sheetsService.getAll = jest
              .fn()
              .mockResolvedValueOnce([{ id: 1, nome: 'Game' }])
            next()
          }
        }
      })

      const response = await request(app).get('/games')

      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })

    it('deve retornar 503 se não autenticado', async () => {
      app = express()
      app.use(express.json())
      app.use((req, res, next) => {
        req.auth = { ready: false }
        next()
      })
      app.use('/games', gamesRoutes)

      const response = await request(app).get('/games')

      expect(response.status).toBe(503)
    })
  })

  describe('POST /games', () => {
    it('deve adicionar jogo', async () => {
      const gameData = {
        plataforma: 'PC',
        nome: 'Game',
        dataLancamento: '2025-01-01',
        genero: 'RPG',
        status: 'Não iniciado',
        tempo: '',
        inicio: '',
        fim: '',
        nota: ''
      }

      const response = await request(app).post('/games').send(gameData)

      expect(response.status).toBe(201)
    })

    it('deve validar dados', async () => {
      const invalidData = { plataforma: 'PC' } // falta nome

      const response = await request(app).post('/games').send(invalidData)

      expect(response.status).toBe(400)
    })
  })
})
```

## Integration Tests

```javascript
// server/__tests__/integration.test.js
const request = require('supertest')
const app = require('../src/app')

describe('Integration Tests', () => {
  describe('Full Game Lifecycle', () => {
    it('deve criar, ler, atualizar e deletar jogo', async () => {
      const gameData = {
        /* ... */
      }

      // Create
      const createResponse = await request(app).post('/games').send(gameData)
      expect(createResponse.status).toBe(201)

      // Read
      const readResponse = await request(app).get('/games')
      expect(readResponse.status).toBe(200)

      // Update
      const updateResponse = await request(app)
        .put('/games/2')
        .send({ ...gameData, nome: 'Updated' })
      expect(updateResponse.status).toBe(200)

      // Delete
      const deleteResponse = await request(app).delete('/games/2')
      expect(deleteResponse.status).toBe(200)
    })
  })

  describe('Error Scenarios', () => {
    it('deve lidar com ID inválido', async () => {
      const response = await request(app).delete('/games/invalid')

      expect(response.status).toBe(400)
    })
  })
})
```

## Executar Testes

```bash
# Todos os testes
npm test

# Watch mode
npm run test:watch

# Com coverage
npm test -- --coverage

# Teste específico
npm test -- igdbService.test.js
```

## Coverage Target

```json
{
  "jest": {
    "collectCoverageFrom": ["src/**/*.js"],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```
