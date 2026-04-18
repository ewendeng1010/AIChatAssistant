import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const CHAT_STORAGE_KEY = 'ai-chat-history'
const API_SETTINGS_STORAGE_KEY = 'ai-chat-api-settings'

const { defaultApiConfigMock, streamChatCompletionMock } = vi.hoisted(() => ({
  defaultApiConfigMock: {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  streamChatCompletionMock: vi.fn(),
}))

vi.mock('./api', () => ({
  defaultApiConfig: defaultApiConfigMock,
  streamChatCompletion: streamChatCompletionMock,
}))

import App from './App'

beforeEach(() => {
  streamChatCompletionMock.mockReset()
  window.localStorage.clear()
})

test('sends user message, passes history to API, and streams assistant reply', async () => {
  const user = userEvent.setup()
  let emitChunk: ((chunk: string, fullText: string) => void) | undefined
  let resolveStream: ((value: string) => void) | undefined

  streamChatCompletionMock.mockImplementation(
    ({ onChunk }: { onChunk?: (chunk: string, fullText: string) => void }) =>
      new Promise<string>((resolve) => {
        emitChunk = onChunk
        resolveStream = resolve
      }),
  )

  render(<App />)

  const textarea = screen.getByPlaceholderText('输入消息，Shift + Enter 换行')

  await user.type(textarea, '继续完善流式消息')
  await user.click(screen.getByRole('button', { name: '发送' }))

  expect(screen.getByText('继续完善流式消息')).toBeInTheDocument()
  expect(textarea).toBeDisabled()
  expect(screen.getByText('思考中...')).toBeInTheDocument()

  await waitFor(() => expect(streamChatCompletionMock).toHaveBeenCalledTimes(1))

  const request = streamChatCompletionMock.mock.calls[0][0]
  const messages = request.messages

  expect(messages.map((message: { content: string }) => message.content)).toEqual([
    '帮我搭一个 React + TypeScript 的 AI 聊天助手，界面像微信一样简洁一些。',
    expect.stringContaining('当然可以，当前聊天界面已经具备这些基础能力'),
    '继续完善流式消息',
  ])
  expect(request.config).toEqual(defaultApiConfigMock)

  act(() => emitChunk?.('流式', '流式'))
  expect(screen.getByText('流式')).toBeInTheDocument()

  act(() => emitChunk?.('回复', '流式回复'))
  expect(screen.getByText('流式回复')).toBeInTheDocument()

  act(() => emitChunk?.('完成', '流式回复完成'))
  expect(screen.getByText('流式回复完成')).toBeInTheDocument()

  await act(async () => {
    resolveStream?.('流式回复完成')
  })

  await waitFor(() => expect(textarea).not.toBeDisabled())
  await waitFor(() =>
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toContain('流式回复完成'),
  )
})

test('loads chat history from localStorage on page load', () => {
  window.localStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'saved-user',
        role: 'user',
        content: '这是上次的问题',
        timestamp: '08:00',
      },
      {
        id: 'saved-assistant',
        role: 'assistant',
        content: '这是上次的回答',
        timestamp: '08:01',
      },
    ]),
  )

  render(<App />)

  expect(screen.getByText('这是上次的问题')).toBeInTheDocument()
  expect(screen.getByText('这是上次的回答')).toBeInTheDocument()
})

test('clears chat history when clear button is clicked', async () => {
  const user = userEvent.setup()

  window.localStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'saved-user',
        role: 'user',
        content: '需要被清掉的消息',
        timestamp: '08:00',
      },
    ]),
  )

  render(<App />)

  await user.click(screen.getByRole('button', { name: '清空对话' }))

  expect(screen.queryByText('需要被清掉的消息')).not.toBeInTheDocument()
  expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull()
})

test('shows a friendly error message when the API call fails', async () => {
  const user = userEvent.setup()

  streamChatCompletionMock.mockRejectedValue(new Error('网络连接异常'))

  render(<App />)

  const textarea = screen.getByPlaceholderText('输入消息，Shift + Enter 换行')

  await user.type(textarea, '这次为什么失败了？')
  await user.click(screen.getByRole('button', { name: '发送' }))

  expect(
    await screen.findByText('这次回复没有成功，请检查网络后重试。网络连接异常'),
  ).toBeInTheDocument()
  expect(textarea).not.toBeDisabled()
})

test('saves API settings to localStorage and uses them for subsequent requests', async () => {
  const user = userEvent.setup()

  streamChatCompletionMock.mockResolvedValue('已套用新配置')

  render(<App />)

  await user.clear(screen.getByLabelText('API Base URL'))
  await user.type(
    screen.getByLabelText('API Base URL'),
    'https://gateway.example.com/v1',
  )
  await user.clear(screen.getByLabelText('API Key'))
  await user.type(screen.getByLabelText('API Key'), 'sk-custom-key')
  await user.clear(screen.getByLabelText('Model'))
  await user.type(screen.getByLabelText('Model'), 'gpt-5-mini')
  await user.click(screen.getByRole('button', { name: '保存配置' }))

  expect(
    JSON.parse(window.localStorage.getItem(API_SETTINGS_STORAGE_KEY) ?? '{}'),
  ).toEqual({
    baseUrl: 'https://gateway.example.com/v1',
    apiKey: 'sk-custom-key',
    model: 'gpt-5-mini',
  })

  const textarea = screen.getByPlaceholderText('输入消息，Shift + Enter 换行')
  await user.type(textarea, '使用新配置发送')
  await user.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() => expect(streamChatCompletionMock).toHaveBeenCalledTimes(1))
  expect(streamChatCompletionMock.mock.calls[0][0].config).toEqual({
    baseUrl: 'https://gateway.example.com/v1',
    apiKey: 'sk-custom-key',
    model: 'gpt-5-mini',
  })
})

test('loads saved API settings from localStorage on page load', () => {
  window.localStorage.setItem(
    API_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      baseUrl: 'https://proxy.example.com/openai',
      apiKey: 'sk-saved-key',
      model: 'gpt-4.1',
    }),
  )

  render(<App />)

  expect(screen.getByLabelText('API Base URL')).toHaveValue(
    'https://proxy.example.com/openai',
  )
  expect(screen.getByLabelText('API Key')).toHaveValue('sk-saved-key')
  expect(screen.getByLabelText('Model')).toHaveValue('gpt-4.1')
})

test('restores default API settings when reset button is clicked', async () => {
  const user = userEvent.setup()

  window.localStorage.setItem(
    API_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      baseUrl: 'https://proxy.example.com/openai',
      apiKey: 'sk-saved-key',
      model: 'gpt-4.1',
    }),
  )

  render(<App />)

  await user.click(screen.getByRole('button', { name: '恢复默认' }))

  expect(screen.getByLabelText('API Base URL')).toHaveValue(
    defaultApiConfigMock.baseUrl,
  )
  expect(screen.getByLabelText('API Key')).toHaveValue(defaultApiConfigMock.apiKey)
  expect(screen.getByLabelText('Model')).toHaveValue(defaultApiConfigMock.model)
  expect(window.localStorage.getItem(API_SETTINGS_STORAGE_KEY)).toBeNull()
})
