FROM node:18-alpine
WORKDIR /app

# Copiar package.json raiz e do server
COPY package*.json ./
COPY server/package*.json ./server/

# Instalar dependências
RUN npm ci --only=production && \
    cd server && \
    npm ci --only=production

# Copiar código
COPY . .

EXPOSE 3000
USER node

CMD ["npm", "start"]