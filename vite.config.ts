import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { shouldUseCurlFallback, streamWithCurl } from './curl-fallback'
import { formatProxyErrorMessage } from './proxy-error'
import { getProxyDispatcher, getProxyLabel } from './proxy-utils'
import { buildUpstreamRequest } from './upstream-config'

interface ProxyRequestBody {
  apiKey?: string
  baseUrl?: string
  model?: string
  stream?: boolean
  messages?: unknown
  input?: unknown
}

function createResponsesProxyPlugin(): Plugin {
  const proxyDispatcher = getProxyDispatcher(process.env)
  const proxyLabel = getProxyLabel(process.env)

  return {
    name: 'local-responses-proxy',
    configureServer(server) {
      server.middlewares.use('/api/responses', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ message: 'Method Not Allowed' }))
          return
        }

        let upstreamRequest: ReturnType<typeof buildUpstreamRequest> | undefined

        try {
          const body = await readJsonBody<ProxyRequestBody>(req)
          const apiKey = body.apiKey?.trim() ?? ''
          const baseUrl = body.baseUrl?.trim() ?? ''
          const model = body.model?.trim() ?? ''
          const stream = Boolean(body.stream)
          const messages = Array.isArray(body.messages)
            ? body.messages
            : Array.isArray(body.input)
              ? body.input
              : []

          if (!apiKey || !baseUrl || !model) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                message: '缺少代理请求所需的 API 配置。',
              }),
            )
            return
          }

          upstreamRequest = buildUpstreamRequest({
            baseUrl,
            model,
            stream,
            messages,
          })

          let upstreamResponse: Response

          try {
            upstreamResponse = await fetch(upstreamRequest.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              dispatcher: proxyDispatcher as unknown as never,
              body: JSON.stringify(upstreamRequest.body),
            })
          } catch (error) {
            if (shouldUseCurlFallback(error)) {
              await streamWithCurl({
                url: upstreamRequest.url,
                apiKey,
                body: upstreamRequest.body,
                res,
              })
              return
            }

            throw error
          }

          res.statusCode = upstreamResponse.status
          res.setHeader(
            'Content-Type',
            upstreamResponse.headers.get('Content-Type') ??
              'application/json; charset=utf-8',
          )

          if (!upstreamResponse.body) {
            const text = await upstreamResponse.text()
            res.end(text)
            return
          }

          const reader = upstreamResponse.body.getReader()

          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              break
            }

            res.write(Buffer.from(value))
          }

          res.end()
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              message: formatProxyErrorMessage(error, {
                upstreamUrl:
                  typeof upstreamRequest !== 'undefined'
                    ? upstreamRequest.url
                    : undefined,
                proxyLabel,
              }),
            }),
          )
        }
      })
    },
  }
}

function readJsonBody<T>(req: NodeJS.ReadableStream) {
  return new Promise<T>((resolve, reject) => {
    let raw = ''

    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve((raw ? JSON.parse(raw) : {}) as T)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export default defineConfig({
  plugins: [createResponsesProxyPlugin(), react(), tailwindcss()],
})
