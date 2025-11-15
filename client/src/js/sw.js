// Service Worker para PWA - Catálogo de Jogos
const CACHE_VERSION = 'v1'
const CACHE_NAME = `jogos-catalog-${CACHE_VERSION}`
const API_CACHE_NAME = `jogos-api-${CACHE_VERSION}`

const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json'
]

// ========================
// INSTALL EVENT
// ========================
self.addEventListener('install', event => {
  console.log('Service Worker instalado')
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto')
        return cache.addAll(urlsToCache)
      })
      .catch(error => {
        console.error('Erro ao cachear recursos:', error)
      })
  )
  // Forçar o SW a ativar imediatamente
  self.skipWaiting()
})

// ========================
// ACTIVATE EVENT
// ========================
self.addEventListener('activate', event => {
  console.log('Service Worker ativado')
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Remove caches antigos
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // Tomar controle de clientes imediatamente
  self.clients.claim()
})

// ========================
// FETCH EVENT
// ========================
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    return
  }

  // Estratégia para requisições de API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cachear respostas bem-sucedidas
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Se falhar, retornar do cache
          return caches.match(request).then(cached => {
            return (
              cached ||
              new Response(
                JSON.stringify({ message: 'Offline - dados em cache' }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({ 'Content-Type': 'application/json' })
                }
              )
            )
          })
        })
    )
    return
  }

  // Estratégia padrão: Cache First, Fall Back to Network
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response
      }
      return fetch(request)
        .then(response => {
          // Não cachear respostas inválidas
          if (
            !response ||
            response.status !== 200 ||
            response.type === 'error'
          ) {
            return response
          }

          // Clonar a resposta para cachear
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Página de fallback se offline
          if (request.destination === 'document') {
            return caches.match('/index.html')
          }
          return new Response('Recurso não disponível offline', {
            status: 503,
            statusText: 'Service Unavailable'
          })
        })
    })
  )
})

// ========================
// MESSAGE EVENT (para comunicação com o app)
// ========================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
