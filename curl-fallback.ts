import { spawn } from 'node:child_process'
import type { ServerResponse } from 'node:http'

interface CurlFallbackOptions {
  url: string
  apiKey: string
  body: unknown
}

interface ParsedHeaderBlock {
  statusCode: number
  headers: Record<string, string>
}

function findHeaderBoundary(buffer: Buffer) {
  const crlfIndex = buffer.indexOf('\r\n\r\n')

  if (crlfIndex >= 0) {
    return {
      index: crlfIndex,
      length: 4,
    }
  }

  const lfIndex = buffer.indexOf('\n\n')

  if (lfIndex >= 0) {
    return {
      index: lfIndex,
      length: 2,
    }
  }

  return null
}

export function shouldUseCurlFallback(error: unknown) {
  if (
    error instanceof TypeError &&
    (error.message === 'fetch failed' || error.message === 'Failed to fetch')
  ) {
    return true
  }

  const cause =
    error instanceof Error
      ? ((error as Error & { cause?: { code?: string } }).cause ?? null)
      : null

  return (
    cause?.code === 'ENOTFOUND' ||
    cause?.code === 'ECONNREFUSED' ||
    cause?.code === 'EPERM' ||
    cause?.code === 'ECONNRESET' ||
    cause?.code === 'EAI_AGAIN'
  )
}

export function buildCurlArgs({ url, apiKey, body }: CurlFallbackOptions) {
  return [
    '-sS',
    '-N',
    '-D',
    '-',
    '-X',
    'POST',
    url,
    '-H',
    'Content-Type: application/json',
    '-H',
    `Authorization: Bearer ${apiKey}`,
    '--data-binary',
    JSON.stringify(body),
  ]
}

export function parseHttpHeaderBlock(headerBlock: string): ParsedHeaderBlock {
  const lines = headerBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const statusLine = lines[0] ?? ''
  const statusMatch = statusLine.match(/^HTTP\/[\d.]+\s+(\d{3})/)

  if (!statusMatch) {
    throw new Error(`无法解析 curl 返回的状态行：${statusLine || '空'}`)
  }

  const headers = lines.slice(1).reduce<Record<string, string>>((acc, line) => {
    const separatorIndex = line.indexOf(':')

    if (separatorIndex < 0) {
      return acc
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase()
    const value = line.slice(separatorIndex + 1).trim()

    acc[key] = value

    return acc
  }, {})

  return {
    statusCode: Number(statusMatch[1]),
    headers,
  }
}

function applyHeaders(res: ServerResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    if (key === 'content-length' || key === 'transfer-encoding' || key === 'connection') {
      continue
    }

    res.setHeader(key, value)
  }
}

export function streamWithCurl(
  options: CurlFallbackOptions & { res: ServerResponse },
) {
  const { res, ...request } = options

  return new Promise<void>((resolve, reject) => {
    const curlProcess = spawn('curl', buildCurlArgs(request), {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdoutBuffer = Buffer.alloc(0)
    let stderrText = ''
    let headersParsed = false

    curlProcess.stdout.on('data', (chunk: Buffer) => {
      if (!headersParsed) {
        stdoutBuffer = Buffer.concat([stdoutBuffer, chunk])

        const boundary = findHeaderBoundary(stdoutBuffer)

        if (!boundary) {
          return
        }

        const headerBlock = stdoutBuffer
          .slice(0, boundary.index)
          .toString('utf8')
        const parsed = parseHttpHeaderBlock(headerBlock)

        headersParsed = true
        res.statusCode = parsed.statusCode
        applyHeaders(res, parsed.headers)

        const bodyChunk = stdoutBuffer.slice(boundary.index + boundary.length)

        if (bodyChunk.length > 0) {
          res.write(bodyChunk)
        }

        stdoutBuffer = Buffer.alloc(0)
        return
      }

      res.write(chunk)
    })

    curlProcess.stderr.on('data', (chunk: Buffer) => {
      stderrText += chunk.toString('utf8')
    })

    curlProcess.on('error', (error) => {
      reject(error)
    })

    curlProcess.on('close', (code) => {
      if (!headersParsed) {
        reject(
          new Error(
            stderrText.trim() || `curl 转发失败，退出码：${code ?? 'unknown'}`,
          ),
        )
        return
      }

      if (!res.writableEnded) {
        res.end()
      }

      resolve()
    })
  })
}
