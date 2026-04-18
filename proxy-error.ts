interface ErrorCauseLike {
  code?: string
  hostname?: string
  address?: string
  port?: number
}

interface ProxyErrorContext {
  upstreamUrl?: string
  proxyLabel?: string
}

function readCause(error: unknown) {
  if (!(error instanceof Error)) {
    return null
  }

  const cause = (error as Error & { cause?: ErrorCauseLike }).cause

  return cause && typeof cause === 'object' ? cause : null
}

function buildDiagnosticSuffix(context?: ProxyErrorContext) {
  const parts = [
    context?.upstreamUrl ? `上游地址：${context.upstreamUrl}` : '',
    context?.proxyLabel ? `代理：${context.proxyLabel}` : '',
  ].filter(Boolean)

  return parts.length > 0 ? `${parts.join('；')}。` : ''
}

export function formatProxyErrorMessage(
  error: unknown,
  context?: ProxyErrorContext,
) {
  const cause = readCause(error)

  if (cause?.code === 'ENOTFOUND' && cause.hostname) {
    return `无法解析上游 AI 服务域名 ${cause.hostname}，请检查 API Base URL、DNS 或代理设置。${buildDiagnosticSuffix(context)}`
  }

  if (
    (cause?.code === 'ECONNREFUSED' || cause?.code === 'EPERM') &&
    cause.address &&
    cause.port
  ) {
    return `无法连接到代理或上游服务 ${cause.address}:${cause.port}，请确认本机代理或网关服务正在运行。${buildDiagnosticSuffix(context)}`
  }

  if (
    error instanceof TypeError &&
    (error.message === 'fetch failed' || error.message === 'Failed to fetch')
  ) {
    return `无法连接到上游 AI 服务，请检查网关地址、网络或代理设置。${buildDiagnosticSuffix(context)}`
  }

  return error instanceof Error
    ? error.message
    : '本地代理转发失败，请稍后重试。'
}
