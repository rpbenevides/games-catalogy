# Guia de Desenvolvimento

## Estrutura do Projeto

```
├── server/                    # Backend Express
│   ├── src/
│   │   ├── config/           # Configurações e constantes
│   │   │   ├── constants.js  # Constantes do app
│   │   │   └── environment.js # Validação e parsing de env vars
│   │   │
│   │   ├── middleware/       # Middlewares
│   │   │   ├── auth.js       # Auth e logger
│   │   │   ├── validation.js # Validação de dados
│   │   │   └── errorHandler.js # Tratamento de erros
│   │   │
│   │   ├── services/         # Serviços de negócio
│   │   │   ├── igdbService.js    # Integração IGDB
│   │   │   ├── sheetsService.js  # Google Sheets
│   │   │   └── cacheService.js   # Cache em memória
│   │   │
│   │   ├── routes/           # Rotas da API
│   │   │   ├── games.routes.js   # CRUD de jogos
│   │   │   └── health.routes.js  # Health check
│   │   │
│   │   ├── validators/       # Validadores específicos (future)
│   │   │   └── gameValidator.js
│   │   │
│   │   └── app.js            # Configuração Express
│   │
│   ├── index.js              # Entry point
│   └── package.json
│
├── client/                    # Frontend
│   ├── src/
│   │   ├── js/               # JavaScript
│   │   │   ├── services/     # Clientes de API
│   │   │   ├── components/   # Componentes UI
│   │   │   ├── utils/        # Funções utilitárias
│   │   │   ├── app.js        # App principal
│   │   │   ├── sw.js         # Service Worker
│   │   │   ├── theme-init.js # Inicialização de tema
│   │   │   └── sw-register.js # Registro do SW
│   │   │
│   │   ├── styles/           # CSS organizado
│   │   │   └── index.css     # Estilos compilados
│   │   │
│   │   └── index.html        # HTML principal
│   │
│   └── public/               # Assets estáticos
│
├── shared/                    # Código compartilhado
│   └── types/                # Tipos/interfaces TypeScript
│
├── public/                    # Deprecated - usar client/src
├── .env                       # Variáveis de ambiente (git ignored)
├── .gitignore
├── Dockerfile
├── package.json              # Root package
├── server/package.json       # Server dependencies
└── README.md
```

## Fluxo de Dados

```
Client (browser)
    ↓
client/src/app.js (aplicação frontend)
    ↓
API Calls (fetch/axios)
    ↓
server/index.js → server/src/app.js (Express)
    ↓
Routes (server/src/routes/)
    ↓
Services (server/src/services/)
    ├→ igdbService (IGDB API)
    ├→ sheetsService (Google Sheets)
    └→ cacheService (Cache em memória)
    ↓
Response → Client
```

## Como Adicionar Novas Funcionalidades

### 1. Nova Rota de API

**Criar arquivo:** `server/src/routes/novo-recurso.routes.js`

```javascript
const express = require('express')
const { checkAuth, logger } = require('../middleware/auth')
const { validateGame } = require('../middleware/validation')

const router = express.Router()

router.get('/', checkAuth, async (req, res, next) => {
  try {
    // Lógica
    res.json({ data })
  } catch (error) {
    next(error)
  }
})

module.exports = router
```

**Importar em:** `server/src/app.js`

```javascript
const novoRecursoRoutes = require('./routes/novo-recurso.routes')
app.use('/novo-recurso', novoRecursoRoutes)
```

### 2. Novo Serviço

**Criar arquivo:** `server/src/services/novoService.js`

```javascript
const { logger } = require('../middleware/auth')

const minhaFuncao = async param => {
  try {
    logger.info('Fazendo algo', { param })
    // Lógica
    return resultado
  } catch (error) {
    logger.error('Erro ao fazer algo', { error: error.message })
    throw error
  }
}

module.exports = {
  minhaFuncao
}
```

**Usar em routes ou outros serviços:**

```javascript
const { minhaFuncao } = require('../services/novoService')
```

### 3. Novo Middleware

**Criar arquivo:** `server/src/middleware/novoMiddleware.js`

```javascript
const novoMiddleware = (req, res, next) => {
  // Lógica
  next()
}

module.exports = novoMiddleware
```

**Usar em routes:**

```javascript
const novoMiddleware = require('../middleware/novoMiddleware')
router.get('/', novoMiddleware, controlador)
```

## Desenvolvimento Local

### Setup Inicial

```bash
# Clonar repo
git clone https://github.com/rpbenevides/games-catalogy.git
cd games-catalogy

# Instalar dependências
npm run install-all

# Configurar .env
cp .env.example .env
# Editar .env com suas credenciais
```

### Executar em Desenvolvimento

```bash
npm run dev
```

Servidor rodará em `http://localhost:3000`

### Estrutura de Logs

Os logs são estruturados em JSON:

```json
{
  "level": "info",
  "message": "Jogo adicionado",
  "timestamp": "2025-11-14T23:30:00Z",
  "nome": "The Witcher 3"
}
```

Use os logs para debugar e monitorar a aplicação.

## Testes

### Manual

1. Testar GET /games
2. Testar POST /games com dados válidos
3. Testar POST /games com dados inválidos (deve rejeitar)
4. Testar PUT /games/:id
5. Testar DELETE /games/:id
6. Testar /search com query
7. Testar /health

### Automático (TODO)

```bash
npm test
```

## Deploy

### Docker

```bash
docker build -t games-catalog .
docker run -p 3000:3000 \
  --env-file .env \
  games-catalog
```

### Variáveis de Ambiente Necessárias

```env
# Google Sheets
SPREADSHEET_ID=seu_id_aqui
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}

# IGDB/Twitch
TWITCH_CLIENT_ID=seu_client_id
TWITCH_CLIENT_SECRET=seu_secret

# Server
PORT=3000
NODE_ENV=production
FRONTEND_ORIGIN=https://seu-dominio.com
```

## Troubleshooting

### Erro: "Auth Google não inicializado"

- Verificar se `GOOGLE_CREDENTIALS_JSON` está correto
- Verificar se `SPREADSHEET_ID` está correto
- Ver logs de startup

### Erro: "Muitas requisições"

- Rate limiting ativado (100 req/15 min)
- Aguardar 15 minutos ou mudar `RATE_LIMIT_MAX_REQUESTS`

### Erro: "CSP violation"

- Não adicionar `<script>` inline no HTML
- Usar arquivos de JS externos
- Configurar headers CSP em `server/src/app.js`

## Boas Práticas

1. **Sempre usar middleware de validação** para dados de entrada
2. **Logar eventos importantes** para debug
3. **Tratar erros com try/catch** e passar para `next(error)`
4. **Usar constantes** em `server/src/config/constants.js`
5. **Organizar em serviços** lógica que é reutilizada
6. **Documentar** funções e rotas complexas
7. **Fazer commits pequenos** com mensagens descritivas

## Recursos Úteis

- [Express.js Docs](https://expressjs.com)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [IGDB API](https://api-docs.igdb.com)
- [Joi Validation](https://joi.dev)
