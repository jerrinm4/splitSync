import { LoadError } from '@/components/layout/LoadError'
import { useState, useMemo } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { formatMoney } from '@/lib/money'
import { format, formatDistanceToNow } from 'date-fns'
import {
  History, Receipt, Wallet, User, Filter, ChevronDown, ChevronUp,
  Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Clock
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface AuditLog {
  id: string
  trip_id: string
  actor_user_id: string
  actor_email: string
  entity_type: string
  entity_id: string
  action: string
  after_data: any
  before_data: any
  created_at: string
}

function useAuditLogs(tripId: string) {
  return useQuery({
    queryKey: ['audit_logs', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_trip_audit_logs', { p_trip_id: tripId })
      if (error) throw error
      return data as AuditLog[]
    },
    enabled: !!tripId
  })
}

function getActionInfo(action: string) {
  const map: Record<string, { label: string; color: string; bgColor: string; icon: typeof Plus }> = {
    'CREATE': { label: 'Created', color: 'text-green-800 dark:text-green-300', bgColor: 'bg-green-500/10 border-green-500/20', icon: Plus },
    'UPDATE': { label: 'Updated', color: 'text-blue-800 dark:text-blue-300', bgColor: 'bg-blue-500/10 border-blue-500/20', icon: Pencil },
    'DELETE': { label: 'Deleted', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-500/10 border-red-500/20', icon: Trash2 },
    'ADD_FUNDS': { label: 'Added Funds', color: 'text-green-800 dark:text-green-300', bgColor: 'bg-green-500/10 border-green-500/20', icon: ArrowDownCircle },
    'REMOVE_FUNDS': { label: 'Removed Funds', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-500/10 border-red-500/20', icon: ArrowUpCircle },
    'VOID': { label: 'Voided', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-500/10 border-red-500/20', icon: Trash2 },
  }
  return map[action] || { label: action, color: 'text-muted-foreground', bgColor: 'bg-muted/50 border-border/30', icon: Clock }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'EXPENSE': return Receipt
    case 'FUND_TRANSACTION': return Wallet
    default: return History
  }
}

function getEntityLabel(entityType: string) {
  switch (entityType) {
    case 'EXPENSE': return 'Expense'
    case 'FUND_TRANSACTION': return 'Fund'
    case 'MEMBER': return 'Member'
    case 'TRIP': return 'Trip'
    case 'CATEGORY': return 'Category'
    default: return entityType
  }
}

export default function ActivityPage() {
  const [now] = useState(Date.now)
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: trip } = useTrip(tripId)
  const { data: logs, isLoading, error, refetch } = useAuditLogs(tripId)

  const [entityFilter, setEntityFilter] = useState<string>('ALL')
  const [userFilter, setUserFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (trip?.trip_members) {
      trip.trip_members.forEach((m: any) => { map[m.id] = m.name })
    }
    return map
  }, [trip])


  const uniqueActors = useMemo(() => {
    if (!logs) return []
    const map = new Map<string, string>()
    logs.forEach(l => map.set(l.actor_user_id, l.actor_email))
    return Array.from(map.entries()).map(([id, email]) => ({ id, email }))
  }, [logs])

  const uniqueEntityTypes = useMemo(() => {
    if (!logs) return []
    return [...new Set(logs.map(l => l.entity_type))]
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (!logs) return []
    let result = [...logs]

    if (entityFilter !== 'ALL') {
      result = result.filter(l => l.entity_type === entityFilter)
    }
    if (userFilter !== 'ALL') {
      result = result.filter(l => l.actor_user_id === userFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l => {
        const title = l.after_data?.title || ''
        const note = l.after_data?.note || ''
        const email = l.actor_email || ''
        return title.toLowerCase().includes(q) || note.toLowerCase().includes(q) || email.toLowerCase().includes(q) || l.action.toLowerCase().includes(q)
      })
    }
    return result
  }, [logs, entityFilter, userFilter, searchQuery])

  const groupedLogs = useMemo(() => {
    const groups: Record<string, AuditLog[]> = {}
    filteredLogs.forEach(log => {
      const dateKey = format(new Date(log.created_at), 'yyyy-MM-dd')
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(log)
    })
    return groups
  }, [filteredLogs])

  const renderDetails = (log: AuditLog) => {
    const data = log.after_data || {}
    const fields: { label: string; value: string }[] = []

    if (log.entity_type === 'EXPENSE') {
      if (data.title) fields.push({ label: 'Title', value: data.title })
      if (data.amount_paise) fields.push({ label: 'Amount', value: formatMoney(data.amount_paise, trip?.currency) })
      if (data.is_paid !== undefined) fields.push({ label: 'Status', value: data.is_paid ? '✅ Billed' : '⏳ Estimated' })
      if (data.receipt_url) fields.push({ label: 'Receipt', value: '📎 Attached' })
      if (data.note) fields.push({ label: 'Note', value: data.note })

      if (data.splits && Array.isArray(data.splits) && data.splits.length > 0) {
        const splitLines = data.splits.map((s: any) => {
          const name = memberMap[s.member_id] || 'Unknown'
          return `${name}: ${formatMoney(s.amount_paise, trip?.currency)}`
        })
        fields.push({ label: 'Split', value: splitLines.join('\n') })
      }
    } else if (log.entity_type === 'FUND_TRANSACTION') {
      if (data.amount_paise) fields.push({ label: 'Amount', value: formatMoney(data.amount_paise, trip?.currency) })
      if (data.note) fields.push({ label: 'Note', value: data.note })
    }

    if (fields.length === 0) {
      return <div className="text-xs text-muted-foreground italic py-1">No additional details recorded.</div>
    }

    return (
      <div className="mt-2 space-y-1.5 bg-muted/30 rounded-lg p-3 border border-border/30">
        {fields.map((f, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="font-bold text-muted-foreground min-w-[60px] shrink-0">{f.label}</span>
            <span className="text-foreground whitespace-pre-wrap break-all">{f.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const formatLogHeadline = (log: AuditLog) => {
    const data = log.after_data || {}

    switch (log.entity_type) {
      case 'EXPENSE': {
        const title = data.title || 'Expense'
        const amount = data.amount_paise ? formatMoney(data.amount_paise, trip?.currency) : ''
        if (log.action === 'CREATE') return <><span className="font-bold">{title}</span> — {amount}</>
        if (log.action === 'UPDATE') return <><span className="font-bold">{title}</span> — {amount}</>
        if (log.action === 'DELETE') return <><span className="font-bold">{title}</span></>
        return <><span className="font-bold">{title}</span></>
      }
      case 'FUND_TRANSACTION': {
        const amount = data.amount_paise ? formatMoney(data.amount_paise, trip?.currency) : ''
        const note = data.note ? ` — ${data.note}` : ''
        return <><span className="font-bold">{amount}</span>{note}</>
      }
      default:
        return <span>{log.action} on {getEntityLabel(log.entity_type)}</span>
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary">Loading activity...</div></div>

  if (error) return <LoadError retry={refetch} />

  return (
    <div className="space-y-6 animate-in-up pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-8 h-8 text-primary" /> Activity Log
        </h1>
        <Badge variant="secondary" className="text-xs">
          {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            aria-label="Search activity" placeholder="Search logs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 h-10"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <select aria-label="Filter activity type"               className="w-full h-10 pl-3 pr-8 rounded-md border border-border/50 bg-background/50 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              {uniqueEntityTypes.map(t => (
                <option key={t} value={t}>{getEntityLabel(t)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>

          <div className="relative flex-1">
            <select aria-label="Filter activity user"               className="w-full h-10 pl-3 pr-8 rounded-md border border-border/50 bg-background/50 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            >
              <option value="ALL">All Users</option>
              {uniqueActors.map(u => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {Object.keys(groupedLogs).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <History className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No activity yet</p>
          <p className="text-sm">Changes to this trip will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => {
            const date = new Date(dateKey)
            const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey
            const isYesterday = format(new Date(now - 86400000), 'yyyy-MM-dd') === dateKey
            const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : format(date, 'MMM d, yyyy')

            return (
              <div key={dateKey}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{dateLabel}</div>
                  <div className="flex-1 border-t border-border/30" />
                  <Badge variant="outline" className="text-[10px]">{dateLogs.length}</Badge>
                </div>

                <div className="space-y-0">
                  {dateLogs.map((log, idx) => {
                    const actionInfo = getActionInfo(log.action)
                    const EntityIcon = getEntityIcon(log.entity_type)
                    const ActionIcon = actionInfo.icon
                    const isLast = idx === dateLogs.length - 1
                    const isExpanded = expandedLogId === log.id

                    return (
                      <div key={log.id} className="flex gap-3">
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            log.entity_type === 'EXPENSE' ? 'bg-blue-500/15'
                            : log.entity_type === 'FUND_TRANSACTION' ? 'bg-emerald-500/15'
                            : 'bg-muted/50'
                          }`}>
                            <EntityIcon className={`w-4 h-4 ${
                              log.entity_type === 'EXPENSE' ? 'text-blue-500'
                              : log.entity_type === 'FUND_TRANSACTION' ? 'text-emerald-500'
                              : 'text-muted-foreground'
                            }`} />
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-border/50 min-h-[16px]" />}
                        </div>

                        <div className="flex-1 pb-4">
                          <div
                            role="button" tabIndex={0} aria-expanded={isExpanded} aria-label={`Activity: ${log.action}`}
                            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpandedLogId(isExpanded ? null : log.id) } }}
                            className={`rounded-xl border p-3 transition-colors cursor-pointer ${actionInfo.bgColor}`}
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className={`text-[10px] px-2 py-0 h-5 gap-1 ${actionInfo.color}`}>
                                  <ActionIcon className="w-3 h-3" />
                                  {actionInfo.label}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                                  {getEntityLabel(log.entity_type)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(log.created_at), 'h:mm a')}
                                </span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                            </div>

                            <p className="text-sm leading-snug">
                              {formatLogHeadline(log)}
                            </p>

                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{log.actor_email}</span>
                              <span className="mx-1">·</span>
                              <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                            </div>

                            {isExpanded && renderDetails(log)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
