import { describe, it, expect } from 'vitest'
import { characterCount, limitText } from '../src/lib/text-limits'
describe('text limits', () => {
  it('caps pasted strings without splitting emoji and matches displayed counts', () => {
    expect(limitText('a'.repeat(51), 50)).toBe('a'.repeat(50))
    const result = limitText('😀'.repeat(51), 50)
    expect(result).toBe('😀'.repeat(50))
    expect(characterCount(result)).toBe(50)
  })
  it('counts variation-selector presentation sequences like backend validation', () => {
    expect(characterCount('❤️')).toBe(1)
    expect(characterCount('')).toBe(0)
    expect(limitText('❤️'.repeat(31), 30)).toBe('❤️'.repeat(30))
  })
})
