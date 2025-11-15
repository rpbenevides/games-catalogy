// Aplicar tema salvo antes do render para evitar "flash"
;(function () {
  const savedTheme = localStorage.getItem('theme') || 'dark'
  const html = document.documentElement
  html.setAttribute('data-theme', savedTheme)
  if (savedTheme === 'light') {
    html.classList.add('light')
    html.classList.remove('dark')
  } else {
    html.classList.add('dark')
    html.classList.remove('light')
  }
})()
