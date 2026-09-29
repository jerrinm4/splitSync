export const formatMoney = (amountPaise: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
};

export type RoundingMode = 'PAISE' | 'FLOOR' | 'CEIL';

/** Display-only whole-rupee rounding; stored paise remain unchanged. */
export const applyRounding = (
  amountPaise: number,
  roundingMode: RoundingMode = 'PAISE',
  direction: 'COLLECT' | 'RETURN' = 'COLLECT'
): number => {
  if (roundingMode === 'PAISE') return amountPaise;

  if (roundingMode === 'FLOOR') {
    // FLOOR: return less, collect more
    return direction === 'RETURN'
      ? Math.floor(amountPaise / 100) * 100
      : Math.ceil(amountPaise / 100) * 100;
  }

  // CEIL: return more, collect less
  return direction === 'RETURN'
    ? Math.ceil(amountPaise / 100) * 100
    : Math.floor(amountPaise / 100) * 100;
};

/**
 * Formats a paise amount with rounding applied first.
 */
export const formatMoneyRounded = (
  amountPaise: number,
  currency: string = 'INR',
  roundingMode: RoundingMode = 'PAISE',
  direction: 'COLLECT' | 'RETURN' = 'COLLECT'
): string => {
  return formatMoney(applyRounding(amountPaise, roundingMode, direction), currency);
};


export const parseMoneyToPaise = (amountString: string): number => {
  const value = amountString.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return 0;
  const [whole = '0', fraction = ''] = value.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : 0;
};

// Represents a member's net position:
// Negative = Owed (paid more than their share)
// Positive = Owes (paid less than their share)
// Zero = Settled
export interface MemberBalance {
  memberId: string;
  netBalancePaise: number;
}

export interface SplitResult {
  memberId: string;
  amountPaise: number;
}

/**
 * Calculates equal splits ensuring no penny is lost.
 * The remainder is distributed starting from the first member until depleted.
 */
export const calculateEqualSplits = (totalAmountPaise: number, memberIds: string[]): SplitResult[] => {
  if (!memberIds.length) return [];
  
  const baseSplit = Math.floor(totalAmountPaise / memberIds.length);
  const remainder = totalAmountPaise % memberIds.length;

  return memberIds.map((id, index) => {
    const amount = baseSplit + (index < remainder ? 1 : 0);
    return { memberId: id, amountPaise: amount };
  });
};

/**
 * Smart split: distributes the total among locked (manual) members
 * and auto-split members. The remainder after subtracting locked amounts
 * is divided equally among auto members with penny-perfect accuracy.
 *
 * Returns splits for ALL included members (locked + auto).
 * If the locked amounts exceed the total, auto members get 0.
 */
export const calculateSmartSplits = (
  totalPaise: number,
  lockedAmounts: Record<string, number>,  // memberId → manually-set paise
  autoMemberIds: string[]                 // members still on auto-split
): SplitResult[] => {
  const lockedTotal = Object.values(lockedAmounts).reduce((sum, v) => sum + v, 0);
  const remaining = Math.max(0, totalPaise - lockedTotal);

  // Build locked member results
  const lockedResults: SplitResult[] = Object.entries(lockedAmounts).map(
    ([memberId, amountPaise]) => ({ memberId, amountPaise })
  );

  // Distribute remaining among auto members
  if (autoMemberIds.length === 0) return lockedResults;

  const baseSplit = Math.floor(remaining / autoMemberIds.length);
  const remainder = remaining % autoMemberIds.length;

  const autoResults: SplitResult[] = autoMemberIds.map((id, index) => ({
    memberId: id,
    amountPaise: baseSplit + (index < remainder ? 1 : 0),
  }));

  return [...lockedResults, ...autoResults];
};

/**
 * Detects which members were auto-split vs manually set based on amounts
 */
export const detectAutoSplitMembers = (
  totalPaise: number,
  splits: SplitResult[]
): { autoMemberIds: string[], lockedAmounts: Record<string, number> } => {
  const expected = calculateEqualSplits(totalPaise, splits.map(split => split.memberId));
  const equal = splits.every((split, index) => split.amountPaise === expected[index]?.amountPaise);
  return equal
    ? { autoMemberIds: splits.map(split => split.memberId), lockedAmounts: {} }
    : { autoMemberIds: [], lockedAmounts: Object.fromEntries(splits.map(split => [split.memberId, split.amountPaise])) };
};

/**
 * Smart split that takes into account a running rounding balance to fairly distribute remainder paise.
 */
export const calculateBalancedSmartSplits = (
  totalPaise: number,
  lockedAmounts: Record<string, number>,  
  autoMemberIds: string[],
  roundingBalances: Record<string, number> // memberId -> extra paise they have absorbed so far
): SplitResult[] => {
  const lockedTotal = Object.values(lockedAmounts).reduce((sum, v) => sum + v, 0);
  const remaining = Math.max(0, totalPaise - lockedTotal);

  const lockedResults: SplitResult[] = Object.entries(lockedAmounts).map(
    ([memberId, amountPaise]) => ({ memberId, amountPaise })
  );

  if (autoMemberIds.length === 0) return lockedResults;

  const baseSplit = Math.floor(remaining / autoMemberIds.length);
  const remainder = remaining % autoMemberIds.length;

  // Sort auto members by their rounding balance ascending
  // (members who have absorbed the least extra paise get the remainder)
  const sortedAutoIds = [...autoMemberIds].sort((a, b) => {
    const balA = roundingBalances[a] || 0;
    const balB = roundingBalances[b] || 0;
    return balA - balB;
  });

  const remainderIndices = new Set(sortedAutoIds.slice(0, remainder));

  const autoResults: SplitResult[] = autoMemberIds.map(id => {
    const getsExtra = remainderIndices.has(id);
    if (getsExtra) {
      roundingBalances[id] = (roundingBalances[id] || 0) + 1;
    }
    return {
      memberId: id,
      amountPaise: baseSplit + (getsExtra ? 1 : 0),
    };
  });

  return [...lockedResults, ...autoResults];
};

/**
 * Resyncs all expenses for a trip to ensure fair rounding distribution.
 */
export const recalculateAllTripSplits = (expenses: any[]) => {
  // Sort expenses chronologically (oldest first)
  const sortedExpenses = [...expenses].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const roundingBalances: Record<string, number> = {};
  const updatedExpenses = [];

  for (const exp of sortedExpenses) {
    const originalSplits = (exp.expense_splits || []).map((s: any) => ({
      memberId: s.member_id,
      amountPaise: s.amount_paise
    }));

    let autoIds: string[] = [];
    const locked: Record<string, number> = {};

    if (exp.split_method === 'EQUAL') {
      autoIds = originalSplits.map((s: any) => s.memberId);
    } else {
      // Custom shares are explicit choices and must survive rounding resyncs.
      continue;
    }

    const newSplits = calculateBalancedSmartSplits(
      exp.amount_paise,
      locked,
      autoIds,
      roundingBalances
    );

    // Check if new splits differ from old splits
    const splitsChanged = newSplits.some(newSplit => {
      const oldSplit = originalSplits.find((s: any) => s.memberId === newSplit.memberId);
      return !oldSplit || oldSplit.amountPaise !== newSplit.amountPaise;
    });

    if (splitsChanged) {
      updatedExpenses.push({
        ...exp,
        expense_splits: newSplits.map(s => ({ member_id: s.memberId, amount_paise: s.amountPaise }))
      });
    }
  }

  return updatedExpenses;
};
