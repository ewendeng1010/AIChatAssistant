import type { ApiConfig, ChatRequestMessage, Message } from './types'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'

export const defaultApiConfig: ApiConfig = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY?.trim() ?? '',
  baseUrl:
    import.meta.env.VITE_OPENAI_BASE_URL?.trim() ?? DEFAULT_OPENAI_BASE_URL,
  model: import.meta.env.VITE_OPENAI_MODEL?.trim() ?? DEFAULT_OPENAI_MODEL,
}

interface ResponsesStreamEvent {
  type?: string
  delta?: string
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
      `OpenAI API 请求失败，状态码：${response.status}`
    )
  } catch {
    return `OpenAI API 请求失败，状态码：${response.status}`
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

  return JSON.parse(data) as ResponsesStreamEvent
}

function extractTextFromEvent(event: ResponsesStreamEvent) {
  switch (event.type) {
    case 'response.output_text.delta':
      return event.delta ?? ''
    default:
      return ''
  }
}

function readStreamError(event: ResponsesStreamEvent) {
  return event.error?.message ?? event.message ?? ''
}

export async function streamChatCompletion({
  config,
  messages,
  signal,
  onChunk,
}: StreamChatCompletionOptions) {
  const resolvedConfig = normalizeApiConfig(config)

  if (!resolvedConfig.apiKey) {
    throw new Error('缺少 OpenAI API Key，请先配置 API Key。')
  }

  const response = await fetch(LOCAL_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: resolvedConfig.apiKey,
      baseUrl: resolvedConfig.baseUrl,
      model: resolvedConfig.model,
      stream: true,
      input: toResponsesInput(messages),
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  if (!response.body) {
    throw new Error('OpenAI 没有返回可读取的流式响应，请稍后重试。')
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
