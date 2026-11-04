import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const users = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Admin Demo',
    role: 'ADMIN',
  },
  { id: '00000000-0000-4000-8000-000000000002', name: 'SPV Demo', role: 'SPV' },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Mechanic Demo',
    role: 'MECHANIC',
  },
]
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1f8AAAAASUVORK5CYII=',
  'base64',
)

function usernameFor(id: string) {
  return id === users[0].id
    ? 'admin'
    : id === users[1].id
      ? 'spv'
      : id === users[2].id
        ? 'mekanik'
        : id
}
function passwordFor(id: string) {
  return users.some((user) => user.id === id)
    ? `${usernameFor(id)}123`
    : 'demo123'
}
async function mockApi(
  page: Page,
  extraUsers: typeof users = [],
  loggedIn = true,
) {
  const availableUsers = [...users, ...extraUsers]
  const state = {
    actorId: loggedIn ? (users[0].id as string | null) : null,
    order: null as Record<string, any> | null,
    requests: [] as Record<string, any>[],
    failList: false,
    mutationCount: 0,
    photoNames: [] as string[],
    actorIds: [] as string[],
    extraOrders: [] as Record<string, any>[],
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const req = route.request()
      const path = new URL(req.url()).pathname.replace('/api', '')
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })
      if (path === '/auth/me')
        return state.actorId
          ? json(availableUsers.find((user) => user.id === state.actorId))
          : json({ message: 'Login required' }, 401)
      if (path === '/auth/login') {
        const body = req.postDataJSON()
        const user = availableUsers.find(
          (user) => usernameFor(user.id) === body.username,
        )
        if (!user || body.password !== passwordFor(user.id))
          return json({ message: 'Invalid credentials' }, 401)
        state.actorId = user.id
        return json(user)
      }
      if (path === '/auth/switch') {
        if (!state.actorId) return json({ message: 'Session expired' }, 401)
        const body = req.postDataJSON()
        const user = availableUsers.find(
          (user) => usernameFor(user.id) === body.username,
        )
        if (!user || body.password !== passwordFor(user.id))
          return json({ message: 'Invalid credentials' }, 401)
        if (user.role !== body.expectedRole)
          return json({ message: 'Wrong role' }, 403)
        state.actorId = user.id
        return json(user)
      }
      if (path === '/auth/logout') {
        state.actorId = null
        return route.fulfill({ status: 204, body: '' })
      }
      if (!state.actorId) return json({ message: 'Session expired' }, 401)
      if (path === '/users') return json(availableUsers)
      if (path.endsWith('/image'))
        return route.fulfill({ contentType: 'image/png', body: pixel })
      if (req.method() === 'GET') {
        const actor = availableUsers.find((user) => user.id === state.actorId)
        const visible = (order: Record<string, any>) =>
          actor?.role === 'ADMIN' ||
          (order.status !== 'DRAFT' &&
            (actor?.role === 'SPV'
              ? order.assignedSpvId === actor.id
              : order.assignedMechanicId === actor?.id))
        const orders = [
          ...(state.order ? [state.order] : []),
          ...state.extraOrders,
        ]
        if (path === '/work-orders') {
          if (state.failList) {
            state.failList = false
            return json({ message: 'Server unavailable' }, 503)
          }
          return json(orders.filter(visible))
        }
        const order = orders.find((item) => path === `/work-orders/${item.id}`)
        if (!order || !visible(order))
          return json({ message: 'Not found' }, 404)
        return json({
          ...order,
          createdByUser: users[0],
          assignedSpv:
            availableUsers.find((user) => user.id === order.assignedSpvId) ??
            null,
          assignedMechanic:
            availableUsers.find(
              (user) => user.id === order.assignedMechanicId,
            ) ?? null,
          sparepartRequests: order.id === state.order?.id ? state.requests : [],
        })
      }
      const actor = state.actorId
      state.actorIds.push(actor)
      state.mutationCount++
      if (path === '/work-orders') {
        const body = req.postDataJSON()
        state.order = {
          id: randomUUID(),
          ...body,
          status: 'DRAFT',
          createdBy: actor,
          assignedMechanicId: null,
          assignedSpvId: null,
          startDate: null,
          endDate: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return json(state.order, 201)
      }
      if (path.endsWith('/submit')) {
        state.order!.status = 'SUBMITTED'
        state.order!.assignedSpvId = req.postDataJSON().spvId ?? users[1].id
        return json(state.order)
      }
      if (path.endsWith('/assign')) {
        state.order!.assignedMechanicId = req.postDataJSON().mechanicId
        state.order!.status = 'ASSIGNED'
        return json(state.order)
      }
      if (path.endsWith('/update')) {
        Object.assign(state.order!, req.postDataJSON(), {
          status: 'READY_TO_WORK',
        })
        return json(state.order)
      }
      if (path.endsWith('/request-sparepart')) {
        let body: {
          title?: string
          description?: string
          items: Array<{ name: string; qty: number; photoKey?: string }>
        }
        if (req.headers()['content-type'].startsWith('multipart/form-data')) {
          const parsed = await new Request(req.url(), {
            method: 'POST',
            headers: { 'content-type': req.headers()['content-type'] },
            body: req.postDataBuffer()!,
          }).formData()
          body = {
            title: parsed.get('title') as string,
            description: parsed.get('description') as string,
            items: JSON.parse(parsed.get('items') as string),
          }
          state.photoNames = [...parsed.keys()].filter((name) =>
            name.startsWith('photos.'),
          )
          for (const item of body.items) {
            if (item.photoKey)
              expect(parsed.get(`photos.${item.photoKey}`)).toBeTruthy()
          }
        } else body = req.postDataJSON()
        Object.assign(state.order!, {
          title: body.title,
          description: body.description,
          status: 'WAITING_SPAREPART_APPROVAL',
        })
        const id = randomUUID()
        const request = {
          id,
          status: 'PENDING',
          requestedByUser: users[0],
          approvedByUser: null,
          approvalNote: null,
          items: body.items.map((item) => {
            const itemId = randomUUID()
            return {
              ...item,
              id: itemId,
              imagePath: item.photoKey ? `spareparts/${itemId}.png` : null,
              imageUrl: item.photoKey
                ? `/api/sparepart-items/${itemId}/image`
                : null,
            }
          }),
        }
        state.requests = [request]
        return json({ workOrder: state.order, sparepartRequest: request }, 201)
      }
      if (path.endsWith('/approve')) {
        Object.assign(state.requests[0], {
          status: 'APPROVED',
          approvedByUser: users[1],
          approvalNote: req.postDataJSON().approvalNote,
        })
        state.order!.status = 'READY_TO_WORK'
        return json({
          workOrder: state.order,
          sparepartRequest: state.requests[0],
        })
      }
      if (path.endsWith('/start')) {
        Object.assign(state.order!, {
          status: 'WORKING',
          startDate: new Date().toISOString(),
        })
        return json(state.order)
      }
      if (path.endsWith('/complete')) {
        const { endDate } = req.postDataJSON()
        expect(Date.parse(endDate)).toBeGreaterThanOrEqual(
          Date.parse(state.order!.startDate),
        )
        Object.assign(state.order!, { status: 'COMPLETED', endDate })
        return json(state.order)
      }
      throw new Error(`Unexpected API request: ${req.method()} ${path}`)
    },
  )
  return state
}

