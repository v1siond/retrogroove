interface MoneyProps {
  value: number
  prefix?: string
}

export function Money({ value, prefix }: MoneyProps) {
  const formatted = `S/ ${value.toFixed(2)}`
  const display = prefix ? `${prefix} ${formatted}` : formatted
  return <span>{display}</span>
}
