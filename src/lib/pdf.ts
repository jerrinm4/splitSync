import jsPDF from 'jspdf'
import autoTable, { type UserOptions } from 'jspdf-autotable'
import { format } from 'date-fns'
import { fromDateOnly } from './dates'
import { calculateMemberBalances, calculateWalletBalance } from './balances'
import { exportFilename } from './export'
import type { Expense, TripDetails, TripMember } from '@/types/trip'

const INK: [number, number, number] = [31, 36, 51]
const MUTED: [number, number, number] = [94, 103, 121]
const PURPLE: [number, number, number] = [102, 66, 190]
const MARGIN = 14
type ReportOptions = { generatedAt?: Date }
let fontPromise: Promise<string[]> | undefined

async function loadFonts() {
  fontPromise ??= Promise.all(['Regular', 'Bold'].map(async weight => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/NotoSans-${weight}.ttf`)
    if (!response.ok) throw new Error('PDF fonts could not load. Check your connection and try again.')
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
    }
    return btoa(binary)
  })).catch(error => { fontPromise = undefined; throw error })
  return fontPromise
}

export function formatPDFMoney(paise: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, currencyDisplay: 'symbol', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(paise / 100)
}

const expenseStatus = (expense: Expense) => expense.is_paid === false ? 'Estimated' : 'Paid'
const activeExpenses = (expenses: Expense[]) => expenses.filter(expense => expense.status !== 'VOIDED')
const dateLabel = (date: string) => format(fromDateOnly(date), 'dd MMM yyyy')
const sum = (expenses: Expense[]) => expenses.reduce((total, expense) => total + expense.amount_paise, 0)
const nameOf = (members: TripMember[], id: string | null) => members.find(member => member.id === id)?.name || 'Unknown member'

function payerShares(expense: Expense) {
  return expense.payment_source === 'TRIP_WALLET' ? [] : expense.expense_payers?.length
    ? expense.expense_payers
    : [{ member_id: expense.paid_by_member_id || '', amount_paise: expense.amount_paise }]
}

function paymentLabel(expense: Expense, trip: TripDetails) {
  return expense.payment_source === 'TRIP_WALLET' ? 'Trip wallet' : payerShares(expense)
    .map(payer => `${nameOf(trip.trip_members, payer.member_id)}: ${formatPDFMoney(payer.amount_paise, trip.currency)}`).join('\n')
}

async function report(trip: TripDetails, title: string, landscape: boolean, options: ReportOptions) {
  const fonts = await loadFonts()
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', compress: true })
  for (const [index, weight] of ['normal', 'bold'].entries()) {
    doc.addFileToVFS(`NotoSans-${weight}.ttf`, fonts[index]!)
    doc.addFont(`NotoSans-${weight}.ttf`, 'NotoSans', weight)
  }
  const generatedAt = options.generatedAt || new Date()
  doc.setCreationDate(generatedAt)
  doc.setProperties({ title: `${title} - ${trip.name}`, subject: 'SplitSync trip report', author: 'SplitSync', creator: 'SplitSync' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const contentWidth = width - MARGIN * 2
  doc.setFont('NotoSans', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...PURPLE)
  doc.text('SplitSync', MARGIN, 16)
  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(`${trip.currency} · ${title}`, width - MARGIN, 16, { align: 'right' })
  doc.setFont('NotoSans', 'bold')
  doc.setFontSize(23)
  doc.setTextColor(...INK)
  const nameLines: string[] = doc.splitTextToSize(trip.name, contentWidth)
  doc.text(nameLines, MARGIN, 29)
  let y = 29 + (nameLines.length - 1) * 9 + 8
  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const period = [trip.start_date, trip.end_date].filter((value): value is string => !!value).map(dateLabel).join(' - ')
  doc.text(period ? `Trip dates: ${period}` : 'Trip dates: not set', MARGIN, y)
  y += 7

  const paragraph = (text: string) => {
    doc.setFont('NotoSans', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    const lines: string[] = doc.splitTextToSize(text, contentWidth)
    if (y + lines.length * 4.5 > height - 22) { doc.addPage(); y = 27 }
    doc.text(lines, MARGIN, y)
    y += lines.length * 4.5 + 4
  }
  const cards = (items: { label: string; amount: number }[]) => {
    const gap = 4
    const cardWidth = (contentWidth - gap * (items.length - 1)) / items.length
    items.forEach((item, index) => {
      const x = MARGIN + index * (cardWidth + gap)
      doc.setFillColor(246, 244, 251)
      doc.roundedRect(x, y, cardWidth, 24, 2, 2, 'F')
      doc.setFont('NotoSans', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(item.label, x + 4, y + 7)
      doc.setFont('NotoSans', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...INK)
      const value = formatPDFMoney(item.amount, trip.currency)
      while (doc.getTextWidth(value) > cardWidth - 8 && doc.getFontSize() > 8) doc.setFontSize(doc.getFontSize() - 1)
      doc.text(value, x + 4, y + 18)
    })
    y += 32
  }
  const table = (settings: UserOptions) => {
    autoTable(doc, {
      startY: y, margin: { top: 27, bottom: 21, left: MARGIN, right: MARGIN },
      theme: 'plain', rowPageBreak: 'avoid',
      styles: { font: 'NotoSans', fontSize: 8.5, textColor: INK, cellPadding: 3, overflow: 'linebreak', valign: 'top', lineColor: [229, 231, 238], lineWidth: { bottom: 0.15 } },
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 249, 252] },
      ...settings,
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }
  const finish = () => {
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page)
      doc.setFont('NotoSans', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      if (page > 1) {
        doc.setFont('NotoSans', 'bold')
        doc.text('SplitSync', MARGIN, 15)
        doc.setFont('NotoSans', 'normal')
        doc.text(title, width - MARGIN, 15, { align: 'right' })
        doc.setDrawColor(229, 231, 238)
        doc.line(MARGIN, 20, width - MARGIN, 20)
      }
      doc.setDrawColor(229, 231, 238)
      doc.line(MARGIN, height - 16, width - MARGIN, height - 16)
      doc.text(`Generated ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, MARGIN, height - 10)
      doc.text(`Page ${page} of ${pages}`, width - MARGIN, height - 10, { align: 'right' })
    }
    return doc
  }
  return { cards, paragraph, table, finish }
}