async function closeDetail(page: Page) {
  await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click()
  await expect(page).toHaveURL(/\/work-orders$/)
}
async function acknowledgeSuccess(page: Page, title: string) {
  const popup = page.getByRole('dialog', { name: title, exact: true })
  await expect(popup).toBeVisible()
  await expect(
    page.locator('[role="dialog"]').filter({ hasText: 'Detail Work Order' }),
  ).toHaveCSS('filter', /blur/)
  await popup.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/work-orders$/)
}
async function selectActor(page: Page, index: number) {
  await loginAs(page, users[index].id)
  await page.getByRole('link', { name: /Lihat detail/ }).click()
}
async function loginAs(page: Page, id: string) {
  if (await page.getByRole('button', { name: 'Keluar', exact: true }).count())
    await page.getByRole('button', { name: 'Keluar', exact: true }).click()
  await page.getByLabel('Username', { exact: true }).fill(usernameFor(id))
  await page.getByLabel('Password', { exact: true }).fill(passwordFor(id))
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Keluar', exact: true }),
  ).toBeVisible()
}

test('requires login, reports bad credentials, restores sessions, and returns to login on expiry', async ({
  page,
}) => {
  const state = await mockApi(page, [], false)
  await page.goto('/work-orders')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Username', { exact: true }).fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Username atau password tidak sesuai.',
  )
  await page.getByLabel('Password', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Work Orders - Admin Panel',
      exact: true,
    }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Keluar', exact: true }),
  ).toBeVisible()
  state.actorId = null
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(0)
  await loginAs(page, users[2].id)
  await expect(
    page.getByRole('heading', {
      name: 'Work Orders - Mechanic Panel',
      exact: true,
    }),
  ).toBeVisible()
})

