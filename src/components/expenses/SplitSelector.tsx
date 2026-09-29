import React, { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { SplitSquareHorizontal, Pencil, CheckCircle2, Link2, Info, Users } from 'lucide-react'
import { parseMoneyToPaise, formatMoney, calculateSmartSplits } from '@/lib/money'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

export interface SplitSelectorRef {
  getSplits: () => { memberId: string; amountPaise: number }[];
  isAllAuto: () => boolean;
  validate: (totalPaise: number) => void;
}

interface SplitSelectorProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  amountPaise: number;
  currency: string;
  members: any[];
  groups?: any[];
  initialSplits?: { member_id: string; amount_paise: number }[];
  initialSplitMethod?: 'EQUAL' | 'CUSTOM';
  showGroups?: boolean;
}

export const SplitSelector = forwardRef<SplitSelectorRef, SplitSelectorProps>(({
  title,
  icon,
  amountPaise,
  currency,
  members,
  groups = [],
  initialSplits = [],
  initialSplitMethod = 'EQUAL',
  showGroups = false
}, ref) => {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(() => new Set(initialSplits.map(split => split.member_id)))
  const [autoSplitMembers, setAutoSplitMembers] = useState<Set<string>>(() => new Set(initialSplitMethod === 'EQUAL' ? initialSplits.map(split => split.member_id) : []))
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(() => initialSplitMethod === 'CUSTOM'
    ? Object.fromEntries(initialSplits.map(split => [split.member_id, (split.amount_paise / 100).toFixed(2)])) : {})

  const smartSplits = useMemo(() => {
    if (amountPaise <= 0 || selectedMembers.size === 0) return []

    const lockedAmounts: Record<string, number> = {}
    selectedMembers.forEach(id => {
      if (!autoSplitMembers.has(id) && manualAmounts[id]) {
        lockedAmounts[id] = parseMoneyToPaise(manualAmounts[id])
      }
    })

    const autoIds = Array.from(selectedMembers).filter(id => autoSplitMembers.has(id))
    return calculateSmartSplits(amountPaise, lockedAmounts, autoIds)
  }, [amountPaise, selectedMembers, autoSplitMembers, manualAmounts])

  const splitTotalPaise = useMemo(() => {
    return smartSplits.reduce((sum, s) => sum + s.amountPaise, 0)
  }, [smartSplits])

  const hasRemainder = useMemo(() => {
    const autoSplits = smartSplits.filter(s => autoSplitMembers.has(s.memberId))
    if (autoSplits.length <= 1) return false
    const firstAmount = autoSplits[0]?.amountPaise
    return autoSplits.some(s => s.amountPaise !== firstAmount)
  }, [smartSplits, autoSplitMembers])

  const isAllAuto = useMemo(() => {
    if (selectedMembers.size === 0) return true
    return Array.from(selectedMembers).every(id => autoSplitMembers.has(id))
  }, [selectedMembers, autoSplitMembers])

  const handleManualAmountChange = useCallback((memberId: string, value: string) => {
    setAutoSplitMembers(prev => {
      const next = new Set(prev)
      next.delete(memberId)
      return next
    })
    setManualAmounts(prev => ({ ...prev, [memberId]: value }))
  }, [])

  const handleAutoToggle = useCallback((memberId: string, autoOn: boolean) => {
    if (autoOn) {
      setAutoSplitMembers(prev => new Set(prev).add(memberId))
      setManualAmounts(prev => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
    } else {
      const currentSplit = smartSplits.find(s => s.memberId === memberId)
      setAutoSplitMembers(prev => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      if (currentSplit) {
        setManualAmounts(prev => ({
          ...prev,
          [memberId]: (currentSplit.amountPaise / 100).toFixed(2)
        }))
      }
    }
  }, [smartSplits])

  const handleMemberToggle = useCallback((memberId: string, included: boolean) => {
    if (included) {
      setSelectedMembers(prev => new Set(prev).add(memberId))
      setAutoSplitMembers(prev => new Set(prev).add(memberId))
      setManualAmounts(prev => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
    } else {
      setSelectedMembers(prev => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      setAutoSplitMembers(prev => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      setManualAmounts(prev => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
    }
  }, [])

  const handleGroupToggle = useCallback((group: any) => {
    setSelectedMembers(prevSelected => {
      const nextSelected = new Set(prevSelected)
      const allSelected = group.member_ids.every((id: string) => nextSelected.has(id))

      if (allSelected) {
        group.member_ids.forEach((id: string) => nextSelected.delete(id))
      } else {
        group.member_ids.forEach((id: string) => nextSelected.add(id))
      }
      return nextSelected
    })

    setAutoSplitMembers(prevAuto => {
      const nextSelected = new Set(selectedMembers)
      const allSelected = group.member_ids.every((id: string) => nextSelected.has(id))

      const nextAuto = new Set(prevAuto)
      if (allSelected) {
        group.member_ids.forEach((id: string) => nextAuto.delete(id))
      } else {
        group.member_ids.forEach((id: string) => nextAuto.add(id))
      }
      return nextAuto
    })
  }, [selectedMembers])

  const handleResetEqual = useCallback(() => {
    setAutoSplitMembers(new Set(selectedMembers))
    setManualAmounts({})
  }, [selectedMembers])

  const handleSetAllCustom = useCallback(() => {
    const amounts: Record<string, string> = {}
    smartSplits.forEach(s => {
      if (selectedMembers.has(s.memberId)) {
        amounts[s.memberId] = (s.amountPaise / 100).toFixed(2)
      }
    })
    setAutoSplitMembers(new Set())
    setManualAmounts(amounts)
  }, [smartSplits, selectedMembers])

  useImperativeHandle(ref, () => ({
    getSplits: () => smartSplits.filter(s => s.amountPaise > 0),
    isAllAuto: () => isAllAuto,
    validate: (expectedTotal: number) => {
      if (selectedMembers.size === 0) {
        throw new Error(`At least one member must be selected for ${title}.`)
      }
      const splitsToUse = smartSplits.filter(s => s.amountPaise > 0)
      const splitsTotal = splitsToUse.reduce((sum, s) => sum + s.amountPaise, 0)
      if (Array.from(selectedMembers).some(id => !autoSplitMembers.has(id) && parseMoneyToPaise(manualAmounts[id] || '') <= 0)) {
        throw new Error('Enter a positive amount with at most two decimal places for each custom share.')
      }
      if (splitsTotal !== expectedTotal) {
        throw new Error(`Amounts for ${title} (${formatMoney(splitsTotal, currency)}) don't match the total (${formatMoney(expectedTotal, currency)}). Adjust amounts or turn on auto-split for at least one member.`)
      }
    }
  }), [smartSplits, isAllAuto, selectedMembers, autoSplitMembers, manualAmounts, title, currency])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
          {icon || <SplitSquareHorizontal className="w-4 h-4" />} {title}
        </span>
        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
          splitTotalPaise === amountPaise
            ? 'bg-green-500/20 text-green-800 dark:text-green-300'
            : 'bg-destructive/20 text-destructive'
        }`}>
          {formatMoney(splitTotalPaise, currency)} / {formatMoney(amountPaise, currency)}
        </div>
      </div>

      <div className="relative flex w-full h-11 bg-muted/30 rounded-xl p-1 overflow-hidden backdrop-blur-sm border border-border/30">
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background shadow-md rounded-lg transition-transform duration-300 ease-in-out border border-border/50"
          style={{ transform: `translateX(${isAllAuto ? '0' : '100%'})`, marginLeft: isAllAuto ? '0' : '8px' }}
        />
        <button
          type="button"
          className={`relative flex-1 flex items-center justify-center text-sm font-bold z-10 transition-colors ${isAllAuto ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
          onClick={handleResetEqual}
        >
          <SplitSquareHorizontal className="w-4 h-4 mr-2" /> Equally
        </button>
        <button
          type="button"
          className={`relative flex-1 flex items-center justify-center text-sm font-bold z-10 transition-colors ${!isAllAuto ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
          onClick={handleSetAllCustom}
        >
          <Pencil className="w-4 h-4 mr-2" /> Custom
        </button>
      </div>

      <div className="bg-background/30 rounded-xl p-2 border border-border/30 space-y-1">
        {showGroups && groups.length > 0 && (
          <div className="pb-3 mb-2 border-b border-border/50">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-1 flex items-center">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Quick Select Groups
            </div>
            <div className="flex flex-wrap gap-2 px-1">
              {groups.map((group: any) => {
                const allSelected = group.member_ids.length > 0 && group.member_ids.every((id: string) => selectedMembers.has(id));
                return (
                  <div
                    key={group.id}
                    onClick={() => handleGroupToggle(group)}
                    className={`flex items-center text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all border ${
                      allSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-95'
                        : 'bg-background hover:bg-secondary/80 text-foreground border-border/60 shadow-sm hover:scale-95'
                    }`}
                    title={allSelected ? "Deselect group" : "Select group"}
                  >
                    <span className="font-semibold">{group.name}</span>
                    <span className=" ml-1 text-[10px]">({group.member_ids?.length || 0})</span>
                    {allSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 opacity-90" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {members.map((member: any) => {
          const isSelected = selectedMembers.has(member.id)
          const isAuto = autoSplitMembers.has(member.id)
          const splitData = smartSplits.find(s => s.memberId === member.id)
          const displayAmount = splitData?.amountPaise || 0

          return (
            <div
              key={member.id}
              className={`rounded-lg transition-all duration-200 ${
                isSelected
                  ? 'bg-background shadow-sm border border-border/50'
                  : 'border border-transparent '
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                <Checkbox
                  aria-label={`Include ${member.name} in ${title}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleMemberToggle(member.id, !!checked)}
                  className="w-5 h-5 rounded-md shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm truncate block">
                    {member.name}
                    {member.status === 'INACTIVE' && (
                      <span className="text-[10px] text-muted-foreground ml-1">(Inactive)</span>
                    )}
                  </span>
                  {isSelected && (
                    <span className={`text-[10px] font-medium flex items-center gap-1 mt-0.5 transition-colors ${
                      isAuto ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'
                    }`}>
                      {isAuto ? (
                        <><Link2 className="w-3 h-3" /> Auto-split</>
                      ) : (
                        <><Pencil className="w-3 h-3" /> Manual</>
                      )}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Switch
                    aria-label={`Auto-split for ${member.name} in ${title}`}
                    checked={isAuto}
                    onCheckedChange={(checked) => handleAutoToggle(member.id, checked)}
                    className="shrink-0 data-[state=checked]:bg-green-500"
                  />
                )}

                {isSelected && isAuto && (
                  <span className="font-bold text-sm text-primary tabular-nums w-24 text-right shrink-0">
                    {formatMoney(displayAmount, currency)}
                  </span>
                )}
                {isSelected && !isAuto && (
                  <div className="relative w-24 shrink-0 group">
                    <span className="absolute left-2 top-2 text-muted-foreground text-xs font-medium group-focus-within:text-primary transition-colors">₹</span>
                    <Input
                      aria-label={`Amount for ${member.name} in ${title}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-6 h-8 text-sm font-bold bg-background text-right focus-visible:ring-primary/50 transition-shadow"
                      value={manualAmounts[member.id] || ''}
                      onChange={(e) => handleManualAmountChange(member.id, e.target.value)}
                    />
                  </div>
                )}
                {!isSelected && (
                  <span className="font-bold text-sm text-muted-foreground line-through tabular-nums w-24 text-right shrink-0">
                    {formatMoney(0, currency)}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {hasRemainder && (
          <div className="flex items-start gap-2 p-3 mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-medium">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Mathematically impossible to divide exactly.</strong> A fractional difference of {formatMoney(1, currency)} was automatically distributed to ensure the total matches the expense exactly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
})
SplitSelector.displayName = 'SplitSelector'
