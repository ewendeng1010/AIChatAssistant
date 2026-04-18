import { beforeEach, expect, test, vi } from 'vitest'
import { defaultApiConfig, streamChatCompletion } from './api'

function createSseResponse(events: string[]) {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(event))
        }

        controller.close()
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    },
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

test('uses OpenAI-compatible defaults when no env overrides are provided', () => {
  expect(defaultApiConfig.baseUrl).toBe('https://api.openai.com/v1')
  expect(defaultApiConfig.model).toBe('gpt-4.1-mini')
})

test('calls the local proxy endpoint and streams output_text deltas', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    createSseResponse([
      'event: response.created\ndata: {"type":"response.created"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"你"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"好"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n',
    ]),
  )

  const onChunk = vi.fn()

  const result = await streamChatCompletion({
    config: {
      apiKey: 'sk-test',
      baseUrl: 'https://ai.love-gwen.top/v1',
      model: 'gpt-4.1',
    },
    messages: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀' },
      { role: 'user', content: '继续聊聊' },
    ],
    onChunk,
  })

  expect(result).toBe('你好')
  expect(onChunk).toHaveBeenNthCalledWith(1, '你', '你')
  expect(onChunk).toHaveBeenNthCalledWith(2, '好', '你好')
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/responses',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        apiKey: 'sk-test',
        baseUrl: 'https://ai.love-gwen.top/v1',
        model: 'gpt-4.1',
        stream: true,
        messages: [
          { role: 'user', content: '你好' },
          { role: 'assistant', content: '你好呀' },
          { role: 'user', content: '继续聊聊' },
        ],
      }),
    }),
  )
})

test('surfaces streamed error events from the local proxy endpoint', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    createSseResponse([
      'event: error\ndata: {"type":"error","error":{"message":"上游网关拒绝访问"}}\n\n',
    ]),
  )

  await expect(
    streamChatCompletion({
      config: {
        apiKey: 'sk-test',
        baseUrl: 'https://ai.love-gwen.top/v1',
        model: 'gpt-4.1',
      },
      messages: [{ role: 'user', content: '测试错误' }],
    }),
  ).rejects.toThrow('上游网关拒绝访问')
})

test('translates local proxy network failures into a friendly error message', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

  await expect(
    streamChatCompletion({
      config: {
        apiKey: 'sk-test',
        baseUrl: 'https://gateway.example.com/v1',
        model: 'gpt-4.1',
      },
      messages: [{ role: 'user', content: '测试本地代理错误' }],
    }),
  ).rejects.toThrow('无法连接到本地开发服务，请刷新页面或确认开发服务器仍在运行。')
})

test('parses chat completion delta chunks from OpenAI-compatible SSE streams', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    createSseResponse([
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"你"}}]}\n\n',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"好"}}]}\n\n',
      'data: [DONE]\n\n',
    ]),
  )

  const onChunk = vi.fn()

  const result = await streamChatCompletion({
    config: {
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
    messages: [{ role: 'user', content: '你好' }],
    onChunk,
  })

  expect(result).toBe('你好')
  expect(onChunk).toHaveBeenNthCalledWith(1, '你', '你')
  expect(onChunk).toHaveBeenNthCalledWith(2, '好', '你好')
})
