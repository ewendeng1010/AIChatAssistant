import { useEffect, useState } from 'react'
import { defaultApiConfig, streamChatCompletion } from './api'
import { ChatInterface } from './components/ChatInterface'
import type { ApiConfig, Message } from './types'

const bootstrapMessages: Message[] = [
  {
    id: 'welcome-user',
    role: 'user',
    content: '帮我搭一个 React + TypeScript 的 AI 聊天助手，界面像微信一样简洁一些。',
    timestamp: '14:36',
  },
  {
    id: 'welcome-assistant',
    role: 'assistant',
    content: `当然可以，当前聊天界面已经具备这些基础能力：
1. 支持多轮对话和流式输出
2. 消息内容支持 Markdown 渲染
3. 对话历史会自动保存到本地

\`\`\`ts
const streamEnabled = true
const storageKey = 'ai-chat-history'
\`\`\`

你现在可以继续补充 API 配置、交互细节，或者直接开始对话测试。`,
    timestamp: '14:37',
  },
]

const setupChecklist = [
  'React 19 + TypeScript + Vite 8',
  'Tailwind CSS 4',
  'react-markdown + 代码高亮',
  'OpenAI 兼容的流式聊天接口',
]

const nextMilestones = [
  '支持在界面中切换 API 地址、Key 和模型',
  '保留多轮对话与 LocalStorage 持久化',
  '继续优化错误提示、复制和代码块体验',
]

const CHAT_STORAGE_KEY = 'ai-chat-history'
const API_SETTINGS_STORAGE_KEY = 'ai-chat-api-settings'

function getCurrentTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

function createMessageId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeApiConfig(config: ApiConfig): ApiConfig {
  return {
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl.trim() || defaultApiConfig.baseUrl,
    model: config.model.trim() || defaultApiConfig.model,
  }
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string' &&
    typeof candidate.timestamp === 'string'
  )
}

function isApiConfig(value: unknown): value is ApiConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.apiKey === 'string' &&
    typeof candidate.baseUrl === 'string' &&
    typeof candidate.model === 'string'
  )
}

function loadStoredMessages() {
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)

    if (!raw) {
      return bootstrapMessages
    }

    const parsed = JSON.parse(raw) as unknown

    if (Array.isArray(parsed) && parsed.every(isMessage)) {
      return parsed
    }
  } catch {
    return bootstrapMessages
  }

  return bootstrapMessages
}

function loadStoredApiConfig() {
  try {
    const raw = window.localStorage.getItem(API_SETTINGS_STORAGE_KEY)

    if (!raw) {
      return defaultApiConfig
    }

    const parsed = JSON.parse(raw) as unknown

    if (isApiConfig(parsed)) {
      return normalizeApiConfig(parsed)
    }
  } catch {
    return defaultApiConfig
  }

  return defaultApiConfig
}

