import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { ChatInterface } from './ChatInterface'
import type { Message } from '../types'

const messages: Message[] = [
  {
    id: 'user-1',
    role: 'user',
    content: '你好，帮我写一段总结。',
    timestamp: '09:00',
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    content: '当然可以，我先给你一个 **Markdown** 示例。',
    timestamp: '09:01',
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
})

test('renders messages on opposite sides and shows markdown content', () => {
  render(
    <ChatInterface
      messages={messages}
      input="继续补充一下"
      onInputChange={() => {}}
      onSend={() => {}}
    />,
  )

  const userMessage = screen.getByText('你好，帮我写一段总结。')
  const assistantMessage = screen.getByText('Markdown')

  expect(userMessage.closest('article')).toHaveClass('justify-end')
  expect(assistantMessage.closest('article')).toHaveClass('justify-start')
  expect(screen.getByText('Markdown')).toBeInTheDocument()
})

test('shows textarea and send button, and updates input through callback', () => {
  const handleInputChange = vi.fn()

  render(
    <ChatInterface
      messages={messages}
      input=""
      onInputChange={handleInputChange}
      onSend={() => {}}
    />,
  )

  const textarea = screen.getByPlaceholderText('输入消息，Shift + Enter 换行')

  fireEvent.change(textarea, { target: { value: '新的问题' } })

  expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
  expect(handleInputChange).toHaveBeenCalledWith('新的问题')
})

test('scrolls to the bottom when new messages arrive', () => {
  const scrollIntoView = vi.fn()

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })

  const { rerender } = render(
    <ChatInterface
      messages={messages.slice(0, 1)}
      input=""
      onInputChange={() => {}}
      onSend={() => {}}
    />,
  )

  rerender(
    <ChatInterface
      messages={messages}
      input=""
      onInputChange={() => {}}
      onSend={() => {}}
    />,
  )

  expect(scrollIntoView).toHaveBeenCalled()
})

test('shows copy button for assistant messages and copies reply text', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })

  render(
    <ChatInterface
      messages={messages}
      input=""
      onInputChange={() => {}}
      onSend={() => {}}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: '复制回答' }))

  expect(writeText).toHaveBeenCalledWith('当然可以，我先给你一个 **Markdown** 示例。')
  await waitFor(() => expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument())
})
