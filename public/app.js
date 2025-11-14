document.addEventListener('DOMContentLoaded', () => {
  // ----------------- Seletores de DOM -----------------
  const elements = {
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    searchResults: document.getElementById('search-results'),
    tableBody: document.getElementById('games-table-body'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    messageContainer: document.getElementById('message-container'),
    themeToggle: document.getElementById('theme-toggle'),
    searchStatusElement: document.getElementById('search-status'),
    gameForm: document.getElementById('game-form'),
    gameFormElement: document.getElementById('game-form-element'),
    cancelFormBtn: document.getElementById('cancel-form'),
    deleteGameBtn: document.getElementById('delete-game'),
    exportButton: document.getElementById('export-button'),
    localSearchInput: document.getElementById('local-search'),
    filterStatus: document.getElementById('filter-status'),
    filterPlatform: document.getElementById('filter-platform'),
    confirmationModal: document.getElementById('confirmation-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalCancel: document.getElementById('modal-cancel'),
    modalConfirm: document.getElementById('modal-confirm'),
    loadingOverlay: document.getElementById('loading-overlay'),
    skeletonLoader: document.getElementById('skeleton-loader')
  }

  // ----------------- Estado da Aplicação -----------------
  const searchCache = new Map()
  const API_BASE_URL = ''
  const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000
  }

  class AppState {
    constructor() {
      this.state = {
        games: [],
        filteredGames: [],
        currentPage: 1,
        rowsPerPage: 10,
        sortColumn: 'inicio',
        sortAsc: false,
        isLoading: false,
        currentFilters: {
          search: '',
          status: '',
          platform: ''
        },
        editingGameId: null
      }

      this.listeners = new Set()
    }

    getState() {
      return { ...this.state }
    }

    setState(newState) {
      const oldState = { ...this.state }
      this.state = { ...this.state, ...newState }
      this.notifyListeners(oldState, this.state)
    }

    subscribe(listener) {
      this.listeners.add(listener)
      return () => this.listeners.delete(listener)
    }

    notifyListeners(oldState, newState) {
      this.listeners.forEach(listener => listener(oldState, newState))
    }
  }

  const appState = new AppState()

  // ----------------- Utilitários -----------------
  const utils = {
    debounce: (func, wait, immediate = false) => {
      let timeout
      return function executedFunction(...args) {
        const later = () => {
          timeout = null
          if (!immediate) func(...args)
        }
        const callNow = immediate && !timeout
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
        if (callNow) func(...args)
      }
    },

    // Converte timestamp Unix (segundos) para formato ISO (YYYY-MM-DD)
    unixTimestampToISO: timestamp => {
      if (!timestamp) return ''
      try {
        const date = new Date(timestamp * 1000)
        return date.toISOString().split('T')[0]
      } catch {
        return ''
      }
    },

    formatDate: dateString => {
      if (!dateString) return '-'
      try {
        return new Date(dateString).toLocaleDateString('pt-BR')
      } catch {
        return dateString
      }
    },

    formatPlaytime: timeString => {
      if (!timeString) return '-'
      const totalMinutes = utils.parsePlaytimeToMinutes(timeString)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60

      if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
      if (hours > 0) return `${hours}h`
      if (minutes > 0) return `${minutes}min`
      return '-'
    },

    parsePlaytimeToMinutes: timeString => {
      if (!timeString) return 0
      let totalMinutes = 0
      const hoursMatch = timeString.match(/(\d+)h/i)
      const minutesMatch = timeString.match(/(\d+)m/i)

      if (hoursMatch) totalMinutes += parseInt(hoursMatch[1], 10) * 60
      if (minutesMatch) totalMinutes += parseInt(minutesMatch[1], 10)

      return totalMinutes
    },

    sanitizeInput: input => {
      if (typeof input !== 'string') return input
      return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    }
  }

  // ----------------- Validação -----------------
  const validators = {
    gameData: data => {
      const errors = []

      if (!data.nome?.trim()) errors.push('O nome é obrigatório.')
      if (data.nota && (data.nota < 0 || data.nota > 10))
        errors.push('A nota deve estar entre 0 e 10.')
      if (
        data.dataLancamento &&
        isNaN(new Date(data.dataLancamento).getTime())
      ) {
        errors.push('A data de lançamento é inválida.')
      }
      if (data.tempo && !validators.playtime(data.tempo)) {
        errors.push(
          'O tempo de jogo deve estar em um formato como "10h", "90m" ou "1h 30m".'
        )
      }

      return errors
    },

    playtime: timeString => {
      if (!timeString || !timeString.trim()) return true
      const playtimeRegex = /^(\d+h)?\s*(\d+m?(?![a-z]))?$/i
      return (
        playtimeRegex.test(timeString) &&
        (timeString.includes('h') || timeString.includes('m'))
      )
    },

    parsePlaytime: timeString => {
      if (!timeString || !timeString.trim()) return ''
      return timeString.replace(/\s+/g, '').toLowerCase()
    }
  }

  // ----------------- Feedback ao Usuário -----------------
  const uiFeedback = {
    showMessage: (message, type = 'info', duration = 4000) => {
      const messageId = `msg-${Date.now()}`
      const div = document.createElement('div')
      const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
      }

      div.id = messageId
      div.className = `p-4 rounded-lg text-white ${
        colors[type] || colors.info
      } shadow-lg mb-2 fade-in transform transition-all duration-300`
      div.innerHTML = `
        <div class="flex items-center justify-between">
          <span>${message}</span>
          <button class="ml-4 text-white hover:text-gray-200 transition-colors message-close-btn"
                  aria-label="Fechar mensagem">
            ×
          </button>
        </div>
      `

      elements.messageContainer.appendChild(div)

      // Add event listener to close button
      setTimeout(() => {
        const closeBtn = div.querySelector('.message-close-btn')
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            div.style.opacity = '0'
            setTimeout(() => div.remove(), 300)
          })
        }
      }, 100)

      if (duration > 0) {
        setTimeout(() => {
          const messageElement = document.getElementById(messageId)
          if (messageElement) {
            messageElement.style.opacity = '0'
            setTimeout(() => messageElement.remove(), 300)
          }
        }, duration)
      }
    },

    updateSearchStatus: (message, isError = false) => {
      if (elements.searchStatusElement) {
        elements.searchStatusElement.textContent = message
        elements.searchStatusElement.className = `text-sm ${
          isError ? 'text-red-500' : 'text-gray-500'
        } transition-colors`
        elements.searchStatusElement.classList.remove('hidden')

        if (!isError) {
          setTimeout(
            () => elements.searchStatusElement.classList.add('hidden'),
            3000
          )
        }
      }
    },

    showLoading: (show = true, message = 'Carregando...') => {
      if (elements.loadingOverlay) {
        if (show) {
          elements.loadingOverlay.classList.remove('hidden')
          elements.loadingOverlay.querySelector('span').textContent = message
        } else {
          elements.loadingOverlay.classList.add('hidden')
        }
      }
    },

    showSkeletonTable: (show = true) => {
      if (elements.skeletonLoader) {
        elements.skeletonLoader.classList.toggle('hidden', !show)
      }
      elements.tableBody.classList.toggle('hidden', show)
    }
  }

  // ----------------- Modal Management -----------------
  const modalManager = {
    currentResolve: null,

    show: (title, message) => {
      return new Promise(resolve => {
        modalManager.currentResolve = resolve

        elements.modalTitle.textContent = title
        elements.modalMessage.textContent = message
        elements.confirmationModal.classList.remove('hidden')

        elements.modalConfirm.focus()
      })
    },

    hide: () => {
      elements.confirmationModal.classList.add('hidden')
      modalManager.currentResolve = null
    },

    confirm: () => {
      if (modalManager.currentResolve) {
        modalManager.currentResolve(true)
        modalManager.hide()
      }
    },

    cancel: () => {
      if (modalManager.currentResolve) {
        modalManager.currentResolve(false)
        modalManager.hide()
      }
    }
  }

  // ----------------- API Client -----------------
  const apiClient = {
    request: async (url, options = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        const response = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          let errorMessage = `Erro ${response.status}`
          try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.error || errorMessage
          } catch {
            const errorText = await response.text()
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }

        // Se a resposta for vazia (status 204 ou sem conteúdo)
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          return await response.json()
        }
        return null
      } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          throw new Error('Tempo de requisição excedido. Tente novamente.')
        }
        throw error
      }
    },

    withRetry: async (fn, retryConfig = RETRY_CONFIG) => {
      let lastError

      for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
        try {
          return await fn()
        } catch (error) {
          lastError = error

          if (attempt === retryConfig.maxRetries) break

          const delay = Math.min(
            retryConfig.baseDelay * Math.pow(2, attempt - 1),
            retryConfig.maxDelay
          )

          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError
    }
  }

  // ----------------- Lógica de Busca (API) -----------------
  const searchService = {
    execute: async query => {
      return apiClient.withRetry(async () => {
        uiFeedback.updateSearchStatus(`Buscando "${query}"...`)

        const results = await apiClient.request(
          `/games/search?name=${encodeURIComponent(query)}`
        )

        uiFeedback.updateSearchStatus('Busca concluída!')
        return results
      })
    },

    withCache: async query => {
      const cacheKey = query.toLowerCase().trim()

      if (searchCache.has(cacheKey)) {
        uiFeedback.updateSearchStatus('Resultados do cache')
        return searchCache.get(cacheKey)
      }

      const results = await searchService.execute(query)
      searchCache.set(cacheKey, results)

      setTimeout(() => searchCache.delete(cacheKey), 5 * 60 * 1000)
      return results
    }
  }

  // ----------------- Lógica da Planilha (API) -----------------
  const spreadsheetService = {
    fetchGames: async () => {
      return apiClient.withRetry(async () => {
        uiFeedback.showSkeletonTable(true)
        appState.setState({ isLoading: true })

        const games = await apiClient.request('/games')

        appState.setState({
          games,
          isLoading: false
        })

        uiFeedback.showSkeletonTable(false)
        return games
      })
    },

    saveGame: async (gameData, isEditing = false) => {
      return apiClient.withRetry(async () => {
        const url = isEditing ? `/games/${gameData.id}` : '/games'
        const method = isEditing ? 'PUT' : 'POST'

        const response = await apiClient.request(url, {
          method,
          body: JSON.stringify(gameData)
        })

        uiFeedback.showMessage(
          `Jogo ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`,
          'success'
        )

        return response
      })
    },

    deleteGame: async gameId => {
      return apiClient.withRetry(async () => {
        await apiClient.request(`/games/${gameId}`, {
          method: 'DELETE'
        })

        uiFeedback.showMessage('Jogo excluído com sucesso!', 'success')
      })
    },

    exportGames: async () => {
      try {
        uiFeedback.showLoading(true, 'Exportando dados...')

        const response = await fetch(`${API_BASE_URL}/games/export`)

        if (!response.ok) {
          throw new Error('Falha ao exportar dados')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')

        a.href = url
        a.download = `meus-jogos-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()

        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        uiFeedback.showMessage('Dados exportados com sucesso!', 'success')
      } catch (error) {
        throw error
      } finally {
        uiFeedback.showLoading(false)
      }
    }
  }

  // ----------------- Renderização -----------------
  const renderers = {
    searchResults: results => {
      elements.searchResults.innerHTML = ''

      if (results.length === 0) {
        elements.searchResults.innerHTML = `
          <li class="p-4 text-gray-500 text-center">
            Nenhum jogo encontrado. Tente outros termos de busca.
          </li>
        `
        return
      }

      const fragment = document.createDocumentFragment()

      results.forEach(game => {
        const releaseYear = game.first_release_date
          ? new Date(game.first_release_date * 1000).getFullYear()
          : '?'

        const li = document.createElement('li')
        li.className = 'search-result-item'
        li.setAttribute('role', 'option')
        li.setAttribute('tabindex', '0')
        li.innerHTML = `
          <div class="flex justify-between items-center">
            <div>
              <div class="font-semibold">${utils.sanitizeInput(game.name)}</div>
              <div class="text-sm search-result-subtitle">
                ${releaseYear} • ${
          game.platforms?.map(p => p.name).join(', ') ||
          'Plataforma desconhecida'
        }
              </div>
            </div>
            <span class="text-2xl">→</span>
          </div>
        `

        li.addEventListener('click', () => renderers.showForm(game))
        li.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            renderers.showForm(game)
          }
        })

        fragment.appendChild(li)
      })

      elements.searchResults.appendChild(fragment)
    },

    table: state => {
      const { filteredGames, currentPage, rowsPerPage, sortColumn, sortAsc } =
        state

      let sortedData = [...filteredGames].sort((a, b) => {
        let valA = a[sortColumn] || ''
        let valB = b[sortColumn] || ''

        if (['dataLancamento', 'inicio', 'fim'].includes(sortColumn)) {
          valA = valA ? new Date(valA).getTime() : 0
          valB = valB ? new Date(valB).getTime() : 0
        }

        if (sortColumn === 'tempo') {
          valA = utils.parsePlaytimeToMinutes(valA)
          valB = utils.parsePlaytimeToMinutes(valB)
        }

        if (valA < valB) return sortAsc ? -1 : 1
        if (valA > valB) return sortAsc ? 1 : -1
        return 0
      })

      const startIndex = (currentPage - 1) * rowsPerPage
      const pageData = sortedData.slice(startIndex, startIndex + rowsPerPage)
      const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage))

      // Render table
      elements.tableBody.innerHTML = ''

      if (pageData.length === 0) {
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="10" class="p-8 text-center text-gray-500">
              ${
                state.currentFilters.search ||
                state.currentFilters.status ||
                state.currentFilters.platform
                  ? 'Nenhum jogo encontrado com os filtros aplicados.'
                  : 'Nenhum jogo cadastrado. Adicione seu primeiro jogo!'
              }
            </td>
          </tr>
        `
      } else {
        const fragment = document.createDocumentFragment()

        pageData.forEach(game => {
          const tr = document.createElement('tr')
          tr.className =
            'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 fade-in transition-colors'

          const columns = [
            { key: 'plataforma', value: game.plataforma || '-' },
            { key: 'nome', value: utils.sanitizeInput(game.nome) || '-' },
            {
              key: 'dataLancamento',
              value: utils.formatDate(game.dataLancamento)
            },
            { key: 'genero', value: utils.sanitizeInput(game.genero) || '-' },
            { key: 'status', value: game.status || '-' },
            { key: 'tempo', value: utils.formatPlaytime(game.tempo) },
            { key: 'inicio', value: utils.formatDate(game.inicio) },
            { key: 'fim', value: utils.formatDate(game.fim) },
            { key: 'nota', value: game.nota || '-' }
          ]

          columns.forEach(({ key, value }) => {
            const td = document.createElement('td')
            td.className = 'p-3 text-sm'
            td.textContent = value
            tr.appendChild(td)
          })

          // Actions column
          const actionsTd = document.createElement('td')
          actionsTd.className = 'p-3'
          actionsTd.innerHTML = `
            <div class="flex gap-2">
              <button class="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors edit-btn"
                      title="Editar jogo" data-game-id="${game.id}">
                ✏️
              </button>
              <button class="p-1 hover:text-red-600 dark:hover:text-red-400 transition-colors delete-btn"
                      title="Excluir jogo" data-game-id="${
                        game.id
                      }" data-game-name="${utils.sanitizeInput(game.nome)}">
                🗑️
              </button>
            </div>
          `

          tr.appendChild(actionsTd)
          fragment.appendChild(tr)
        })

        elements.tableBody.appendChild(fragment)
      }

      // Update pagination
      elements.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`
      elements.prevPageBtn.disabled = currentPage === 1
      elements.nextPageBtn.disabled = currentPage >= totalPages

      // Update sort indicators
      renderers.updateSortIndicators(sortColumn, sortAsc)
    },

    updateSortIndicators: (sortColumn, sortAsc) => {
      document.querySelectorAll('th[data-sort]').forEach(th => {
        const column = th.getAttribute('data-sort')
        th.classList.remove('bg-gray-300', 'dark:bg-gray-600')
        th.querySelector('.sort-indicator')?.remove()

        if (column === sortColumn) {
          th.classList.add('bg-gray-300', 'dark:bg-gray-600')
          const indicator = document.createElement('span')
          indicator.className = 'sort-indicator ml-1'
          indicator.textContent = sortAsc ? '↑' : '↓'
          th.appendChild(indicator)
        }
      })
    },

    showForm: (game = null, isEditing = false) => {
      elements.gameForm.classList.remove('hidden')
      elements.searchResults.innerHTML = ''
      elements.searchInput.value = ''

      elements.gameForm.querySelector('#form-title').textContent = isEditing
        ? 'Editar Jogo'
        : 'Adicionar Jogo'

      elements.deleteGameBtn.classList.toggle('hidden', !isEditing)

      // Fill form data
      const formData = {
        id: game?.id || '',
        nome: game?.name || game?.nome || '',
        dataLancamento: game?.first_release_date
          ? utils.unixTimestampToISO(game.first_release_date)
          : game?.dataLancamento || '',
        genero: game?.genres?.map(g => g.name).join(', ') || game?.genero || '',
        status: game?.status || 'Não iniciado',
        tempo: game?.tempo || '',
        inicio: game?.inicio || '',
        fim: game?.fim || '',
        nota: game?.nota || ''
      }

      Object.keys(formData).forEach(key => {
        const element = elements.gameForm.querySelector(`#form-${key}`)
        if (element) element.value = formData[key]
      })

      // Update platforms dropdown
      renderers.updatePlatformsDropdown(game?.platforms, game?.plataforma)

      appState.setState({ editingGameId: isEditing ? game.id : null })
      elements.gameForm.querySelector('#form-plataforma').focus()
    },

    updatePlatformsDropdown: (platforms, currentPlatform) => {
      const select = elements.gameForm.querySelector('#form-plataforma')
      const currentGames = appState.getState().games
      const uniquePlatforms = [
        ...new Set(currentGames.map(g => g.plataforma).filter(Boolean))
      ]

      select.innerHTML = ''

      // Add platforms from IGDB search
      if (platforms?.length > 0) {
        platforms.forEach(platform => {
          const option = document.createElement('option')
          option.value = platform.name
          option.textContent = platform.name
          select.appendChild(option)
        })
      }

      // Add platforms from existing games
      uniquePlatforms.forEach(platform => {
        if (!select.querySelector(`option[value="${platform}"]`)) {
          const option = document.createElement('option')
          option.value = platform
          option.textContent = platform
          select.appendChild(option)
        }
      })

      // Add "Other" option
      if (!select.querySelector('option[value="Outro"]')) {
        const option = document.createElement('option')
        option.value = 'Outro'
        option.textContent = 'Outro'
        select.appendChild(option)
      }

      // Set current value
      if (currentPlatform) {
        select.value = currentPlatform
      }
    }
  }

  // ----------------- Handlers -----------------
  const handlers = {
    search: utils.debounce(async query => {
      const trimmedQuery = query.trim()

      if (trimmedQuery.length < 2) {
        elements.searchResults.innerHTML = ''
        return
      }

      if (trimmedQuery.length === 0) {
        elements.searchResults.innerHTML = ''
        return
      }

      try {
        elements.searchResults.innerHTML = `
          <li class="p-4 text-gray-500 text-center">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Buscando "${trimmedQuery}"...
          </li>
        `

        const results = await searchService.withCache(trimmedQuery)
        renderers.searchResults(results)
      } catch (error) {
        uiFeedback.showMessage(`Erro na busca: ${error.message}`, 'error')
        elements.searchResults.innerHTML = `
          <li class="p-4 text-red-500 text-center">
            Erro ao buscar jogos. Tente novamente.
          </li>
        `
      }
    }, 300),

    filterGames: utils.debounce(filters => {
      appState.setState({ currentFilters: filters })
    }, 250),

    changePage: direction => {
      const { currentPage, filteredGames, rowsPerPage } = appState.getState()
      const totalPages = Math.ceil(filteredGames.length / rowsPerPage)

      let newPage = currentPage

      if (direction === 'prev' && currentPage > 1) {
        newPage = currentPage - 1
      } else if (direction === 'next' && currentPage < totalPages) {
        newPage = currentPage + 1
      }

      if (newPage !== currentPage) {
        appState.setState({ currentPage: newPage })
      }
    },

    sortGames: column => {
      const { sortColumn, sortAsc } = appState.getState()
      const newSortAsc = column === sortColumn ? !sortAsc : true

      appState.setState({
        sortColumn: column,
        sortAsc: newSortAsc,
        currentPage: 1
      })
    },

    submitForm: async e => {
      e.preventDefault()

      const formData = new FormData(elements.gameFormElement)
      const payload = {
        plataforma: formData.get('plataforma'),
        nome: formData.get('nome'),
        dataLancamento: formData.get('dataLancamento'),
        genero: formData.get('genero'),
        status: formData.get('status'),
        tempo: validators.parsePlaytime(formData.get('tempo')),
        inicio: formData.get('inicio'),
        fim: formData.get('fim'),
        nota: formData.get('nota') ? parseFloat(formData.get('nota')) : ''
      }

      // Sanitize inputs
      Object.keys(payload).forEach(key => {
        if (typeof payload[key] === 'string') {
          payload[key] = utils.sanitizeInput(payload[key])
        }
      })

      // Validate
      const errors = validators.gameData(payload)
      if (errors.length > 0) {
        errors.forEach(error => uiFeedback.showMessage(error, 'error'))
        return
      }

      try {
        uiFeedback.showLoading(true, 'Salvando jogo...')

        const { editingGameId } = appState.getState()

        if (editingGameId) {
          payload.id = editingGameId
          await spreadsheetService.saveGame(payload, true)
        } else {
          await spreadsheetService.saveGame(payload, false)
        }

        elements.gameForm.classList.add('hidden')
        appState.setState({ editingGameId: null })

        // Refresh games list
        await spreadsheetService.fetchGames()
      } catch (error) {
        uiFeedback.showMessage(
          `Erro ao ${
            appState.getState().editingGameId ? 'atualizar' : 'adicionar'
          } jogo: ${error.message}`,
          'error'
        )
      } finally {
        uiFeedback.showLoading(false)
      }
    },

    editGame: gameId => {
      const { games } = appState.getState()
      const game = games.find(g => g.id === gameId)

      if (game) {
        renderers.showForm(game, true)
      } else {
        uiFeedback.showMessage('Jogo não encontrado', 'error')
      }
    },

    deleteGame: async (gameId, gameName) => {
      try {
        const confirmed = await modalManager.show(
          'Confirmar exclusão',
          `Tem certeza que deseja excluir "${utils.sanitizeInput(
            gameName
          )}"? Esta ação não pode ser desfeita.`
        )

        if (confirmed) {
          uiFeedback.showLoading(true, 'Excluindo jogo...')
          await spreadsheetService.deleteGame(gameId)

          // Fechar o formulário
          elements.gameForm.classList.add('hidden')
          appState.setState({ editingGameId: null })

          // Recarregar jogos
          await spreadsheetService.fetchGames()

          uiFeedback.showMessage('Jogo excluído com sucesso!', 'success')
        }
      } catch (error) {
        uiFeedback.showMessage(
          `Erro ao excluir jogo: ${error.message}`,
          'error'
        )
      } finally {
        uiFeedback.showLoading(false)
      }
    },

    exportGames: async () => {
      try {
        await spreadsheetService.exportGames()
      } catch (error) {
        uiFeedback.showMessage(`Erro ao exportar: ${error.message}`, 'error')
      }
    },

    toggleTheme: () => {
      const html = document.documentElement
      const isDark = html.classList.contains('dark')
      const newTheme = isDark ? 'light' : 'dark'

      // Remover ambas as classes e adicionar a nova
      html.classList.remove('dark', 'light')
      html.classList.add(newTheme)

      // Atualizar atributo data-theme
      html.setAttribute('data-theme', newTheme)

      // Atualizar colorScheme
      html.style.colorScheme = newTheme

      // Atualizar emoji do botão
      elements.themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️'
      elements.themeToggle.setAttribute(
        'aria-label',
        `Mudar para tema ${newTheme === 'dark' ? 'claro' : 'escuro'}`
      )

      // Persistir no localStorage
      localStorage.setItem('theme', newTheme)

      // Log para debug
      console.log(`Tema alterado para: ${newTheme}`, {
        isDark,
        hasLight: html.classList.contains('light'),
        hasDark: html.classList.contains('dark'),
        dataTheme: html.getAttribute('data-theme')
      })
    }
  }

  // ----------------- Event Listeners -----------------
  const setupEventListeners = () => {
    // Search
    elements.searchInput.addEventListener('input', e =>
      handlers.search(e.target.value)
    )
    elements.searchButton.addEventListener('click', () =>
      handlers.search(elements.searchInput.value)
    )
    elements.searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        elements.searchResults.innerHTML = ''
        elements.searchInput.value = ''
      }
    })

    // Filters
    elements.localSearchInput.addEventListener('input', e => {
      handlers.filterGames({
        ...appState.getState().currentFilters,
        search: e.target.value
      })
    })

    elements.filterStatus.addEventListener('change', e => {
      handlers.filterGames({
        ...appState.getState().currentFilters,
        status: e.target.value
      })
    })

    elements.filterPlatform.addEventListener('change', e => {
      handlers.filterGames({
        ...appState.getState().currentFilters,
        platform: e.target.value
      })
    })

    // Pagination
    elements.prevPageBtn.addEventListener('click', () =>
      handlers.changePage('prev')
    )
    elements.nextPageBtn.addEventListener('click', () =>
      handlers.changePage('next')
    )

    // Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () =>
        handlers.sortGames(th.getAttribute('data-sort'))
      )
    })

    // Form
    elements.cancelFormBtn.addEventListener('click', () => {
      elements.gameForm.classList.add('hidden')
      appState.setState({ editingGameId: null })
    })

    elements.gameFormElement.addEventListener('submit', handlers.submitForm)

    // Delete button (na seção de edição)
    elements.deleteGameBtn.addEventListener('click', () => {
      const editingGameId = appState.getState().editingGameId
      const games = appState.getState().games
      const game = games.find(g => g.id === editingGameId)

      if (game) {
        handlers.deleteGame(editingGameId, game.nome)
      }
    })

    // Modal
    elements.modalConfirm.addEventListener('click', modalManager.confirm)
    elements.modalCancel.addEventListener('click', modalManager.cancel)

    // Theme
    elements.themeToggle.addEventListener('click', handlers.toggleTheme)

    // Export
    elements.exportButton.addEventListener('click', handlers.exportGames)

    // Event delegation for action buttons
    document.addEventListener('click', e => {
      const editBtn = e.target.closest('.edit-btn')
      const deleteBtn = e.target.closest('.delete-btn')

      if (editBtn) {
        const gameId = editBtn.dataset.gameId
        handlers.editGame(gameId)
      }

      if (deleteBtn) {
        const gameId = deleteBtn.dataset.gameId
        const gameName = deleteBtn.dataset.gameName
        handlers.deleteGame(gameId, gameName)
      }
    })

    // Global error handling
    window.addEventListener('error', event => {
      console.error('Erro não tratado:', event.error)
      uiFeedback.showMessage(
        'Ocorreu um erro inesperado. Verifique o console.',
        'error'
      )
    })

    window.addEventListener('unhandledrejection', event => {
      console.error('Promise rejeitada:', event.reason)
      uiFeedback.showMessage(
        'Erro de conexão ou de servidor. Verifique sua internet.',
        'error'
      )
    })

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!elements.confirmationModal.classList.contains('hidden')) {
          modalManager.cancel()
        } else if (!elements.gameForm.classList.contains('hidden')) {
          elements.gameForm.classList.add('hidden')
          appState.setState({ editingGameId: null })
        }
      }
    })
  }

  // ----------------- Inicialização -----------------
  const init = async () => {
    // Set initial theme
    const savedTheme = localStorage.getItem('theme') || 'dark'
    const isDark = savedTheme === 'dark'

    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = savedTheme
    elements.themeToggle.textContent = isDark ? '☀️' : '🌙'
    elements.themeToggle.setAttribute(
      'aria-label',
      `Mudar para tema ${isDark ? 'claro' : 'escuro'}`
    )

    // Setup accessibility
    elements.searchInput.setAttribute('aria-label', 'Buscar jogos na base IGDB')
    elements.searchButton.setAttribute('aria-label', 'Executar busca')
    elements.searchResults.setAttribute('aria-label', 'Resultados da busca')

    // Setup event listeners
    setupEventListeners()

    // Subscribe to state changes
    appState.subscribe((oldState, newState) => {
      if (
        oldState.games !== newState.games ||
        oldState.currentFilters !== newState.currentFilters
      ) {
        const { games, currentFilters } = newState

        // Apply filters
        const filteredGames = games.filter(game => {
          const matchesSearch =
            !currentFilters.search ||
            Object.values(game).some(
              value =>
                value &&
                value
                  .toString()
                  .toLowerCase()
                  .includes(currentFilters.search.toLowerCase())
            )

          const matchesStatus =
            !currentFilters.status || game.status === currentFilters.status
          const matchesPlatform =
            !currentFilters.platform ||
            game.plataforma === currentFilters.platform

          return matchesSearch && matchesStatus && matchesPlatform
        })

        appState.setState({ filteredGames })
      }

      if (
        oldState.filteredGames !== newState.filteredGames ||
        oldState.currentPage !== newState.currentPage ||
        oldState.sortColumn !== newState.sortColumn ||
        oldState.sortAsc !== newState.sortAsc
      ) {
        renderers.table(newState)
      }

      if (oldState.isLoading !== newState.isLoading) {
        uiFeedback.showLoading(newState.isLoading)
      }
    })

    // Load initial data
    try {
      await spreadsheetService.fetchGames()
    } catch (error) {
      uiFeedback.showMessage(
        'Erro ao carregar jogos. Verifique a conexão.',
        'error'
      )
    }
  }

  // Initialize the application
  init()
})
