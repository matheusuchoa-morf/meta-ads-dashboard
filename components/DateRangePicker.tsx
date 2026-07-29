'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface DateRangePickerProps {
  onApply: (since: string, until: string) => void
  onCancel: () => void
  initialRange?: { since: string; until: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function isSameDay(a: string, b: string): boolean {
  return a === b
}

function isInRange(day: string, since: string | null, until: string | null): boolean {
  if (!since || !until) return false
  return day >= since && day <= until
}

// ─── Mini Calendar ──────────────────────────────────────────────────────────────
function MiniCalendar({
  year,
  month,
  selectedStart,
  selectedEnd,
  hoverDate,
  onDateClick,
  onDateHover,
  onPrev,
  onNext,
  label,
}: {
  year: number
  month: number
  selectedStart: string | null
  selectedEnd: string | null
  hoverDate: string | null
  onDateClick: (d: string) => void
  onDateHover: (d: string | null) => void
  onPrev: () => void
  onNext: () => void
  label: string
}) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = fmt(new Date())

  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(dateStr)
  }

  // Effective range for highlighting (including hover preview)
  const effectiveEnd = selectedEnd || hoverDate

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>
        {label}
      </span>
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={onPrev}
          className="p-1 rounded hover:opacity-70 transition-opacity cursor-pointer"
          style={{ color: 'var(--mit-text-muted)' }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--mit-text-primary)' }}>
          {MONTHS_PT[month].toUpperCase().slice(0, 3)}. DE {year}
        </span>
        <button
          onClick={onNext}
          className="p-1 rounded hover:opacity-70 transition-opacity cursor-pointer"
          style={{ color: 'var(--mit-text-muted)' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {DAYS_PT.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium py-1" style={{ color: 'var(--mit-text-subtle)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} className="h-8" />

          const isStart = selectedStart && isSameDay(dateStr, selectedStart)
          const isEnd = selectedEnd && isSameDay(dateStr, selectedEnd)
          const isHoverEnd = !selectedEnd && hoverDate && isSameDay(dateStr, hoverDate) && selectedStart
          const inRange = selectedStart && effectiveEnd && isInRange(dateStr, selectedStart, effectiveEnd)
          const isToday = isSameDay(dateStr, today)
          const isFuture = dateStr > today
          const dayNum = parseInt(dateStr.split('-')[2])

          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && onDateClick(dateStr)}
              onMouseEnter={() => onDateHover(dateStr)}
              onMouseLeave={() => onDateHover(null)}
              disabled={isFuture}
              className="h-8 w-full flex items-center justify-center text-xs rounded-md transition-all duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: isStart || isEnd || isHoverEnd
                  ? 'var(--mit-accent)'
                  : inRange
                    ? 'rgba(201,164,90,0.15)'
                    : 'transparent',
                color: isStart || isEnd || isHoverEnd
                  ? '#fff'
                  : isFuture
                    ? 'var(--mit-text-subtle)'
                    : 'var(--mit-text-primary)',
                fontWeight: isToday ? 700 : 400,
                border: isToday && !isStart && !isEnd ? '1px solid var(--mit-text-subtle)' : '1px solid transparent',
              }}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── DateRangePicker ────────────────────────────────────────────────────────────
