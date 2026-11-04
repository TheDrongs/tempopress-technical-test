import { useLayoutEffect, useRef, useState } from 'react'

export type FieldIssues = Record<string, string>

export function useFormValidation() {
  const [issues, setIssues] = useState<FieldIssues>({})
  const [attempt, setAttempt] = useState(0)
  const [shakingField, setShakingField] = useState<string | null>(null)
  const focusField = useRef<string | null>(null)
  const count = Object.keys(issues).length

  useLayoutEffect(() => {
    if (!focusField.current) return
    const field = document.getElementById(focusField.current)
    focusField.current = null
    const input = field?.matches('input,select,textarea,button')
      ? field
      : field?.querySelector<HTMLElement>('input,select,textarea,button')
    input?.focus({ preventScroll: true })
    field?.scrollIntoView({ block: 'nearest' })
  }, [attempt])

  function report(next: FieldIssues): boolean {
    const fields = Object.keys(next)
    setIssues(next)
    setShakingField(fields.length === 1 ? fields[0] : null)
    focusField.current = fields[0] ?? null
    setAttempt((current) => current + 1)
    return fields.length === 0
  }

  function clear(...fields: string[]) {
    setIssues((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !fields.includes(key)),
      ),
    )
    if (shakingField && fields.includes(shakingField)) setShakingField(null)
  }

  function fieldProps(id: string) {
    return {
      'aria-invalid': Boolean(issues[id]),
      'aria-describedby': count === 1 && issues[id] ? `${id}-error` : undefined,
      className:
        shakingField === id && issues[id]
          ? attempt % 2
            ? 'animate-field-shake-a'
            : 'animate-field-shake-b'
          : undefined,
    }
  }

  return {
    issues,
    report,
    clear,
    fieldProps,
    count,
    inlineMessage: (id: string) => (count === 1 ? issues[id] : undefined),
    generalMessage: count > 1 ? 'Harap lengkapi Form terlebih dahulu.' : null,
  }
}

export type FormValidation = ReturnType<typeof useFormValidation>
