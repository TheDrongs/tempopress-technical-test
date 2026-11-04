import { describe, expect, it } from 'vitest'
import { preparationBody } from '../src/work-orders/api/work-order.api'
import type { PreparationInput } from '../src/work-orders/work-order.types'

describe('Sparepart request transport', () => {
  it('keeps requests without photos in the existing JSON contract', () => {
    const input: PreparationInput = {
      title: ' Repair ',
      description: null,
      needsSpareparts: true,
      items: [{ key: 'fluid', name: ' Fluid ', qty: '2', file: null }],
    }
    expect(preparationBody(input)).toEqual({
      title: 'Repair',
      description: null,
      items: [{ name: 'Fluid', qty: 2 }],
    })
  })

  it('pairs each file with its stable item key, including reordered and photo-less items', async () => {
    const pad = new File(['pad-bytes'], 'pad.png', { type: 'image/png' })
    const rotor = new File(['rotor-bytes'], 'rotor.jpg', { type: 'image/jpeg' })
    const form = preparationBody({
      title: 'Repair',
      description: null,
      needsSpareparts: true,
      items: [
        { key: 'rotor-key', name: 'Rotor', qty: '1', file: rotor },
        { key: 'fluid-key', name: 'Fluid', qty: '1', file: null },
        { key: 'pad-key', name: 'Pad', qty: '2', file: pad },
      ],
    }) as FormData
    expect(JSON.parse(form.get('items') as string)).toEqual([
      { name: 'Rotor', qty: 1, photoKey: 'rotor-key' },
      { name: 'Fluid', qty: 1 },
      { name: 'Pad', qty: 2, photoKey: 'pad-key' },
    ])
    expect(await (form.get('photos.pad-key') as File).text()).toBe('pad-bytes')
    expect(await (form.get('photos.rotor-key') as File).text()).toBe(
      'rotor-bytes',
    )
    expect(form.has('photos.fluid-key')).toBe(false)
    expect(form.get('description')).toBe('')
  })
})
