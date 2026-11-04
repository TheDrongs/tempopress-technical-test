import { it, expect, vi } from 'vitest'
import { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { http, advanceSessionEpoch } from '../src/api/http'
it('ignores a late unauthorized response from an old session but handles expiry of the current session', async () => {
  const window = new EventTarget()
  vi.stubGlobal('window', window)
  const expired = vi.fn()
  window.addEventListener('tempopress:session-expired', expired)
  let config!: InternalAxiosRequestConfig
  let reject!: (reason: unknown) => void
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  function unauthorized(config: InternalAxiosRequestConfig) {
    return new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      status: 401,
      statusText: 'Unauthorized',
      data: {},
      headers: {},
    } as AxiosResponse)
  }
  try {
    const old = http.get('/work-orders', {
      adapter: (current) => {
        config = current
        started()
        return new Promise((_, failure) => {
          reject = failure
        })
      },
    })
    await ready
    advanceSessionEpoch()
    reject(unauthorized(config))
    await expect(old).rejects.toBeInstanceOf(AxiosError)
    expect(expired).not.toHaveBeenCalled()
    await expect(
      http.get('/work-orders', {
        adapter: (current) => Promise.reject(unauthorized(current)),
      }),
    ).rejects.toBeInstanceOf(AxiosError)
    expect(expired).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})
