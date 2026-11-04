import axios from 'axios'
declare module 'axios' {
  interface AxiosRequestConfig {
    sessionEpoch?: number
  }
}
let sessionEpoch = 0
export function advanceSessionEpoch() {
  ++sessionEpoch
}

// Same-origin /api works through both the Vite and Nginx proxies.
export const http = axios.create({
  baseURL: '/api',
  timeout: 60_000,
  withCredentials: true,
})
http.interceptors.request.use((config) => {
  config.sessionEpoch = sessionEpoch
  return config
})
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config?.sessionEpoch === sessionEpoch &&
      !error.config?.url?.startsWith('/auth/') &&
      typeof window !== 'undefined'
    )
      window.dispatchEvent(new Event('tempopress:session-expired'))
    return Promise.reject(error)
  },
)

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Tidak dapat menghubungi server. Periksa koneksi, lalu coba lagi.'
    }
    const messages: Record<number, string> = {
      401: ['/auth/login', '/auth/switch'].includes(error.config?.url ?? '')
        ? 'Username atau password tidak sesuai.'
        : 'Sesi Anda telah berakhir. Silakan login kembali.',
      403:
        error.config?.url === '/auth/switch'
          ? 'Akun tidak sesuai role yang dipilih.'
          : 'Pengguna aktif tidak memiliki akses untuk tindakan ini.',
      404: 'Data tidak ditemukan. Muat ulang untuk melihat data terbaru.',
      409: 'Status sudah berubah atau tindakan sudah diproses. Muat ulang detail sebelum melanjutkan.',
      413: 'Ukuran foto terlalu besar. Gunakan JPG/PNG maksimal 2 MB per foto.',
      502: 'Layanan backend belum dapat dihubungi. Pastikan backend dan database berjalan, lalu coba lagi.',
      503: 'Layanan belum siap. Pastikan backend dan database berjalan, lalu coba lagi.',
    }
    if (messages[error.response.status]) return messages[error.response.status]
    if (error.response.status === 400) {
      const body = error.response.data as { message?: unknown } | undefined
      const message = body?.message
      return typeof message === 'string'
        ? message
        : Array.isArray(message) &&
            message.every((item) => typeof item === 'string')
          ? message.join(' ')
          : 'Periksa kembali data yang dimasukkan.'
    }
  }
  return 'Terjadi kesalahan saat memproses data. Silakan coba lagi.'
}