export function DateRangePicker({ onApply, onCancel, initialRange }: DateRangePickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const now = new Date()

  // Start month calendar: show previous month by default, or initial range month
  const initStartMonth = initialRange
    ? new Date(initialRange.since + 'T12:00:00')
    : new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const initEndMonth = initialRange
    ? new Date(initialRange.until + 'T12:00:00')
    : now

  const [leftYear, setLeftYear] = useState(initStartMonth.getFullYear())
  const [leftMonth, setLeftMonth] = useState(initStartMonth.getMonth())
  const [rightYear, setRightYear] = useState(initEndMonth.getFullYear())
  const [rightMonth, setRightMonth] = useState(initEndMonth.getMonth())

  const [selectedStart, setSelectedStart] = useState<string | null>(initialRange?.since ?? null)
  const [selectedEnd, setSelectedEnd] = useState<string | null>(initialRange?.until ?? null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [picking, setPicking] = useState<'start' | 'end'>('start')

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onCancel])

  const handleDateClick = useCallback((dateStr: string) => {
    if (picking === 'start') {
      setSelectedStart(dateStr)
      setSelectedEnd(null)
      setPicking('end')
    } else {
      // If clicked date is before start, swap
      if (selectedStart && dateStr < selectedStart) {
        setSelectedEnd(selectedStart)
        setSelectedStart(dateStr)
      } else {
        setSelectedEnd(dateStr)
      }
      setPicking('start')
    }
  }, [picking, selectedStart])

  const handleApply = () => {
    if (selectedStart && selectedEnd) {
      onApply(selectedStart, selectedEnd)
    } else if (selectedStart) {
      // If only start selected, use same day
      onApply(selectedStart, selectedStart)
    }
  }

  // Navigation helpers
  const prevLeft = () => {
    if (leftMonth === 0) { setLeftYear(y => y - 1); setLeftMonth(11) }
    else setLeftMonth(m => m - 1)
  }
  const nextLeft = () => {
    const nextM = leftMonth === 11 ? 0 : leftMonth + 1
    const nextY = leftMonth === 11 ? leftYear + 1 : leftYear
    // Don't overlap with right calendar
    if (nextY < rightYear || (nextY === rightYear && nextM < rightMonth)) {
      setLeftYear(nextY); setLeftMonth(nextM)
    }
  }
  const prevRight = () => {
    const prevM = rightMonth === 0 ? 11 : rightMonth - 1
    const prevY = rightMonth === 0 ? rightYear - 1 : rightYear
    if (prevY > leftYear || (prevY === leftYear && prevM > leftMonth)) {
      setRightYear(prevY); setRightMonth(prevM)
    }
  }
  const nextRight = () => {
    if (rightMonth === 11) { setRightYear(y => y + 1); setRightMonth(0) }
    else setRightMonth(m => m + 1)
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-2 z-50 rounded-xl border shadow-2xl p-5"
      style={{
        background: 'var(--mit-bg-card)',
        borderColor: 'var(--mit-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      {/* Selection indicator */}
      <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
        <Calendar size={13} />
        <span>
          {picking === 'start' ? 'Selecione a data de início' : 'Selecione a data de término'}
        </span>
        {selectedStart && (
          <span className="ml-auto font-medium" style={{ color: 'var(--mit-accent)' }}>
            {selectedStart}{selectedEnd ? ` → ${selectedEnd}` : ''}
          </span>
        )}
      </div>

      {/* Two calendars side by side (stacked on mobile) */}
      <div className="flex flex-col sm:flex-row gap-6">
        <MiniCalendar
          year={leftYear}
          month={leftMonth}
          selectedStart={selectedStart}
          selectedEnd={selectedEnd}
          hoverDate={picking === 'end' ? hoverDate : null}
          onDateClick={handleDateClick}
          onDateHover={setHoverDate}
          onPrev={prevLeft}
          onNext={nextLeft}
          label="Data de início"
        />
        <div className="hidden sm:block w-px" style={{ background: 'var(--mit-border)' }} />
        <MiniCalendar
          year={rightYear}
          month={rightMonth}
          selectedStart={selectedStart}
          selectedEnd={selectedEnd}
          hoverDate={picking === 'end' ? hoverDate : null}
          onDateClick={handleDateClick}
          onDateHover={setHoverDate}
          onPrev={prevRight}
          onNext={nextRight}
          label="Data de término"
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--mit-border)' }}>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg transition-opacity hover:opacity-70 cursor-pointer"
          style={{ color: 'var(--mit-text-muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleApply}
          disabled={!selectedStart}
          className="px-5 py-2 text-sm font-medium rounded-lg transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'var(--mit-accent)',
            color: '#fff',
          }}
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
