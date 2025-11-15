# Services Architecture

## Overview

Os serviços foram refatorados para um padrão orientado a objetos (classe) para melhor organização, testabilidade e manutenibilidade.

## IGDBService

Gerencia integração com IGDB API através da autenticação Twitch.

### Uso

```javascript
const IGDBService = require('./services/igdbService')

// Inicializar
const igdb = new IGDBService(clientId, clientSecret)

// Buscar jogos
const results = await igdb.searchGames('The Witcher')
// Retorna: Array de objetos com nome, data lançamento, plataformas, gêneros

// Obter token (usado internamente)
const token = await igdb.getToken()

// Limpar cache de token
igdb.clearToken()
```

### Métodos

#### `constructor(clientId, clientSecret)`
- Inicializa o serviço com credenciais Twitch
- Token começa como `null`

#### `async getToken()`
- Obtém token de autenticação
- Reutiliza token em cache se ainda válido
- Retorna string do token
- Lança erro se falhar

#### `async searchGames(query)`
- Busca jogos na IGDB
- Valida query (deve ser string não vazia)
- Retorna array de resultados
- Lança erro se falhar

#### `clearToken()`
- Limpa token do cache
- Força nova autenticação na próxima busca

### Exemplo de Resposta

```javascript
[
  {
    id: 1,
    name: 'The Witcher 3: Wild Hunt',
    first_release_date: 1431979200,
    platforms: [{ id: 6, name: 'PC' }],
    genres: [{ id: 12, name: 'Role-playing (RPG)' }]
  }
]
```

## SheetsService

Gerencia leitura/escrita de dados no Google Sheets.

### Uso

```javascript
const SheetsService = require('./services/sheetsService')
const { google } = require('googleapis')

// Inicializar
const sheets = new SheetsService()
await sheets.initialize(auth) // auth = GoogleAuth client

// Listar todos
const games = await sheets.getAll()

// Adicionar
await sheets.add({
  plataforma: 'PC',
  nome: 'Game Title',
  dataLancamento: '2025-01-01',
  // ... outros campos
})

// Atualizar
await sheets.update(2, { nome: 'Novo Nome' })

// Deletar
await sheets.delete(2)

// Exportar CSV
const csv = await sheets.exportAsCSV()
```

### Métodos

#### `async initialize(auth)`
- Configura conexão com Google Sheets
- Recebe GoogleAuth client
- Lança erro se falhar

#### `isInitialized()`
- Retorna boolean indicando se está pronto

#### `async getAll()`
- Retorna array de todos os jogos
- Cada jogo tem campos padronizados (id, nome, plataforma, etc)

#### `async add(gameData)`
- Adiciona novo jogo à planilha
- Campos padrão: plataforma, nome, dataLancamento, genero, status, tempo, inicio, fim, nota

#### `async update(gameId, gameData)`
- Atualiza jogo existente
- gameId é o número da linha na planilha

#### `async delete(gameId)`
- Deleta um jogo
- Valida se existe antes de deletar

#### `async exportAsCSV()`
- Retorna string com dados em formato CSV
- Escapando aspas e vírgulas corretamente

## CacheService

Serviço de cache em memória para melhorar performance.

### Uso

```javascript
const cacheService = require('./services/cacheService')

// Get
const value = cacheService.get('key')

// Set (TTL padrão 300s)
cacheService.set('key', { data: 'value' })

// Set com TTL customizado
cacheService.set('key', { data: 'value' }, 600) // 10 minutos

// Delete um item
cacheService.delete('key')

// Delete múltiplos
cacheService.deleteMany(['key1', 'key2'])

// Limpar tudo
cacheService.flush()

// Lazy loading
const value = await cacheService.getOrFetch('key', async () => {
  return await expensiveOperation()
}, 300)

// Estatísticas
const stats = cacheService.getStats()
console.log(stats) // { ksize: 5, vsize: 1234, keys: 5 }

// Listar chaves
const keys = cacheService.getKeys()
```

### Métodos

#### `get(key)`
- Retorna valor do cache
- Log automaticamente hit/miss
- Retorna `undefined` se não existe

#### `set(key, value, ttl?)`
- Armazena valor no cache
- TTL em segundos (opcional, padrão 300)

#### `delete(key)`
- Remove um item

#### `deleteMany(keys)`
- Remove múltiplos itens

#### `flush()`
- Limpa cache inteiro

#### `getOrFetch(key, fetcher, ttl)`
- Get com fallback a função
- Se não está no cache, executa fetcher e armazena resultado
- Útil para lazy loading

#### `getStats()`
- Retorna estatísticas: ksize, vsize, keys

#### `getKeys()`
- Retorna array de todas as chaves

## Injeção de Dependência

Os serviços são injetados no `req` object no `app.js`:

```javascript
// Em app.js
app.use((req, res, next) => {
  req.auth = { ready: true, error: null }
  req.sheetsService = sheetsService
  req.igdbService = igdbService
  next()
})
```

Isso permite usar em routes:

```javascript
// Em routes/games.routes.js
router.get('/', async (req, res, next) => {
  const games = await req.sheetsService.getAll()
  res.json(games)
})
```

## Testing

### Mock IGDBService

```javascript
class MockIGDBService {
  async getToken() { return 'mock-token' }
  async searchGames(query) { return [] }
}

// Usar em testes
const igdb = new MockIGDBService()
```

### Mock SheetsService

```javascript
class MockSheetsService {
  async initialize() {}
  isInitialized() { return true }
  async getAll() { return [] }
  async add() {}
  async update() {}
  async delete() {}
  async exportAsCSV() { return '' }
}
```

## Adicionando Novo Serviço

1. Criar arquivo em `server/src/services/nomeService.js`
2. Implementar como classe
3. Importar em `app.js`
4. Inicializar e injetar em `req`
5. Usar em routes

### Exemplo

```javascript
// server/src/services/analyticsService.js
class AnalyticsService {
  track(event, data) {
    console.log(`Event: ${event}`, data)
  }
}

module.exports = AnalyticsService
```

```javascript
// Em app.js
const AnalyticsService = require('./services/analyticsService')
const analyticsService = new AnalyticsService()

app.use((req, res, next) => {
  req.analyticsService = analyticsService
  next()
})
```

```javascript
// Em routes
router.post('/', (req, res) => {
  req.analyticsService.track('game_added', { name: req.body.nome })
  // ...
})
```

## Boas Práticas

1. **Use classes** para melhor organização
2. **Injete dependências** no `req` object
3. **Use try/catch** e logger nos métodos
4. **Documente métodos** com JSDoc
5. **Valide entrada** antes de processar
6. **Reutilize em múltiplas rotas** para DRY

## Migração de Código Procedural

### Antes (procedural)

```javascript
const getAllGames = async () => {
  const sheets = getSheets()
  // ...
}

module.exports = { getAllGames }

// Usar
const games = await getAllGames()
```

### Depois (class-based)

```javascript
class SheetsService {
  async getAll() {
    // ...
  }
}

module.exports = SheetsService

// Usar
const sheets = new SheetsService()
await sheets.initialize(auth)
const games = await sheets.getAll()
```

Benefícios:
- ✅ Estado encapsulado
- ✅ Mais fácil de testar
- ✅ Dependency injection
- ✅ Reutilizável em múltiplos contextos
