import { defineConfig, type Plugin } from 'vite'

/**
 * Для превью ссылки (og:image) нужен абсолютный адрес сайта.
 * Берём его из SITE_URL, а на Netlify — из встроенной переменной URL (основной домен сайта).
 * В режиме разработки адрес не нужен, поэтому там остаётся пустым.
 */
function siteUrl(): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml(html) {
      const url = (process.env.SITE_URL || process.env.URL || '').replace(/\/+$/, '')
      return html.replaceAll('%SITE_URL%', url)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [siteUrl()],
  server: {
    host: true,
  },
})
