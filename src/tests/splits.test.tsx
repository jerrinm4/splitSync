import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SplitSelector, type SplitSelectorRef } from '../components/expenses/SplitSelector'

it('preserves manual shares and rejects an over-allocation when another share is automatic', async () => {
  const ref = createRef<SplitSelectorRef>()
  render(<SplitSelector ref={ref} title="Shares" amountPaise={10000} currency="INR"
    members={[{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }]}
    initialSplits={[{ member_id: 'a', amount_paise: 5000 }, { member_id: 'b', amount_paise: 5000 }]}
    initialSplitMethod="CUSTOM" />)
  await waitFor(() => expect(ref.current?.isAllAuto()).toBe(false))
  expect(ref.current?.getSplits()).toEqual([{ memberId: 'a', amountPaise: 5000 }, { memberId: 'b', amountPaise: 5000 }])
  fireEvent.click(screen.getByRole('switch', { name: 'Auto-split for Bob in Shares' }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Amount for Alice in Shares' }), { target: { value: '101' } })
  expect(() => ref.current?.validate(10000)).toThrow(/don't match/)
})