function App() {
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [configMessage, setConfigMessage] = useState('')
  const [apiConfig, setApiConfig] = useState<ApiConfig>(loadStoredApiConfig)
  const [draftApiConfig, setDraftApiConfig] = useState<ApiConfig>(loadStoredApiConfig)
  const apiConfigured = Boolean(apiConfig.apiKey)

  useEffect(() => {
    if (messages.length === 0) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  const handleSend = async () => {
    const trimmedInput = input.trim()

    if (!trimmedInput || isSending) {
      return
    }

    const userMessage: Message = {
      id: createMessageId('user'),
      role: 'user',
      content: trimmedInput,
      timestamp: getCurrentTime(),
    }

    const assistantMessageId = createMessageId('assistant')
    const conversationMessages = [...messages, userMessage]

    setErrorMessage('')
    setConfigMessage('')
    setIsSending(true)
    setMessages([
      ...conversationMessages,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: getCurrentTime(),
      },
    ])
    setInput('')

    try {
      const finalReply = await streamChatCompletion({
        config: apiConfig,
        messages: conversationMessages,
        onChunk: (_, fullText) => {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: fullText }
                : message,
            ),
          )
        },
      })

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: finalReply }
            : message,
        ),
      )
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : '连接 AI 服务时发生了未知异常。'
      const friendlyMessage = `这次回复没有成功，请检查网络后重试。${detail}`

      setErrorMessage(friendlyMessage)
      setMessages((currentMessages) => {
        const targetMessage = currentMessages.find(
          (message) => message.id === assistantMessageId,
        )

        if (targetMessage?.content.trim()) {
          return currentMessages
        }

        return currentMessages.filter(
          (message) => message.id !== assistantMessageId,
        )
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleClear = () => {
    setMessages([])
    setInput('')
    setErrorMessage('')
    window.localStorage.removeItem(CHAT_STORAGE_KEY)
  }

  const handleApiConfigChange = (field: keyof ApiConfig, value: string) => {
    setDraftApiConfig((currentConfig) => ({
      ...currentConfig,
      [field]: value,
    }))
  }

  const handleSaveApiConfig = () => {
    const nextConfig = normalizeApiConfig(draftApiConfig)

    setApiConfig(nextConfig)
    setDraftApiConfig(nextConfig)
    setErrorMessage('')
    setConfigMessage('配置已保存，后续对话会使用这组参数。')
    window.localStorage.setItem(
      API_SETTINGS_STORAGE_KEY,
      JSON.stringify(nextConfig),
    )
  }

  const handleResetApiConfig = () => {
    setApiConfig(defaultApiConfig)
    setDraftApiConfig(defaultApiConfig)
    setConfigMessage('已恢复默认配置。')
    window.localStorage.removeItem(API_SETTINGS_STORAGE_KEY)
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.2),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-y-24 right-0 -z-10 w-80 rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.14),transparent_68%)] blur-3xl" />

      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/75 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur xl:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700/80">
                AI Chat Assistant
              </p>
              <h1 className="mt-3 max-w-2xl font-['Noto_Serif_SC','Source_Han_Serif_SC',serif] text-4xl leading-tight text-slate-900 sm:text-5xl">
                可配置 OpenAI 接口的聊天助手
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                现在页面的核心区域已经收敛为一个独立的 ChatInterface
                组件，消息支持 Markdown 渲染、流式输出和本地持久化。
                右侧可以直接配置 API 地址、Key 与模型，不再只能依赖 .env。
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-slate-700 sm:grid-cols-2 lg:min-w-[22rem]">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  API 状态
                </p>
                <p className="mt-2 font-semibold text-slate-900">
                  {apiConfigured ? '已配置 API Key' : '请先填写 API Key'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  当前模型
                </p>
                <p className="mt-2 font-semibold text-slate-900">
                  {apiConfig.model}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <ChatInterface
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onClear={handleClear}
            isSending={isSending}
            errorMessage={errorMessage}
          />

          <aside className="space-y-4">
            <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/78 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    API 配置
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    保存后会写入本地浏览器，下次刷新仍会保留。
                  </p>
                </div>
                <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {apiConfigured ? '已连接' : '待配置'}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="api-base-url"
                    className="text-sm font-medium text-slate-700"
                  >
                    API Base URL
                  </label>
                  <input
                    id="api-base-url"
                    type="text"
                    value={draftApiConfig.baseUrl}
                    onChange={(event) =>
                      handleApiConfigChange('baseUrl', event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="api-key"
                    className="text-sm font-medium text-slate-700"
                  >
                    API Key
                  </label>
                  <input
                    id="api-key"
                    type="password"
                    value={draftApiConfig.apiKey}
                    onChange={(event) =>
                      handleApiConfigChange('apiKey', event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="api-model"
                    className="text-sm font-medium text-slate-700"
                  >
                    Model
                  </label>
                  <input
                    id="api-model"
                    type="text"
                    value={draftApiConfig.model}
                    onChange={(event) =>
                      handleApiConfigChange('model', event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={handleSaveApiConfig}
                  className="flex-1 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
                >
                  保存配置
                </button>
                <button
                  type="button"
                  onClick={handleResetApiConfig}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  恢复默认
                </button>
              </div>

              <dl className="mt-5 space-y-3 rounded-[1.5rem] bg-slate-50/80 p-4 text-sm leading-6 text-slate-700">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Current Base URL
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs text-slate-900">
                    {apiConfig.baseUrl}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Current Model
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-slate-900">
                    {apiConfig.model}
                  </dd>
                </div>
              </dl>

              {configMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {configMessage}
                </div>
              ) : null}
            </section>

            <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/78 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                已完成能力
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                {setupChecklist.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.75rem] border border-amber-200/70 bg-amber-50/88 p-5 text-sm leading-6 text-amber-950 shadow-[0_18px_60px_-40px_rgba(120,53,15,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                下一步建议
              </p>
              <ul className="mt-4 space-y-3">
                {nextMilestones.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </main>
      </div>
    </div>
  )
}

export default App
