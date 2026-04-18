import type { ApiConfig, ChatRequestMessage, Message } from './types'

const DEFAULT_API_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_API_MODEL = 'gpt-4.1-mini'

export const defaultApiConfig: ApiConfig = {
  apiKey:
    import.meta.env.VITE_OPENAI_API_KEY?.trim() ??
    import.meta.env.VITE_AI_API_KEY?.trim() ??
    '',
  baseUrl:
    import.meta.env.VITE_OPENAI_BASE_URL?.trim() ??
    import.meta.env.VITE_AI_BASE_URL?.trim() ??
    DEFAULT_API_BASE_URL,
  model:
    import.meta.env.VITE_OPENAI_MODEL?.trim() ??
    import.meta.env.VITE_AI_MODEL?.trim() ??
    DEFAULT_API_MODEL,
}

interface StreamEventChoice {
  delta?: {
    content?: string
  }
}

interface StreamEvent {
  type?: string
  delta?: string
  choices?: StreamEventChoice[]
  error?: {
    message?: string
  }
  message?: string
}

export interface StreamChatCompletionOptions {
  config: ApiConfig
  messages: Message[] | ChatRequestMessage[]
  signal?: AbortSignal
  onChunk?: (chunk: string, fullText: string) => void
}

function toResponsesInput(messages: Message[] | ChatRequestMessage[]) {
  return messages.map(({ role, content }) => ({ role, content }))
}

const LOCAL_PROXY_URL = '/api/responses'

function normalizeApiConfig(config: ApiConfig): ApiConfig {
  return {
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl.trim() || defaultApiConfig.baseUrl,
    model: config.model.trim() || defaultApiConfig.model,
  }
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      error?: { message?: string }
      message?: string
    }

    return (
      data.error?.message ??
      data.message ??
      `AI 接口请求失败，状态码：${response.status}`
    )
  } catch {
    return `AI 接口请求失败，状态码：${response.status}`
  }
}

function parseSseEvent(event: string) {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('')

  if (!data) {
    return null
  }

  if (data === '[DONE]') {
    return '[DONE]' as const
  }

  return JSON.parse(data) as StreamEvent
}

function extractTextFromEvent(event: StreamEvent) {
  switch (event.type) {
    case 'response.output_text.delta':
      return event.delta ?? ''
    default:
      return event.choices?.map((choice) => choice.delta?.content ?? '').join('') ?? ''
  }
}

function readStreamError(event: StreamEvent) {
  return event.error?.message ?? event.message ?? ''
}

function formatLocalProxyFetchError(error: unknown) {
  if (
    error instanceof TypeError &&
    (error.message === 'fetch failed' || error.message === 'Failed to fetch')
  ) {
    return '无法连接到本地开发服务，请刷新页面或确认开发服务器仍在运行。'
  }

  return error instanceof Error ? error.message : '连接本地代理时发生未知错误。'
}

export async function streamChatCompletion({
  config,
  messages,
  signal,
  onChunk,
}: StreamChatCompletionOptions) {
  const resolvedConfig = normalizeApiConfig(config)

  if (!resolvedConfig.apiKey) {
    throw new Error('缺少 API Key，请先配置 API Key。')
  }

  let response: Response

  try {
    response = await fetch(LOCAL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: resolvedConfig.apiKey,
        baseUrl: resolvedConfig.baseUrl,
        model: resolvedConfig.model,
        stream: true,
        messages: toResponsesInput(messages),
      }),
      signal,
    })
  } catch (error) {
    throw new Error(formatLocalProxyFetchError(error))
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  if (!response.body) {
    throw new Error('AI 服务没有返回可读取的流式响应，请稍后重试。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()

    buffer += decoder.decode(value, { stream: !done })

    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() ?? ''

    for (const event of events) {
      const parsed = parseSseEvent(event)

      if (!parsed) {
        continue
      }

      if (parsed === '[DONE]') {
        return fullText
      }

      const streamError = readStreamError(parsed)

      if (parsed.type === 'error' && streamError) {
        throw new Error(streamError)
      }

      const chunkText = extractTextFromEvent(parsed)

      if (!chunkText) {
        continue
      }

      fullText += chunkText
      onChunk?.(chunkText, fullText)
    }

    if (done) {
      break
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseEvent(buffer)

    if (parsed && parsed !== '[DONE]') {
      const streamError = readStreamError(parsed)

      if (parsed.type === 'error' && streamError) {
        throw new Error(streamError)
      }

      const chunkText = extractTextFromEvent(parsed)

      if (chunkText) {
        fullText += chunkText
        onChunk?.(chunkText, fullText)
      }
    }
  }

  return fullText
}
