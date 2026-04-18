import { expect, test } from 'vitest'
import {
  buildCurlArgs,
  parseHttpHeaderBlock,
  shouldUseCurlFallback,
} from './curl-fallback'

test('retries with curl for generic fetch failed errors', () => {
  expect(shouldUseCurlFallback(new TypeError('fetch failed'))).toBe(true)
})

test('does not retry with curl for non-network application errors', () => {
  expect(shouldUseCurlFallback(new Error('请求体格式错误'))).toBe(false)
})

test('builds a curl command that preserves streaming headers and request body', () => {
  expect(
    buildCurlArgs({
      url: 'https://ai.love-gwen.top/responses',
      apiKey: 'sk-test',
      body: {
        model: 'gpt-4.1-mini',
        stream: true,
        input: [{ role: 'user', content: 'hi' }],
      },
    }),
  ).toEqual([
    '-sS',
    '-N',
    '-D',
    '-',
    '-X',
    'POST',
    'https://ai.love-gwen.top/responses',
    '-H',
    'Content-Type: application/json',
    '-H',
    'Authorization: Bearer sk-test',
    '--data-binary',
    JSON.stringify({
      model: 'gpt-4.1-mini',
      stream: true,
      input: [{ role: 'user', content: 'hi' }],
    }),
  ])
})

test('parses an HTTP header block returned by curl', () => {
  expect(
    parseHttpHeaderBlock(
      'HTTP/2 200\r\ncontent-type: text/event-stream\r\nx-request-id: req_123\r\n\r\n',
    ),
  ).toEqual({
    statusCode: 200,
    headers: {
      'content-type': 'text/event-stream',
      'x-request-id': 'req_123',
    },
  })
})
