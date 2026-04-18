import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message } from '../types'

SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)

const markdownComponents: Components = {
  code({ children, className, ...props }) {
    const language = /language-(\w+)/.exec(className ?? '')?.[1]
    const code = String(children).replace(/\n$/, '')

    if (!language) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }

    return (
      <SyntaxHighlighter
        PreTag="div"
        language={language}
        style={oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '1rem',
          padding: '1rem 1.1rem',
          background: '#f8fafc',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          fontSize: '0.84rem',
          lineHeight: 1.7,
        }}
      >
        {code}
      </SyntaxHighlighter>
    )
  },
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === 'assistant'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!message.content.trim()) {
      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
    }
  }

  return (
    <article className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={[
          'message-bubble max-w-[min(85%,44rem)] rounded-[1.7rem] px-5 py-4 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.48)] sm:px-6',
          isAssistant
            ? 'message-bubble--assistant border border-white/90 bg-white text-slate-800'
            : 'message-bubble--user border border-emerald-500/70 bg-emerald-500 text-white',
        ].join(' ')}
      >
        <div
          className={`mb-3 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] ${
            isAssistant ? 'text-slate-400' : 'text-emerald-50/85'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{isAssistant ? 'Assistant' : 'User'}</span>
            <span className="text-[0.65rem]">•</span>
            <span>{message.timestamp}</span>
          </div>

          {isAssistant ? (
            <button
              type="button"
              onClick={() => {
                void handleCopy()
              }}
              disabled={!message.content.trim()}
              aria-label={copied ? '已复制' : '复制回答'}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium tracking-normal text-slate-500 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? '已复制' : '复制'}
            </button>
          ) : null}
        </div>

        <div className="markdown-body">
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  )
}
