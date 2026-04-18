import { expect, test } from 'vitest'
import { formatProxyErrorMessage } from './proxy-error'

test('surfaces DNS lookup failures with hostname details', () => {
  const error = new TypeError('fetch failed') as TypeError & {
    cause?: { code?: string; hostname?: string }
  }

  error.cause = {
    code: 'ENOTFOUND',
    hostname: 'gateway.example.com',
  }

  expect(formatProxyErrorMessage(error)).toBe(
    '无法解析上游 AI 服务域名 gateway.example.com，请检查 API Base URL、DNS 或代理设置。',
  )
})

test('surfaces connection failures with address details', () => {
  const error = new TypeError('fetch failed') as TypeError & {
    cause?: { code?: string; address?: string; port?: number }
  }

  error.cause = {
    code: 'ECONNREFUSED',
    address: '127.0.0.1',
    port: 7897,
  }

  expect(formatProxyErrorMessage(error)).toBe(
    '无法连接到代理或上游服务 127.0.0.1:7897，请确认本机代理或网关服务正在运行。',
  )
})

test('keeps the original error message for non-network errors', () => {
  expect(formatProxyErrorMessage(new Error('请求体格式错误'))).toBe('请求体格式错误')
})

test('translates bare fetch failed errors into a friendly upstream message', () => {
  expect(
    formatProxyErrorMessage(new TypeError('fetch failed'), {
      upstreamUrl: 'https://gateway.example.com/v1/responses',
      proxyLabel: 'SOCKS socks5://127.0.0.1:7897',
    }),
  ).toBe(
    '无法连接到上游 AI 服务，请检查网关地址、网络或代理设置。上游地址：https://gateway.example.com/v1/responses；代理：SOCKS socks5://127.0.0.1:7897。',
  )
})
