import { z } from 'zod';
import { parseMoneyToPaise } from './money';

const positiveMoney = z.string().trim().refine(
  value => parseMoneyToPaise(value) > 0,
  'Enter a positive amount with at most two decimal places'
);

export const createTripSchema = z.object({
  name: z.string().trim().min(1, 'Trip name is required').max(120),
  note: z.string().optional(),
  currency: z.literal('INR'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: "End date cannot be before start date", path: ["endDate"] }
);

export const addFundSchema = z.object({
  memberId: z.string().uuid('Please select a valid member'),
  amountString: positiveMoney,
  note: z.string().optional(),
});

export const expenseSplitSchema = z.object({
  memberId: z.string().uuid(),
  amountPaise: z.number().int().min(0),
});

export const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  amountString: positiveMoney,
  expenseDate: z.date(),
  paymentSource: z.enum(['TRIP_WALLET', 'MEMBER']),
  paidByMemberId: z.string().uuid().optional().nullable(),
  splitMethod: z.enum(['EQUAL', 'CUSTOM']),
  payerMode: z.enum(['SINGLE', 'MULTIPLE']),
  note: z.string().optional(),
  splits: z.array(expenseSplitSchema).optional(),
  payers: z.array(expenseSplitSchema).optional(),
  isPaid: z.boolean(),
  categoryId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => {
    if (data.paymentSource === 'MEMBER') {
      if (data.payerMode === 'SINGLE' && !data.paidByMemberId) return false;
    }
    return true;
  },
  { message: "Valid payer(s) must be selected when payment source is members", path: ["paidByMemberId"] }
);