test('switches roles through a login popup and retains the old identity on cancel or invalid credentials', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.extraOrders = [
    {
      id: randomUUID(),
      title: 'Private draft',
      status: 'DRAFT',
      description: null,
      createdBy: users[0].id,
      assignedSpvId: null,
      assignedMechanicId: null,
      startDate: null,
      endDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  await page.goto('/work-orders')
  await page.getByLabel('Ganti role').selectOption('SPV')
  let popup = page.getByRole('dialog', {
    name: 'Login sebagai SPV',
    exact: true,
  })
  await expect(popup).toBeVisible()
  await popup.getByRole('button', { name: 'Batal', exact: true }).click()
  expect(state.actorId).toBe(users[0].id)
  await page.getByLabel('Ganti role').selectOption('SPV')
  popup = page.getByRole('dialog', { name: 'Login sebagai SPV', exact: true })
  await popup.getByLabel('Password', { exact: true }).fill('wrong')
  await popup.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(popup.getByRole('alert')).toContainText(
    'Username atau password tidak sesuai.',
  )
  expect(state.actorId).toBe(users[0].id)
  await popup.getByLabel('Username', { exact: true }).fill('admin')
  await popup.getByLabel('Password', { exact: true }).fill('admin123')
  await popup.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(popup.getByRole('alert')).toContainText(
    'Akun tidak sesuai role yang dipilih.',
  )
  expect(state.actorId).toBe(users[0].id)
  await popup.getByLabel('Username', { exact: true }).fill('spv')
  await popup.getByLabel('Password', { exact: true }).fill('spv123')
  await popup.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(popup).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Work Orders - SPV Panel', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Lihat detail Private draft', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByLabel('Ganti role')).toHaveValue('SPV')
  await expect(page).toHaveURL(/\/work-orders$/)
})