export async function buildExpensesPDF(trip: TripDetails, expenses: Expense[], options: ReportOptions = {}) {
  const selected = activeExpenses(expenses)
  const paid = selected.filter(expense => expense.is_paid !== false)
  const estimated = selected.filter(expense => expense.is_paid === false)
  const pdf = await report(trip, 'Expense report', true, options)
  pdf.cards([
    { label: `Paid expenses (${paid.length})`, amount: sum(paid) },
    { label: `Estimated expenses (${estimated.length})`, amount: sum(estimated) },
    { label: 'Total of selected expenses', amount: sum(selected) },
  ])
  pdf.paragraph(`${selected.length} of ${activeExpenses(trip.expenses).length} expenses included, in the selected order. Estimates are planned costs and do not affect current balances. Payment sources for estimates are planned.`)
  if (!selected.length) pdf.paragraph('No expenses in this selection.')
  else pdf.table({
    head: [['Date', 'Expense / category / note', 'Status', 'Amount', 'Paid by / planned source', 'Member shares']],
    body: selected.map(expense => [
      dateLabel(expense.expense_date),
      [expense.title, trip.expense_categories.find(category => category.id === expense.category_id)?.name || 'Uncategorized', expense.note].filter(Boolean).join('\n'),
      expenseStatus(expense), formatPDFMoney(expense.amount_paise, trip.currency), paymentLabel(expense, trip),
      expense.expense_splits.map(split => `${nameOf(trip.trip_members, split.member_id)}: ${formatPDFMoney(split.amount_paise, trip.currency)}`).join('\n') || 'No shares recorded',
    ]),
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 59 }, 2: { cellWidth: 24 }, 3: { cellWidth: 33, halign: 'right' }, 4: { cellWidth: 61 }, 5: { cellWidth: 'auto' } },
  })
  return pdf.finish()
}

