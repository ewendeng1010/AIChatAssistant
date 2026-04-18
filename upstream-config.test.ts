import { expect, test } from 'vitest'
import { buildUpstreamRequest } from './upstream-config'

test('uses OpenAI responses API shape for generic OpenAI gateways', () => {
  const request = buildUpstreamRequest({
    baseUrl: 'https://gateway.example.com/v1',
    model: 'gpt-4.1-mini',
    stream: true,
    messages: [{ role: 'user', content: '你好' }],
  })

  expect(request.url).toBe('https://gateway.example.com/v1/responses')
  expect(request.body).toEqual({
    model: 'gpt-4.1-mini',
    stream: true,
    input: [{ role: 'user', content: '你好' }],
  })
})

test('uses OpenAI responses API shape for the official OpenAI endpoint too', () => {
  const request = buildUpstreamRequest({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    stream: true,
    messages: [{ role: 'user', content: '你好' }],
  })

  expect(request.url).toBe('https://api.openai.com/v1/responses')
  expect(request.body).toEqual({
    model: 'gpt-4.1-mini',
    stream: true,
    input: [{ role: 'user', content: '你好' }],
  })
})