test('caps text inputs and shows current character counts on create, preparation and approval', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/work-orders')
  await page
    .getByRole('button', { name: 'Buat Work Order', exact: true })
    .click()
  const create = page.getByRole('dialog', {
    name: 'Buat Work Order',
    exact: true,
  })
  await expect(create.getByText('0/50 karakter', { exact: true })).toBeVisible()
  await expect(
    create.getByText('0/100 karakter', { exact: true }),
  ).toBeVisible()
  await page.getByLabel(/^Judul/).fill('t'.repeat(60))
  await expect(page.getByLabel(/^Judul/)).toHaveValue('t'.repeat(50))
  await expect(
    create.getByText('50/50 karakter', { exact: true }),
  ).toBeVisible()
  await page.getByLabel(/^Deskripsi/).fill('d'.repeat(120))
  await expect(page.getByLabel(/^Deskripsi/)).toHaveValue('d'.repeat(100))
  await expect(
    create.getByText('100/100 karakter', { exact: true }),
  ).toBeVisible()
  await create.getByRole('button', { name: 'Batal', exact: true }).click()
  await assignedOrder(page)
  await page.getByRole('radio', { name: 'Ya', exact: true }).check()
  await page
    .getByLabel('Nama sparepart 1', { exact: true })
    .fill('n'.repeat(40))
  await expect(
    page.getByLabel('Nama sparepart 1', { exact: true }),
  ).toHaveValue('n'.repeat(30))
  await expect(page.getByText('30/30 karakter', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Simpan & Ajukan Sparepart', exact: true })
    .click()
  await acknowledgeSuccess(page, 'Sukses mengajukan sparepart')
  await selectActor(page, 1)
  await page.getByLabel(/^Catatan persetujuan/).fill('a'.repeat(120))
  await expect(page.getByLabel(/^Catatan persetujuan/)).toHaveValue(
    'a'.repeat(100),
  )
  await expect(
    page.getByText('100/100 karakter', { exact: true }),
  ).toBeVisible()
})

test('paginates each role with 5, 10, or 20 rows while task totals cover the whole list', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.extraOrders = Array.from({ length: 12 }, (_, index) => ({
    id: randomUUID(),
    title: `WO pagination ${index + 1}`,
    description: null,
    status: 'READY_TO_WORK',
    createdBy: users[0].id,
    assignedSpvId: users[1].id,
    assignedMechanicId: users[2].id,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  await page.goto('/work-orders')
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(5)
  await page
    .getByRole('button', { name: 'Halaman berikutnya', exact: true })
    .click()
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible()
  await page.getByLabel('Data per halaman').selectOption('10')
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(10)
  await page.getByLabel('Data per halaman').selectOption('20')
  await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(12)
  await expect(
    page.getByRole('button', { name: 'Halaman berikutnya', exact: true }),
  ).toBeDisabled()
  for (const user of [users[1], users[2]]) {
    await loginAs(page, user.id)
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(
      5,
    )
    await page
      .getByRole('button', { name: 'Halaman berikutnya', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Halaman berikutnya', exact: true })
      .click()
    await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(
      2,
    )
    if (user.role === 'MECHANIC')
      await expect(
        page.getByRole('status', { name: 'Ringkasan tugas Work Order' }),
      ).toContainText('12 WO siap dikerjakan')
  }
  state.extraOrders = []
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click()
  await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Halaman sebelumnya', exact: true }),
  ).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
async function assignedOrder(page: Page) {
  await page.goto('/work-orders')
  await page
    .getByRole('button', { name: 'Buat Work Order', exact: true })
    .click()
  await page.getByLabel(/^Judul/).fill('Perbaikan rem belakang')
  await page.getByLabel(/^Deskripsi/).fill('Rem kurang responsif')
  await page
    .getByRole('dialog', { name: 'Buat Work Order', exact: true })
    .getByRole('button', { name: 'Buat Work Order', exact: true })
    .click()
  const success = page.getByRole('dialog', {
    name: 'Sukses membuat Draft WO',
    exact: true,
  })
  await expect(success).toBeVisible()
  await expect(
    page.locator('[role="dialog"]').filter({ hasText: 'Detail Work Order' }),
  ).toHaveCSS('filter', /blur/)
  await success.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/work-orders$/)
  await page
    .getByRole('link', {
      name: 'Lihat detail Perbaikan rem belakang',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Submit Work Order' }).click()
  await acknowledgeSuccess(page, 'Sukses mengirim WO ke SPV')
  await selectActor(page, 1)
  await expect(
    page.getByRole('button', { name: 'Selesaikan Work Order' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Tugaskan Mechanic' }).click()
  await expect(page.getByLabel('Pilih mechanic')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(
    page.getByText('Pilih mechanic yang akan ditugaskan.'),
  ).toBeVisible()
  await page.getByLabel('Pilih mechanic').selectOption(users[2].id)
  await page.getByRole('button', { name: 'Tugaskan Mechanic' }).click()
  await acknowledgeSuccess(page, 'Sukses menugaskan Mechanic')
  await selectActor(page, 0)
  await expect(
    page.getByRole('heading', { name: 'Persiapan Work Order', exact: true }),
  ).toBeVisible()
}

test('completes the no-sparepart path with the correct roles and route-backed detail', async ({
  page,
}) => {
  const state = await mockApi(page)
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  await assignedOrder(page)
  await page.getByRole('radio', { name: 'Tidak', exact: true }).check()
  await page.getByRole('button', { name: 'Simpan Persiapan' }).click()
  await acknowledgeSuccess(page, 'Sukses menyimpan persiapan WO')
  await selectActor(page, 2)
  await page.getByRole('button', { name: 'Mulai Bekerja', exact: true }).click()
  await acknowledgeSuccess(page, 'Sukses memulai pekerjaan')
  await page.getByRole('link', { name: /Lihat detail/ }).click()
  await expect(
    page.getByRole('button', { name: 'Selesaikan Work Order' }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Detail Work Order', exact: true }),
  ).toBeVisible()
  await closeDetail(page)
  await selectActor(page, 0)
  const completion = page.getByLabel('Waktu selesai (waktu lokal)')
  const validEndDate = await completion.inputValue()
  await completion.fill('2000-01-01T00:00')
  await page
    .getByRole('button', { name: 'Selesaikan Work Order', exact: true })
    .click()
  await expect(completion).toHaveAttribute('aria-invalid', 'true')
  await expect(
    page.getByText(
      'Waktu selesai wajib valid dan tidak boleh lebih awal dari waktu mulai.',
    ),
  ).toBeVisible()
  await completion.fill(validEndDate)
  await page
    .getByRole('button', { name: 'Selesaikan Work Order', exact: true })
    .click()
  await acknowledgeSuccess(page, 'Sukses menyelesaikan Work Order')
  await page.getByRole('link', { name: /Lihat detail/ }).click()
  await expect(
    page.getByRole('dialog').getByText('Status : Selesai', { exact: true }),
  ).toBeVisible()
  expect(state.order!.status).toBe('COMPLETED')
  expect(state.requests).toHaveLength(0)
  expect(state.actorIds).toEqual([
    users[0].id,
    users[0].id,
    users[1].id,
    users[0].id,
    users[2].id,
    users[0].id,
  ])
  expect(errors).toEqual([])
})

test('submits mixed photo items and lets SPV preview and approve before mechanic starts', async ({
  page,
}) => {
  const state = await mockApi(page)
  await assignedOrder(page)
  await page.getByRole('radio', { name: 'Ya', exact: true }).check()
  await page.getByLabel('Nama sparepart 1', { exact: true }).fill('Kampas rem')
  await page.getByLabel('Jumlah 1', { exact: true }).fill('2')
  await page
    .getByLabel('Foto Kampas rem', { exact: true })
    .setInputFiles({ name: 'pad.png', mimeType: 'image/png', buffer: pixel })
  await page.getByRole('button', { name: 'Tambah item', exact: true }).click()
  await page.getByLabel('Nama sparepart 2', { exact: true }).fill('Minyak rem')
  await page
    .getByRole('button', { name: 'Simpan & Ajukan Sparepart', exact: true })
    .click()
  await acknowledgeSuccess(page, 'Sukses mengajukan sparepart')
  await page.getByRole('link', { name: /Lihat detail/ }).click()
  await expect(page.getByText('Tanpa foto', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Setujui Pengajuan' }),
  ).toHaveCount(0)
  expect(state.photoNames).toHaveLength(1)
  await closeDetail(page)
  await selectActor(page, 1)
  await page
    .getByRole('button', { name: 'Lihat foto Kampas rem', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Foto sparepart', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Kembali ke detail' }).click()
  await expect(
    page.getByRole('heading', { name: 'Detail Work Order', exact: true }),
  ).toBeVisible()
  await page
    .getByLabel(/^Catatan persetujuan/)
    .fill('Sesuai kebutuhan perbaikan')
  await page.getByRole('button', { name: 'Setujui Pengajuan' }).click()
  await acknowledgeSuccess(page, 'Sukses menyetujui pengajuan sparepart')
  await page.getByRole('link', { name: /Lihat detail/ }).click()
  await expect(page.getByText('Disetujui oleh SPV Demo')).toBeVisible()
  await closeDetail(page)
  await selectActor(page, 2)
  await page.getByRole('button', { name: 'Mulai Bekerja', exact: true }).click()
  await acknowledgeSuccess(page, 'Sukses memulai pekerjaan')
  await selectActor(page, 0)
  await page
    .getByRole('button', { name: 'Selesaikan Work Order', exact: true })
    .click()
  await acknowledgeSuccess(page, 'Sukses menyelesaikan Work Order')
  await page.getByRole('link', { name: /Lihat detail/ }).click()
  await expect(
    page.getByRole('dialog').getByText('Status : Selesai', { exact: true }),
  ).toBeVisible()
  expect(state.order!.status).toBe('COMPLETED')
})

test('validates preparation and photo size before sending a request, preserving the draft', async ({
  page,
}) => {
  const state = await mockApi(page)
  await assignedOrder(page)
  await page.getByRole('button', { name: 'Simpan Persiapan' }).click()
  await expect(
    page.getByText('Pilih apakah pekerjaan membutuhkan sparepart.'),
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Ya', exact: true }).check()
  await page.getByLabel('Nama sparepart 1', { exact: true }).fill('Kampas rem')
  await page.getByLabel('Foto Kampas rem', { exact: true }).setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  })
  await expect(
    page.getByText(/Gunakan foto JPG\/PNG maksimal 2 MB/),
  ).toBeVisible()
  expect(state.mutationCount).toBe(3)
  await expect(
    page.getByLabel('Nama sparepart 1', { exact: true }),
  ).toHaveValue('Kampas rem')
})

test('shows an actionable retry when loading the list fails', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.failList = true
  await page.goto('/work-orders')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Belum ada Work Order', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('shows role panel titles and only the current user assignments, including multiple SPVs', async ({
  page,
}) => {
  const otherSpv = {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Other SPV',
    role: 'SPV',
  }
  const otherMechanic = {
    id: '00000000-0000-4000-8000-000000000005',
    name: 'Other Mechanic',
    role: 'MECHANIC',
  }
  const state = await mockApi(page, [otherSpv, otherMechanic])
  function fixture(
    title: string,
    status: string,
    assignedSpvId: string | null,
    assignedMechanicId: string | null,
  ) {
    return {
      id: randomUUID(),
      title,
      description: null,
      status,
      assignedSpvId,
      assignedMechanicId,
      createdBy: users[0].id,
      startDate: null,
      endDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const draft = fixture('Admin draft', 'DRAFT', null, null)
  const own = fixture('Own assignment', 'ASSIGNED', users[1].id, users[2].id)
  const other = fixture(
    'Other assignment',
    'ASSIGNED',
    otherSpv.id,
    otherMechanic.id,
  )
  const submitted = fixture('Own submitted', 'SUBMITTED', users[1].id, null)
  const submittedOther = fixture(
    'Other submitted',
    'SUBMITTED',
    otherSpv.id,
    null,
  )
  state.order = draft
  state.extraOrders = [own, other, submitted, submittedOther]
  await page.goto('/work-orders')
  await expect(
    page.getByRole('heading', {
      name: 'Work Orders - Admin Panel',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(5)
  await expect(
    page.getByRole('status', { name: 'Ringkasan tugas Work Order' }),
  ).toContainText('Ada 3 WO yang memerlukan perhatian Anda.')
  await loginAs(page, users[1].id)
  await expect(
    page.getByRole('heading', { name: 'Work Orders - SPV Panel', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(2)
  await expect(
    page.getByRole('status', { name: 'Ringkasan tugas Work Order' }),
  ).toContainText('1 WO menunggu penugasan mechanic')
  await expect(
    page.getByRole('link', { name: 'Lihat detail Admin draft', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', {
      name: 'Lihat detail Other assignment',
      exact: true,
    }),
  ).toHaveCount(0)
  await page.goto('/work-orders/' + draft.id)
  await expect(page.getByRole('alert')).toContainText('Data tidak ditemukan')
  await closeDetail(page)
  await loginAs(page, users[2].id)
  await expect(
    page.getByRole('heading', {
      name: 'Work Orders - Mechanic Panel',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(1)
  await expect(
    page.getByRole('status', { name: 'Ringkasan tugas Work Order' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', {
      name: 'Lihat detail Own assignment',
      exact: true,
    }),
  ).toBeVisible()
  await page.goto('/work-orders/' + other.id)
  await expect(page.getByRole('alert')).toContainText('Data tidak ditemukan')
  await closeDetail(page)
  await loginAs(page, otherSpv.id)
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(2)
  await expect(
    page.getByRole('link', {
      name: 'Lihat detail Other assignment',
      exact: true,
    }),
  ).toBeVisible()
  await loginAs(page, users[0].id)
  await page
    .getByRole('link', { name: 'Lihat detail Admin draft', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Submit Work Order', exact: true })
    .click()
  await expect(page.getByLabel('SPV tujuan')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByLabel('SPV tujuan').selectOption(otherSpv.id)
  await page
    .getByRole('button', { name: 'Submit Work Order', exact: true })
    .click()
  await acknowledgeSuccess(page, 'Sukses mengirim WO ke SPV')
  expect(state.order!.assignedSpvId).toBe(otherSpv.id)
  await loginAs(page, otherSpv.id)
  await expect(page.getByRole('link', { name: /Lihat detail/ })).toHaveCount(3)
})

test('closes the success popup and blurred detail together using button, X, or Escape', async ({
  page,
}, testInfo) => {
  const state = await mockApi(page)
  await page.goto('/work-orders')
  for (const method of ['button', 'close-icon', 'escape']) {
    await page
      .getByRole('button', { name: 'Buat Work Order', exact: true })
      .click()
    await page.getByLabel(/^Judul/).fill(`Draft popup ${method}`)
    await page
      .getByRole('dialog', { name: 'Buat Work Order', exact: true })
      .getByRole('button', { name: 'Buat Work Order', exact: true })
      .click()
    const popup = page.getByRole('dialog', {
      name: 'Sukses membuat Draft WO',
      exact: true,
    })
    await expect(popup).toBeVisible()
    const detail = page
      .locator('[role="dialog"]')
      .filter({ hasText: 'Detail Work Order' })
    await expect(detail).toContainText(`Draft popup ${method}`)
    await expect(detail).toHaveCSS('filter', /blur/)
    if (method === 'button') {
      await page.screenshot({ path: testInfo.outputPath('draft-success.png') })
      await popup.getByRole('button', { name: 'Tutup', exact: true }).click()
    } else if (method === 'close-icon')
      await popup
        .getByRole('button', { name: 'Tutup dialog', exact: true })
        .click()
    else await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/work-orders$/)
    await expect(
      page.getByRole('link', {
        name: `Lihat detail Draft popup ${method}`,
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Submit Work Order', exact: true }),
    ).toHaveCount(0)
  }
  expect(state.mutationCount).toBe(3)
  await page
    .getByRole('link', { name: 'Lihat detail Draft popup escape', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Sukses membuat Draft WO', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Submit Work Order', exact: true }),
  ).toBeVisible()
})

test('shakes a single invalid title and places its message directly below the field', async ({
  page,
}, testInfo) => {
  const state = await mockApi(page)
  await page.goto('/work-orders')
  await page
    .getByRole('button', { name: 'Buat Work Order', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Buat Work Order',
    exact: true,
  })
  const submit = dialog.getByRole('button', {
    name: 'Buat Work Order',
    exact: true,
  })
  const title = dialog.getByLabel(/^Judul/)
  await submit.click()
  await expect(title).toHaveAttribute('aria-invalid', 'true')
  await expect(title).toHaveCSS('border-color', 'rgb(196, 59, 59)')
  await expect(title).toHaveCSS('animation-name', 'field-shake-a')
  await expect(title).toHaveAttribute('aria-describedby', 'wo-title-error wo-title-count')
  await expect(dialog.locator('#wo-title-error')).toHaveText(
    'Judul Work Order wajib diisi.',
  )
  await expect(
    dialog.getByText('Harap lengkapi Form terlebih dahulu.', { exact: true }),
  ).toHaveCount(0)
  await expect(dialog.getByLabel(/^Deskripsi/)).not.toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await submit.click()
  await expect(title).toHaveCSS('animation-name', 'field-shake-b')
  await page.screenshot({ path: testInfo.outputPath('single-field-error.png') })
  await title.fill('Judul sudah lengkap')
  await expect(title).toHaveAttribute('aria-invalid', 'false')
  await expect(dialog.locator('#wo-title-error')).toHaveCount(0)
  expect(state.mutationCount).toBe(0)
})

test('marks multiple invalid fields without shaking and shows only the general message', async ({
  page,
}, testInfo) => {
  const state = await mockApi(page)
  await assignedOrder(page)
  const title = page.getByLabel(/^Judul/)
  await title.fill('')
  await page
    .getByRole('button', { name: 'Simpan Persiapan', exact: true })
    .click()
  await expect(title).toHaveAttribute('aria-invalid', 'true')
  await expect(title).toHaveCSS('animation-name', 'none')
  await expect(page.locator('#needs-spareparts')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(page.locator('#needs-spareparts')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(page.getByRole('alert')).toHaveText(
    'Harap lengkapi Form terlebih dahulu.',
  )
  await expect(page.locator('#wo-title-error')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Ya', exact: true }).check()
  await title.fill('Perbaikan rem belakang')
  await page.getByLabel('Jumlah 1', { exact: true }).fill('0')
  await page
    .getByRole('button', { name: 'Simpan & Ajukan Sparepart', exact: true })
    .click()
  const name = page.getByLabel('Nama sparepart 1', { exact: true })
  const qty = page.getByLabel('Jumlah 1', { exact: true })
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(qty).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveCSS('animation-name', 'none')
  await expect(qty).toHaveCSS('animation-name', 'none')
  await expect(page.getByRole('alert')).toHaveText(
    'Harap lengkapi Form terlebih dahulu.',
  )
  await page.screenshot({
    path: testInfo.outputPath('multiple-field-errors.png'),
  })
  await name.fill('Kampas rem')
  await page
    .getByRole('button', { name: 'Simpan & Ajukan Sparepart', exact: true })
    .click()
  await expect(qty).toHaveCSS('animation-name', /field-shake-/)
  await expect(page.getByRole('alert')).toHaveText(
    'Jumlah harus berupa bilangan bulat antara 1 dan 2147483647.',
  )
  expect(state.mutationCount).toBe(3)
})

test('keeps the main page within the mobile viewport and provides an accessible create dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await page.goto('/work-orders')
  await page
    .getByRole('button', { name: 'Buat Work Order', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Buat Work Order', exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('dialog', { name: 'Buat Work Order', exact: true })
      .getByRole('button', { name: 'Buat Work Order', exact: true }),
  ).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
