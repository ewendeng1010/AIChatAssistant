import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../types'

interface ChatInterfaceProps {
  messages: Message[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onClear?: () => void
  isSending?: boolean
  errorMessage?: string
}

export function ChatInterface({
  messages,
  input,
  onInputChange,
  onSend,
  onClear,
  isSending = false,
  errorMessage,
}: ChatInterfaceProps) {
  const canSend = input.trim().length > 0 && !isSending
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()

      if (canSend) {
        onSend()
      }
    }
  }

  useEffect(() => {
    if (typeof bottomAnchorRef.current?.scrollIntoView === 'function') {
      bottomAnchorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }
  }, [messages, isSending])

  return (
    <section className="flex min-h-[44rem] flex-col overflow-hidden rounded-[2rem] border border-white/75 bg-white/82 shadow-[0_28px_100px_-42px_rgba(15,23,42,0.52)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/75 px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">对话窗口</p>
          <p className="text-xs text-slate-500">
            微信式左右消息布局，支持 Markdown 和代码高亮
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {messages.length} 条消息
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
          >
            清空对话
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.72)_0%,rgba(241,245,249,0.96)_100%)] px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          ) : (
            <div className="flex min-h-full flex-1 items-center justify-center py-12">
              <div className="max-w-sm rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 px-6 py-8 text-center shadow-[0_16px_50px_-34px_rgba(15,23,42,0.38)]">
                <p className="text-sm font-semibold text-slate-900">开始一个新话题</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  输入你的问题，AI 会在这里以流式方式逐步回复。
                </p>
              </div>
            </div>
          )}
          <div ref={bottomAnchorRef} />
        </div>
      </div>

      <div className="border-t border-slate-200/80 bg-white/92 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <label htmlFor="chat-input" className="sr-only">
            输入消息
          </label>
          <textarea
            id="chat-input"
            rows={4}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder="输入消息，Shift + Enter 换行"
            className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="text-xs text-slate-500">
              {isSending ? '思考中...' : 'Enter 发送，Shift + Enter 换行'}
            </p>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              发送
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
