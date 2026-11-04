import { characterCount } from '../../lib/text-limits'
import { cn } from '../../lib/utils'
export function CharacterCount({
  fieldId,
  value,
  maximum,
}: {
  fieldId: string
  value: string
  maximum: number
}) {
  const count = characterCount(value)
  return (
    <p
      id={`${fieldId}-count`}
      className={cn(
        'mt-1 text-right text-xs tabular-nums text-muted-foreground',
        count > maximum && 'text-destructive',
      )}
    >
      {count}/{maximum} karakter
    </p>
  )
}
