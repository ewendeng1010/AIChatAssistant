export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string
}

export type ChatRequestMessage = Pick<Message, 'role' | 'content'>

export interface ApiConfig {
  apiKey: string
  baseUrl: string
  model: string
}
