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
;[
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

// Criar instância (inicializa automaticamente)
const sheets = new SheetsService(auth, spreadsheetId)

// Listar todos
const games = await sheets.getAll()

// Adicionar
await sheets.add({
  plataforma: 'PC',
  nome: 'Game Title',
  dataLancamento: '2025-01-01',
  genero: 'RPG',
  status: 'Não iniciado',
  tempo: '',
  inicio: '',
  fim: '',
  nota: ''
})

// Atualizar
await sheets.update(2, { nome: 'Novo Nome' })

// Deletar
await sheets.delete(2)

// Exportar CSV
const csv = await sheets.exportAsCSV()
```

### Métodos

#### `constructor(auth, spreadsheetId?)`
- Inicializa o client e armazena credenciais
- `auth`: GoogleAuth client (obrigatório)
- `spreadsheetId`: ID da planilha (usa constante como default)
- Lança erro se `auth` não fornecido
- Automaticamente pronto para uso (sem await necessário)

#### `isInitialized()`
- Retorna boolean indicando se está pronto
- Sempre true se construtor passou

#### `async getAll()`
- Retorna array de todos os jogos
- Cada jogo tem campos padronizados (id, nome, plataforma, etc)

#### `async add(gameData)`
- Adiciona novo jogo à planilha
- Campos: plataforma, nome, dataLancamento, genero, status, tempo, inicio, fim, nota

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
const value = await cacheService.getOrFetch(
  'key',
  async () => {
    return await expensiveOperation()
  },
  300
)

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
const auth = new google.auth.GoogleAuth({ credentials, scopes })

// Criar serviços com dependências
const sheetsService = new SheetsService(auth, spreadsheetId)
const igdbService = new IGDBService(clientId, clientSecret)

// Injetar nos requisitos
app.use((req, res, next) => {
  req.auth = { ready: true, error: null }
  req.sheetsService = sheetsService
  req.igdbService = igdbService
  next()
})
```

Vantagens:
- ✅ Serviços prontos no construtor
- ✅ Sem necessidade de `await initialize()`
- ✅ Testabilidade: fácil criar mocks com diferentes configs
- ✅ Dependências explícitas no construtor
- ✅ Reutilização: mesma instância em múltiplas rotas

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
  constructor(clientId, clientSecret) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  async getToken() {
    return 'mock-token'
  }

  async searchGames(query) {
    return [{ id: 1, name: 'Mock Game' }]
  }
}

// Usar em testes
const igdb = new MockIGDBService('test-id', 'test-secret')
```

### Mock SheetsService

```javascript
class MockSheetsService {
  constructor(auth, spreadsheetId) {
    this.auth = auth
    this.spreadsheetId = spreadsheetId
  }

  isInitialized() {
    return true
  }

  async getAll() {
    return [{ id: 1, nome: 'Test Game' }]
  }

  async add(gameData) {
    return { success: true }
  }

  async update(id, gameData) {
    return { success: true }
  }

  async delete(id) {
    return { success: true }
  }

  async exportAsCSV() {
    return ''
  }
}
```

## Adicionando Novo Serviço

1. Criar arquivo em `server/src/services/nomeService.js`
2. Implementar como classe com dependências no construtor
3. Importar e instanciar em `app.js`
4. Injetar no `req` object
5. Usar em routes

### Exemplo

```javascript
// server/src/services/analyticsService.js
class AnalyticsService {
  constructor(logger) {
    this.logger = logger
  }

  track(event, data) {
    this.logger.info(`Event: ${event}`, data)
  }
}

module.exports = AnalyticsService
```

```javascript
// Em app.js
const AnalyticsService = require('./services/analyticsService')
const analyticsService = new AnalyticsService(logger)

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

1. **Injete dependências no construtor** - mais testável
2. **Inicialize no construtor** - sem async, sem `initialize()`
3. **Use try/catch** e logger nos métodos
4. **Documente métodos** com JSDoc
5. **Valide entrada** antes de processar
6. **Reutilize instâncias** em múltiplas rotas para DRY

## Migração de Código Procedural

### Antes (procedural com async init)

```javascript
let sheetsClient = null

const initializeSheets = async (auth) => {
  sheetsClient = google.sheets({ version: 'v4', auth })
}

const getAll = async () => {
  const result = await sheetsClient.spreadsheets.values.get(...)
  return result
}

// Usar
await initializeSheets(auth)
const games = await getAll()
```

### Depois (class-based com constructor injection)

```javascript
class SheetsService {
  constructor(auth, spreadsheetId) {
    this.client = google.sheets({ version: 'v4', auth })
    this.spreadsheetId = spreadsheetId
  }

  async getAll() {
    const result = await this.client.spreadsheets.values.get(...)
    return result
  }
}

// Usar
const sheets = new SheetsService(auth, spreadsheetId)
const games = await sheets.getAll()
```

Benefícios:

- ✅ Sem async no construtor
- ✅ Estado encapsulado
- ✅ Dependências explícitas
- ✅ Mais fácil de testar
- ✅ Reutilizável em múltiplos contextos
- ✅ Sem surpresas com estado compartilhado