export async function buildMembersPDF(trip: TripDetails, members: TripMember[], options: ReportOptions = {}) {
  const balances = calculateMemberBalances(trip.trip_members, trip.expenses, trip.fund_transactions)
  const pdf = await report(trip, 'Member balances', false, options)
  pdf.cards([
    { label: 'Paid trip expenses', amount: sum(activeExpenses(trip.expenses).filter(expense => expense.is_paid !== false)) },
    { label: 'Remaining trip wallet', amount: calculateWalletBalance(trip.expenses, trip.fund_transactions) },
  ])
  pdf.paragraph(`${members.length} members included. Balances use paid expenses and wallet deposits minus refunds. Estimated and voided entries are excluded.`)
  if (!members.length) pdf.paragraph('No members in this trip yet.')
  else pdf.table({
    head: [['Member', 'Paid directly', 'Wallet net', 'Expense share', 'Balance', 'Position']],
    body: members.map(member => {
      const balance = balances[member.id] || { totalPaid: 0, walletContribution: 0, totalOwed: 0, finalBalance: 0 }
      return [
        `${member.name}${member.status === 'INACTIVE' ? '\nInactive' : ''}`, formatPDFMoney(balance.totalPaid, trip.currency),
        formatPDFMoney(balance.walletContribution, trip.currency), formatPDFMoney(balance.totalOwed, trip.currency),
        formatPDFMoney(Math.abs(balance.finalBalance), trip.currency), balance.finalBalance > 0 ? 'Gets back' : balance.finalBalance < 0 ? 'Owes' : 'Settled',
      ]
    }),
    columnStyles: { 0: { cellWidth: 37 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { cellWidth: 22 } },
  })
  pdf.paragraph('Balance = paid directly + wallet net - expense share. Positive balances are amounts to receive, including money still held in the trip wallet. This report does not record settlement transfers.')
  return pdf.finish()
}

export async function buildMemberPDF(trip: TripDetails, member: TripMember, options: ReportOptions = {}) {
  const balance = calculateMemberBalances([member], trip.expenses, trip.fund_transactions)[member.id]!
  const pdf = await report(trip, 'Member statement', false, options)
  pdf.paragraph(`Statement for ${member.name}${member.status === 'INACTIVE' ? ' (inactive)' : ''}`)
  pdf.cards([
    { label: 'Paid directly', amount: balance.totalPaid },
    { label: 'Wallet net', amount: balance.walletContribution },
    { label: 'Paid expense share', amount: balance.totalOwed },
  ])
  pdf.paragraph(`Current position: ${balance.finalBalance > 0 ? 'gets back' : balance.finalBalance < 0 ? 'owes' : 'settled'} ${formatPDFMoney(Math.abs(balance.finalBalance), trip.currency)}. Balance includes wallet deposits minus refunds; estimated costs below are excluded.`)
  const expenses = activeExpenses(trip.expenses).filter(expense => expense.expense_splits.some(split => split.member_id === member.id) || payerShares(expense).some(payer => payer.member_id === member.id))
  if (!expenses.length) pdf.paragraph('No expenses involve this member yet.')
  else pdf.table({
    head: [['Date', 'Expense', 'Status', 'Paid directly*', 'Member share*']],
    body: expenses.map(expense => [dateLabel(expense.expense_date), expense.title, expenseStatus(expense),
      formatPDFMoney(payerShares(expense).find(payer => payer.member_id === member.id)?.amount_paise || 0, trip.currency),
      formatPDFMoney(expense.expense_splits.find(split => split.member_id === member.id)?.amount_paise || 0, trip.currency),
    ]),
    columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 60 }, 2: { cellWidth: 24 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })
  pdf.paragraph('* Amounts on estimated rows are planned. Wallet-paid expenses are funded from shared deposits, so they show zero paid directly.')
  const funds = trip.fund_transactions.filter(fund => fund.member_id === member.id && fund.status !== 'VOIDED')
  if (funds.length) pdf.table({
    head: [['Wallet date', 'Transaction / note', 'Amount']],
    body: funds.map(fund => [format(new Date(fund.occurred_at), 'dd MMM yyyy'),
      `${fund.transaction_type === 'ADD' ? 'Deposit' : 'Refund'}${fund.note ? `\n${fund.note}` : ''}`, formatPDFMoney(fund.amount_paise, trip.currency)]),
    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 40, halign: 'right' } },
  })
  return pdf.finish()
}

export async function exportExpensesPDF(trip: TripDetails, expenses: Expense[]) {
  const doc = await buildExpensesPDF(trip, expenses)
  doc.save(exportFilename(`${trip.name}-expenses`, 'pdf'))
}

export async function exportMembersPDF(trip: TripDetails, members: TripMember[]) {
  const doc = await buildMembersPDF(trip, members)
  doc.save(exportFilename(`${trip.name}-balances`, 'pdf'))
}

export async function exportUserReportPDF(trip: TripDetails, member: TripMember) {
  const doc = await buildMemberPDF(trip, member)
  doc.save(exportFilename(`${trip.name}-${member.name}`, 'pdf'))
}
