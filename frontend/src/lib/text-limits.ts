export const TEXT_LIMITS = {
  title: 50,
  description: 100,
  sparepartName: 30,
  approvalNote: 100,
} as const

// Match validator.js MaxLength, including surrogate pairs and variation selectors.
export function characterCount(value: string): number {
  const presentations =
    value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)?.length ?? 0
  const pairs = value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0
  return value.length - presentations - pairs
}
export function limitText(value: string, maximum: number): string {
  let result = ''
  for (const symbol of value) {
    if (characterCount(result + symbol) > maximum) break
    result += symbol
  }
  return result
}
