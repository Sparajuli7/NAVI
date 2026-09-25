import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin, Connect } from 'vite'
import { handleChatRequest, type ChatRequestBody } from './api/chatHandler'
import { handleGenerateAvatar } from './api/generateAvatarHandler'

/**
 * Dev-only middleware that mounts /api/chat and /api/generate-avatar
 * using the same shared handlers as the Vercel serverless functions.
 * Secrets come from .env.local via loadEnv — never VITE_*.
 */
function naviApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'navi-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || req.method !== 'POST') {
          next()
          return
        }

        const url = req.url.split('?')[0]

        if (url === '/api/chat') {
          try {
            const body = await readJsonBody(req) as ChatRequestBody
            const result = await handleChatRequest(body, env.OPENROUTER_API_KEY)

            for (const [k, v] of Object.entries(result.headers)) {
              res.setHeader(k, v)
            }
            res.statusCode = result.status

            if (result.streamBody) {
              const reader = result.streamBody.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) { res.end(); break }
                res.write(Buffer.from(value))
              }
            } else {
              res.end(result.body ?? '')
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        if (url === '/api/generate-avatar') {
          try {
            const body = await readJsonBody(req) as { prompt?: string }
            const result = await handleGenerateAvatar(body.prompt, env.BFL_API_KEY)
            res.statusCode = result.status
            res.setHeader('content-type', 'application/json')
            res.end(result.body)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        next()
      })
    },
  }
}

function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      naviApiPlugin(env),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],

    test: {
      environment: 'node',
      globals: true,
      exclude: [
        '**/node_modules/**',
        // Pre-existing manual test harness — not a Vitest suite
        '**/agent/__tests__/**',
      ],
    },
  }
})
