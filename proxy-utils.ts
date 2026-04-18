import { EnvHttpProxyAgent, ProxyAgent, type Dispatcher } from 'undici'

interface ProxyEnv {
  HTTP_PROXY?: string
  HTTPS_PROXY?: string
  ALL_PROXY?: string
  NO_PROXY?: string
}

function isSocksProxy(value?: string) {
  return typeof value === 'string' && /^socks5?:\/\//i.test(value)
}

export function getProxyDispatcher(env: ProxyEnv): Dispatcher | undefined {
  if (!env.HTTP_PROXY && !env.HTTPS_PROXY && !env.ALL_PROXY) {
    return undefined
  }

  const sharedProxy = env.ALL_PROXY
  const prioritizedProxy =
    env.HTTPS_PROXY ?? env.HTTP_PROXY ?? env.ALL_PROXY

  if (isSocksProxy(prioritizedProxy)) {
    return new ProxyAgent(prioritizedProxy as string)
  }

  return new EnvHttpProxyAgent({
    httpProxy: env.HTTP_PROXY ?? sharedProxy,
    httpsProxy: env.HTTPS_PROXY ?? sharedProxy,
    noProxy: env.NO_PROXY,
  })
}

export function getProxyLabel(env: ProxyEnv) {
  const prioritizedProxy =
    env.HTTPS_PROXY ?? env.HTTP_PROXY ?? env.ALL_PROXY

  if (!prioritizedProxy) {
    return '直连'
  }

  return isSocksProxy(prioritizedProxy)
    ? `SOCKS ${prioritizedProxy}`
    : `HTTP ${prioritizedProxy}`
}
