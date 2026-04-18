interface UpstreamMessage {
  role: string
  content: string
}

interface BuildUpstreamRequestOptions {
  baseUrl: string
  model: string
  stream: boolean
  messages: UpstreamMessage[]
}

export function buildUpstreamRequest({
  baseUrl,
  model,
  stream,
  messages,
}: BuildUpstreamRequestOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  return {
    url: `${normalizedBaseUrl}/responses`,
    body: {
      model,
      stream,
      input: messages,
    },
  }
}
