import { useEffect, useMemo, useState } from 'react'

type Priority = 'low' | 'medium' | 'high'
type Status = 'waiting' | 'in_progress' | 'done' | 'skipped'

type Ticket = {
  id: string
  number: string
  name: string
  desc: string
  priority: Priority
  etaMinutes: number
  status: Status
  createdAt: number
  startedAt?: number
  doneAt?: number
  result?: string
}

const STORAGE_KEY = 'queue-system:tickets:v1'

function priorityLabel(p: Priority) {
  if (p === 'high') return '高'
  if (p === 'medium') return '中'
  return '低'
}

function statusLabel(s: Status) {
  if (s === 'waiting') return '等待中'
  if (s === 'in_progress') return '办理中'
  if (s === 'done') return '已完成'
  return '已过号'
}

function priorityRank(p: Priority) {
  if (p === 'high') return 3
  if (p === 'medium') return 2
  return 1
}

function pad3(n: number) {
  return String(n).padStart(3, '0')
}

function minutesBetween(a: number, b: number) {
  return Math.max(0, Math.round((b - a) / 60000))
}

function formatDurationFrom(ts: number, now: number) {
  const mins = Math.max(0, Math.floor((now - ts) / 60000))
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分钟`
}

function isSameLocalDay(a: number, b: number) {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

function sortWaitingQueue(tickets: Ticket[]) {
  return [...tickets]
    .filter((t) => t.status === 'waiting')
    .sort((x, y) => {
      const pr = priorityRank(y.priority) - priorityRank(x.priority)
      if (pr !== 0) return pr
      return x.createdAt - y.createdAt
    })
}

function App() {
  const [activeTab, setActiveTab] = useState<'admin' | 'apply'>('admin')
  const [now, setNow] = useState(() => Date.now())

  const [tickets, setTickets] = useState<Ticket[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter(Boolean) as Ticket[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
    } catch {
      // ignore
    }
  }, [tickets])

  const inProgress = useMemo(
    () => tickets.find((t) => t.status === 'in_progress') ?? null,
    [tickets],
  )

  const waitingQueue = useMemo(() => sortWaitingQueue(tickets), [tickets])

  const nextNumber = useMemo(() => {
    const max = tickets.reduce((acc, t) => {
      const n = Number.parseInt(t.number, 10)
      return Number.isFinite(n) ? Math.max(acc, n) : acc
    }, 0)
    return pad3(max + 1)
  }, [tickets])

  const [applyName, setApplyName] = useState('')
  const [applyDesc, setApplyDesc] = useState('')
  const [applyPriority, setApplyPriority] = useState<Priority>('medium')
  const [applyEta, setApplyEta] = useState<number>(15)
  const [applySuccessMsg, setApplySuccessMsg] = useState<string>('')

  const [queryNumber, setQueryNumber] = useState('')
  const queriedTicket = useMemo(() => {
    const nn = queryNumber.trim()
    if (!nn) return null
    return tickets.find((t) => t.number === nn) ?? null
  }, [queryNumber, tickets])

  const queriedAheadCount = useMemo(() => {
    if (!queriedTicket) return null
    if (queriedTicket.status !== 'waiting') return 0

    const idx = waitingQueue.findIndex((t) => t.id === queriedTicket.id)
    const aheadInWaiting = idx >= 0 ? idx : 0
    const hasInProgress = inProgress ? 1 : 0
    return aheadInWaiting + hasInProgress
  }, [queriedTicket, waitingQueue, inProgress])

  const [currentResultDraft, setCurrentResultDraft] = useState('')
  useEffect(() => {
    setCurrentResultDraft(inProgress?.result ?? '')
  }, [inProgress?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayDone = useMemo(() => {
    const t = Date.now()
    return tickets.filter((x) => x.doneAt != null && isSameLocalDay(x.doneAt, t))
  }, [tickets])

  const avgTodayWaitMinutes = useMemo(() => {
    const t = Date.now()
    const rows = tickets.filter(
      (x) => x.startedAt != null && isSameLocalDay(x.startedAt, t),
    )
    if (rows.length === 0) return 0
    const sum = rows.reduce((acc, x) => acc + minutesBetween(x.createdAt, x.startedAt!), 0)
    return Math.round(sum / rows.length)
  }, [tickets])

  const avgTodayHandleMinutes = useMemo(() => {
    const t = Date.now()
    const rows = tickets.filter(
      (x) => x.startedAt != null && x.doneAt != null && isSameLocalDay(x.doneAt, t),
    )
    if (rows.length === 0) return 0
    const sum = rows.reduce((acc, x) => acc + minutesBetween(x.startedAt!, x.doneAt!), 0)
    return Math.round(sum / rows.length)
  }, [tickets])

  function createTicket() {
    const name = applyName.trim()
    const desc = applyDesc.trim()
    const eta = Number.isFinite(applyEta) ? Math.max(1, Math.floor(applyEta)) : 15

    if (!name || !desc) {
      setApplySuccessMsg('请先填写：姓名、事项描述。')
      return
    }

    const hasInProgress = inProgress ? 1 : 0
    const waitingCountBefore = tickets.filter((t) => t.status === 'waiting').length
    const ahead = waitingCountBefore + hasInProgress

    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      number: nextNumber,
      name,
      desc,
      priority: applyPriority,
      etaMinutes: eta,
      status: 'waiting',
      createdAt: Date.now(),
    }

    setTickets((prev) => [...prev, newTicket])
    setApplyName('')
    setApplyDesc('')
    setApplyPriority('medium')
    setApplyEta(15)
    setApplySuccessMsg(`取号成功，你的号码是 ${newTicket.number}，前面还有 ${ahead} 人在等待。`)
  }

  function callNext() {
    if (inProgress) return
    if (waitingQueue.length === 0) return

    const next = waitingQueue[0]
    setTickets((prev) =>
      prev.map((t) =>
        t.id === next.id
          ? { ...t, status: 'in_progress', startedAt: Date.now() }
          : t,
      ),
    )
  }

  function markDone() {
    if (!inProgress) return
    const result = currentResultDraft.trim()
    setTickets((prev) =>
      prev.map((t) =>
        t.id === inProgress.id
          ? { ...t, status: 'done', doneAt: Date.now(), result }
          : t,
      ),
    )
  }

  function markSkipped() {
    if (!inProgress) return
    setTickets((prev) =>
      prev.map((t) =>
        t.id === inProgress.id ? { ...t, status: 'skipped' } : t,
      ),
    )
  }

  function bumpPriority(id: string) {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next: Priority =
          t.priority === 'low' ? 'medium' : t.priority === 'medium' ? 'high' : 'high'
        return { ...t, priority: next }
      }),
    )
  }

  function resetAll() {
    const ok = window.confirm('确定要清空所有队列与历史记录吗？此操作不可撤销。')
    if (!ok) return
    setTickets([])
    setApplySuccessMsg('')
    setQueryNumber('')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 40% 20%, rgba(120, 219, 255, 0.1) 0%, transparent 50%),
          linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)
        `,
        color: '#e8eaf6',
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* 背景装饰网格 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
          opacity: 0.4,
        }}
      />

      {/* 顶部导航 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(10, 14, 39, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px 0',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '24px',
            }}
          >
      <div>
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 50%, #12c2e9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  margin: 0,
                  marginBottom: '4px',
                  letterSpacing: '-0.5px',
                }}
              >
                办事排号系统
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(232, 234, 246, 0.6)' }}>
                高效管理排队事务，提升工作效率
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['apply', 'admin'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: activeTab === tab ? '1px solid rgba(255, 107, 157, 0.3)' : '1px solid transparent',
                    background:
                      activeTab === tab
                        ? 'linear-gradient(135deg, rgba(255, 107, 157, 0.2) 0%, rgba(196, 113, 237, 0.2) 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: '#e8eaf6',
                    fontSize: '14px',
                    fontWeight: activeTab === tab ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  {tab === 'apply' ? '申请人取号' : '管理员面板'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 32px', position: 'relative' }}>
        {activeTab === 'apply' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
              gap: '32px',
            }}
          >
            {/* 取号卡片 */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)'
                e.currentTarget.style.borderColor = 'rgba(255, 107, 157, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: '0 0 24px 0',
                  background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                取号
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { label: '申请人姓名', value: applyName, onChange: setApplyName, placeholder: '例如：小王', type: 'text' },
                  { label: '事项简要描述', value: applyDesc, onChange: setApplyDesc, placeholder: '例如：需求评审 / 数据问题排查', type: 'text' },
                ].map((field) => (
                  <div key={field.label}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'rgba(232, 234, 246, 0.7)',
                        marginBottom: '8px',
                      }}
                    >
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: '#e8eaf6',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.3s',
                        fontFamily: 'inherit',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#ff6b9d'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 157, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'rgba(232, 234, 246, 0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    紧急程度
                  </label>
                  <select
                    value={applyPriority}
                    onChange={(e) => setApplyPriority(e.target.value as Priority)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#e8eaf6',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#ff6b9d'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                    }}
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'rgba(232, 234, 246, 0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    预计耗时（分钟）
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={applyEta}
                    onChange={(e) => setApplyEta(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#e8eaf6',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.3s',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#ff6b9d'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 157, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
                <button
                  onClick={createTicket}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 50%, #12c2e9 100%)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(255, 107, 157, 0.4)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    marginTop: '8px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 107, 157, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 157, 0.4)'
                  }}
                >
                  立即取号
                </button>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(232, 234, 246, 0.5)',
                    textAlign: 'center',
                    marginTop: '-8px',
                  }}
                >
                  当前等待：{waitingQueue.length} 人
                  {inProgress ? ' · 有人正在办理中' : ' · 暂无办理中'}
                </div>
                {applySuccessMsg ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: applySuccessMsg.startsWith('取号成功')
                        ? 'rgba(18, 194, 233, 0.15)'
                        : 'rgba(255, 193, 7, 0.15)',
                      border: `1px solid ${
                        applySuccessMsg.startsWith('取号成功')
                          ? 'rgba(18, 194, 233, 0.3)'
                          : 'rgba(255, 193, 7, 0.3)'
                      }`,
                      color: applySuccessMsg.startsWith('取号成功') ? '#12c2e9' : '#ffc107',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginTop: '8px',
                      animation: 'fadeIn 0.3s ease-in',
                    }}
                  >
                    {applySuccessMsg}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 查询卡片 */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)'
                e.currentTarget.style.borderColor = 'rgba(196, 113, 237, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: '0 0 24px 0',
                  background: 'linear-gradient(135deg, #c471ed 0%, #12c2e9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                查询排队情况
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'rgba(232, 234, 246, 0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    输入号码（例如 001）
                  </label>
                  <input
                    value={queryNumber}
                    onChange={(e) => setQueryNumber(e.target.value.trim())}
                    placeholder="例如：001"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#e8eaf6',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.3s',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#c471ed'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196, 113, 237, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {queriedTicket ? (
                  <div
                    style={{
                      padding: '24px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: '16px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)',
                          color: '#ffffff',
                          fontSize: '14px',
                          fontWeight: 700,
                        }}
                      >
                        号码 {queriedTicket.number}
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          background:
                            queriedTicket.priority === 'high'
                              ? 'rgba(255, 107, 157, 0.2)'
                              : queriedTicket.priority === 'medium'
                                ? 'rgba(255, 193, 7, 0.2)'
                                : 'rgba(18, 194, 233, 0.2)',
                          color:
                            queriedTicket.priority === 'high'
                              ? '#ff6b9d'
                              : queriedTicket.priority === 'medium'
                                ? '#ffc107'
                                : '#12c2e9',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {priorityLabel(queriedTicket.priority)}优先级
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          background: 'rgba(18, 194, 233, 0.2)',
                          color: '#12c2e9',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {statusLabel(queriedTicket.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(232, 234, 246, 0.8)', lineHeight: 1.8 }}>
                      <div>
                        <strong style={{ color: '#e8eaf6' }}>申请人：</strong>
                        {queriedTicket.name}
                      </div>
                      <div>
                        <strong style={{ color: '#e8eaf6' }}>事项：</strong>
                        {queriedTicket.desc}
                      </div>
                      <div>
                        <strong style={{ color: '#e8eaf6' }}>预计耗时：</strong>
                        {queriedTicket.etaMinutes} 分钟
                      </div>
                      <div>
                        <strong style={{ color: '#e8eaf6' }}>创建时间：</strong>
                        {new Date(queriedTicket.createdAt).toLocaleString()}
                      </div>
                      {queriedTicket.status === 'waiting' ? (
                        <div
                          style={{
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <div style={{ color: '#ff6b9d', fontWeight: 700 }}>
                            前面还有：{queriedAheadCount} 个号（含办理中）
                          </div>
                          <div style={{ marginTop: '6px' }}>
                            已等待：{formatDurationFrom(queriedTicket.createdAt, now)}
                          </div>
                        </div>
                      ) : null}
                      {queriedTicket.status === 'in_progress' ? (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '12px 16px',
                            background: 'rgba(18, 194, 233, 0.15)',
                            borderRadius: '8px',
                            color: '#12c2e9',
                            fontWeight: 600,
                          }}
                        >
                          你正在被办理中，请稍等。
                          {queriedTicket.startedAt ? (
                            <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.8 }}>
                              已开始办理：{formatDurationFrom(queriedTicket.startedAt, now)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {queriedTicket.status === 'done' ? (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '12px 16px',
                            background: 'rgba(18, 194, 233, 0.15)',
                            borderRadius: '8px',
                            color: '#12c2e9',
                            fontWeight: 600,
                          }}
                        >
                          已完成
                          {queriedTicket.result ? (
                            <div
                              style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid rgba(18, 194, 233, 0.3)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'rgba(232, 234, 246, 0.7)',
                                  marginBottom: '6px',
                                }}
                              >
                                处理结果：
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                                {queriedTicket.result}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {queriedTicket.status === 'skipped' ? (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '12px 16px',
                            background: 'rgba(255, 193, 7, 0.15)',
                            borderRadius: '8px',
                            color: '#ffc107',
                            fontWeight: 600,
                          }}
                        >
                          已过号，请联系管理员重新排队或重新取号。
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : queryNumber.trim() ? (
                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(255, 193, 7, 0.15)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 193, 7, 0.3)',
                      color: '#ffc107',
                      fontSize: '13px',
                    }}
                  >
                    未找到该号码，请确认输入是否正确（例如 001）。
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      color: 'rgba(232, 234, 246, 0.5)',
                      fontSize: '12px',
                      textAlign: 'center',
                    }}
                  >
                    提示：取号后把号码发给对方，用于自助查询。
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 统计卡片 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
              }}
            >
              {[
                { label: '今日已完成', value: todayDone.length, color: '#ff6b9d' },
                {
                  label: '平均等待时间',
                  value: `${avgTodayWaitMinutes} 分钟`,
                  color: '#c471ed',
                },
                {
                  label: '平均办理时间',
                  value: `${avgTodayHandleMinutes} 分钟`,
                  color: '#12c2e9',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    padding: '28px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'
                    e.currentTarget.style.boxShadow = `0 12px 40px rgba(0, 0, 0, 0.4), 0 0 40px ${stat.color}40`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: `radial-gradient(circle, ${stat.color}20 0%, transparent 70%)`,
                      borderRadius: '50%',
                      transform: 'translate(30%, -30%)',
                    }}
                  />
                  <div style={{ fontSize: '13px', color: 'rgba(232, 234, 246, 0.6)', marginBottom: '12px' }}>
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: typeof stat.value === 'number' ? '42px' : '32px',
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${stat.color} 0%, ${stat.color}dd 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* 当前办理中 */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: '0 0 24px 0',
                  background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                当前办理中
              </h2>
              {inProgress ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: '20px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '8px 20px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)',
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: 700,
                      }}
                    >
                      当前：{inProgress.number}
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background:
                          inProgress.priority === 'high'
                            ? 'rgba(255, 107, 157, 0.2)'
                            : inProgress.priority === 'medium'
                              ? 'rgba(255, 193, 7, 0.2)'
                              : 'rgba(18, 194, 233, 0.2)',
                        color:
                          inProgress.priority === 'high'
                            ? '#ff6b9d'
                            : inProgress.priority === 'medium'
                              ? '#ffc107'
                              : '#12c2e9',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      {priorityLabel(inProgress.priority)}优先级
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'rgba(232, 234, 246, 0.6)',
                      }}
                    >
                      申请人：{inProgress.name} · 预计 {inProgress.etaMinutes} 分钟
                      {inProgress.startedAt
                        ? ` · 已办理 ${formatDurationFrom(inProgress.startedAt, now)}`
                        : ''}
                    </span>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'rgba(232, 234, 246, 0.7)',
                        marginBottom: '10px',
                      }}
                    >
                      事项
                    </div>
                    <div
                      style={{
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: '#e8eaf6',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {inProgress.desc}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'rgba(232, 234, 246, 0.7)',
                        marginBottom: '10px',
                      }}
                    >
                      处理结果（可选）
                    </div>
                    <textarea
                      value={currentResultDraft}
                      onChange={(e) => setCurrentResultDraft(e.target.value)}
                      placeholder="记录处理结果/下一步/结论等"
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: '#e8eaf6',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical',
                        minHeight: '120px',
                        fontFamily: 'inherit',
                        transition: 'all 0.3s',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#ff6b9d'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 157, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={markDone}
                      style={{
                        padding: '14px 28px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(255, 107, 157, 0.4)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 107, 157, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)'
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 157, 0.4)'
                      }}
                    >
                      标记为已完成
                    </button>
                    <button
                      onClick={markSkipped}
                      style={{
                        padding: '14px 28px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 193, 7, 0.5)',
                        background: 'rgba(255, 193, 7, 0.1)',
                        color: '#ffc107',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 193, 7, 0.2)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 193, 7, 0.1)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      过号
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '60px',
                    textAlign: 'center',
                    color: 'rgba(232, 234, 246, 0.5)',
                    fontSize: '14px',
                  }}
                >
                  当前暂无正在办理的事项
                </div>
              )}
            </div>

            {/* 等待队列 */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '24px',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      margin: '0 0 8px 0',
                      background: 'linear-gradient(135deg, #c471ed 0%, #12c2e9 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    等待队列
                  </h2>
                  <div style={{ fontSize: '12px', color: 'rgba(232, 234, 246, 0.5)' }}>
                    规则：高优先级在前；同优先级按更早创建的先处理。
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={callNext}
                    disabled={!!inProgress || waitingQueue.length === 0}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      background:
                        inProgress || waitingQueue.length === 0
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)',
                      color:
                        inProgress || waitingQueue.length === 0
                          ? 'rgba(232, 234, 246, 0.3)'
                          : '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor:
                        inProgress || waitingQueue.length === 0 ? 'not-allowed' : 'pointer',
                      boxShadow:
                        inProgress || waitingQueue.length === 0
                          ? 'none'
                          : '0 4px 20px rgba(255, 107, 157, 0.4)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      if (!inProgress && waitingQueue.length > 0) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 107, 157, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!inProgress && waitingQueue.length > 0) {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)'
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 157, 0.4)'
                      }
                    }}
                  >
                    叫下一个号
                  </button>
                  <button
                    onClick={resetAll}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'rgba(232, 234, 246, 0.7)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 107, 157, 0.5)'
                      e.currentTarget.style.color = '#ff6b9d'
                      e.currentTarget.style.background = 'rgba(255, 107, 157, 0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.color = 'rgba(232, 234, 246, 0.7)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    清空数据
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}
                >
                  <thead>
                    <tr>
                      {['号码', '申请人', '事项', '优先级', '预计耗时', '等待时长', '操作'].map(
                        (header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: 'left',
                              padding: '16px 12px',
                              borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                              color: 'rgba(232, 234, 246, 0.6)',
                              fontWeight: 700,
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {waitingQueue.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: '60px',
                            textAlign: 'center',
                            color: 'rgba(232, 234, 246, 0.4)',
                            fontSize: '13px',
                          }}
                        >
                          当前没有等待中的号码
                        </td>
                      </tr>
                    ) : (
                      waitingQueue.map((t, idx) => (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <td style={{ padding: '16px 12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background:
                                  idx === 0
                                    ? 'linear-gradient(135deg, #ff6b9d 0%, #c471ed 100%)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                color: idx === 0 ? '#ffffff' : '#e8eaf6',
                                fontSize: '14px',
                                fontWeight: 700,
                              }}
                            >
                              {t.number}
                            </span>
                          </td>
                          <td style={{ padding: '16px 12px', color: '#e8eaf6' }}>{t.name}</td>
                          <td
                            style={{
                              padding: '16px 12px',
                              color: 'rgba(232, 234, 246, 0.8)',
                              maxWidth: '300px',
                            }}
                          >
                            <div
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {t.desc}
                            </div>
                          </td>
                          <td style={{ padding: '16px 12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                background:
                                  t.priority === 'high'
                                    ? 'rgba(255, 107, 157, 0.2)'
                                    : t.priority === 'medium'
                                      ? 'rgba(255, 193, 7, 0.2)'
                                      : 'rgba(18, 194, 233, 0.2)',
                                color:
                                  t.priority === 'high'
                                    ? '#ff6b9d'
                                    : t.priority === 'medium'
                                      ? '#ffc107'
                                      : '#12c2e9',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {priorityLabel(t.priority)}
                            </span>
                          </td>
                          <td style={{ padding: '16px 12px', color: 'rgba(232, 234, 246, 0.8)' }}>
                            {t.etaMinutes} 分钟
                          </td>
                          <td style={{ padding: '16px 12px', color: 'rgba(232, 234, 246, 0.8)' }}>
                            {formatDurationFrom(t.createdAt, now)}
                          </td>
                          <td style={{ padding: '16px 12px' }}>
                            <button
                              onClick={() => bumpPriority(t.id)}
                              disabled={t.priority === 'high'}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: t.priority === 'high' ? 'rgba(232, 234, 246, 0.3)' : '#e8eaf6',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: t.priority === 'high' ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                if (t.priority !== 'high') {
                                  e.currentTarget.style.borderColor = '#c471ed'
                                  e.currentTarget.style.color = '#c471ed'
                                  e.currentTarget.style.background = 'rgba(196, 113, 237, 0.1)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (t.priority !== 'high') {
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                                  e.currentTarget.style.color = '#e8eaf6'
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                                }
                              }}
                            >
                              提升优先级
        </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
      `}</style>
    </div>
  )
}

export default App
