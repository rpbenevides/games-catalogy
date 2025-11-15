# Games Catalog

Catálogo de jogos com integração IGDB e Google Sheets.

## Estrutura do Projeto

```
├── server/              # Backend Express
│   ├── src/
│   │   ├── config/      # Configurações e constantes
│   │   ├── middleware/  # Middlewares (auth, validation, error handling)
│   │   ├── services/    # Serviços (IGDB, Google Sheets, Cache)
│   │   ├── routes/      # Rotas da API
│   │   └── app.js       # Configuração Express
│   ├── index.js         # Entry point do servidor
│   └── package.json
│
├── client/              # Frontend
│   ├── src/
│   │   ├── js/          # JavaScript
│   │   │   ├── services/    # Clientes de API
│   │   │   ├── components/  # Componentes reutilizáveis
│   │   │   ├── utils/       # Funções utilitárias
│   │   │   └── app.js       # App principal
│   │   ├── styles/      # CSS
│   │   │   ├── base.css
│   │   │   ├── components.css
│   │   │   └── index.css (gerado)
│   │   └── index.html
│   └── public/          # Assets estáticos
│
├── shared/              # Código compartilhado
│   └── types/           # Tipos/interfaces
│
├── public/              # Arquivos originais (deprecated)
├── .env                 # Variáveis de ambiente
├── .gitignore
├── Dockerfile
└── README.md
```

## Setup

### 1. Instalar dependências do servidor
```bash
cd server
npm install
```

### 2. Configurar variáveis de ambiente
Criar arquivo `.env` na raiz do projeto:

```env
PORT=3000
NODE_ENV=development
SPREADSHEET_ID=seu_id_aqui
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
TWITCH_CLIENT_ID=seu_id
TWITCH_CLIENT_SECRET=seu_secret
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. Executar o servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## API Endpoints

### Jogos
- `GET /games` - Listar todos os jogos
- `POST /games` - Criar novo jogo
- `PUT /games/:id` - Atualizar jogo
- `DELETE /games/:id` - Deletar jogo
- `GET /games/export` - Exportar como CSV

### Busca IGDB
- `GET /search?name=query` - Buscar jogos na IGDB

### Health Check
- `GET /health` - Status da aplicação

## Desenvolvimento

### Adicionar nova rota
1. Criar arquivo em `server/src/routes/`
2. Importar em `server/src/app.js`
3. Adicionar middleware necessário

### Adicionar novo serviço
1. Criar arquivo em `server/src/services/`
2. Importar onde necessário
3. Usar em rotas ou outros serviços

### Adicionar middleware
1. Criar arquivo em `server/src/middleware/`
2. Importar em `server/src/app.js`
3. Aplicar com `app.use()`

## Deployment

### Docker
```bash
docker build -t games-catalog .
docker run -p 3000:3000 --env-file .env games-catalog
```

### Variáveis de Ambiente Necessárias
- `SPREADSHEET_ID` - ID da planilha Google
- `GOOGLE_CREDENTIALS_JSON` - JSON com credenciais Google
- `TWITCH_CLIENT_ID` - Client ID da Twitch/IGDB
- `TWITCH_CLIENT_SECRET` - Client Secret da Twitch/IGDB
