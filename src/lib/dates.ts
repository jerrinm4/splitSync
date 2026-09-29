import { format, parseISO } from 'date-fns'

// Calendar dates must not pass through UTC: local midnight can be the previous UTC day.
export function toDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function fromDateOnly(value: string): Date {
  return parseISO(value.slice(0, 10))
}
