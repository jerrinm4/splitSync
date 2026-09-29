export function receiptPath(value: string, tripId: string, supabaseUrl: string): string {
  let path = value
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    const prefix = '/storage/v1/object/public/receipts/'
    if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith(prefix)) {
      throw new Error('This receipt needs to be uploaded again by a trip admin.')
    }
    path = decodeURIComponent(url.pathname.slice(prefix.length))
  }
  const hasControlCharacter = Array.from(path).some(character => character.charCodeAt(0) < 32)
  const parts = path.split('/')
  if (parts.length !== 2 || parts[0] !== tripId || !parts[1] || /[\\?#]/.test(path) || hasControlCharacter || parts.some(part => part === '.' || part === '..')) {
    throw new Error('This receipt needs to be uploaded again by a trip admin.')
  }
  return path
}
