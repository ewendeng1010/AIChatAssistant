import { expect, test } from 'vitest'
import { getProxyDispatcher } from './proxy-utils'

test('returns a proxy dispatcher when proxy environment variables are present', () => {
  const dispatcher = getProxyDispatcher({
    HTTP_PROXY: 'http://127.0.0.1:7897',
    HTTPS_PROXY: 'http://127.0.0.1:7897',
  })

  expect(dispatcher).toBeDefined()
  expect(dispatcher?.constructor.name).toBe('EnvHttpProxyAgent')
})

test('returns undefined when no proxy environment variables are configured', () => {
  expect(getProxyDispatcher({})).toBeUndefined()
})

test('falls back to ALL_PROXY when dedicated http proxy vars are missing', () => {
  const dispatcher = getProxyDispatcher({
    ALL_PROXY: 'http://127.0.0.1:7897',
  })

  expect(dispatcher).toBeDefined()
  expect(dispatcher?.constructor.name).toBe('EnvHttpProxyAgent')
})

test('uses a generic proxy agent for socks proxies', () => {
  const dispatcher = getProxyDispatcher({
    ALL_PROXY: 'socks5://127.0.0.1:7897',
  })

  expect(dispatcher).toBeDefined()
  expect(dispatcher?.constructor.name).toBe('ProxyAgent')
})
