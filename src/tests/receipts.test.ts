import { expect, it } from 'vitest'
import { receiptPath } from '../lib/receipts'

it('keeps storage paths and recognizes existing public URLs from this project', () => {
  expect(receiptPath('trip/receipt.png', 'trip', 'https://demo.supabase.co')).toBe('trip/receipt.png')
  expect(receiptPath('https://demo.supabase.co/storage/v1/object/public/receipts/trip/receipt%20one.png', 'trip', 'https://demo.supabase.co')).toBe('trip/receipt one.png')
})

it.each(['other/receipt.png', 'trip/../secret', 'trip/..', 'trip/file?token=secret', 'https://untrusted.test/image.png', 'https://demo.supabase.co/storage/v1/object/public/receipts/other/image.png'])('rejects an unsafe receipt reference: %s', value => {
  expect(() => receiptPath(value, 'trip', 'https://demo.supabase.co')).toThrow(/uploaded again/)
})
