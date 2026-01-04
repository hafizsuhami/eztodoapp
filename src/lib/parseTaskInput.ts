import * as chrono from 'chrono-node'

export interface ParsedTask {
  title: string
  dueDate: Date | null
  dueDateText: string | null
  categoryId: string | null
  categoryName: string | null
  hasReminder: boolean
}

export interface CategoryOption {
  id: string
  name: string
}

// ============================================
// Malay (Bahasa Malaysia) Date/Time Parser
// ============================================

interface MalayParseResult {
  date: Date | null
  matchedText: string | null
}

// Days of the week in Malay (including SMS shortforms)
const MALAY_DAYS: Record<string, number> = {
  // Full forms
  'ahad': 0,
  'minggu': 0, // Alternative for Sunday
  'isnin': 1,
  'selasa': 2,
  'rabu': 3,
  'khamis': 4,
  'jumaat': 5,
  "jum'at": 5,
  'sabtu': 6,
  // SMS shortforms
  'isn': 1,
  'sls': 2,
  'rbu': 3,
  'khm': 4,
  'kms': 4,
  'jmt': 5,
  'jum': 5,
  'sbt': 6,
  'ahd': 0
}

// Months in Malay (including SMS shortforms)
const MALAY_MONTHS: Record<string, number> = {
  // Full forms
  'januari': 0,
  'februari': 1,
  'mac': 2,
  'april': 3,
  'mei': 4,
  'jun': 5,
  'julai': 6,
  'ogos': 7,
  'september': 8,
  'oktober': 9,
  'november': 10,
  'disember': 11,
  // SMS shortforms
  'jan': 0,
  'feb': 1,
  'apr': 3,
  'jul': 6,
  'ogs': 7,
  'okt': 9,
  'nov': 10,
  'dis': 11,
  'dsb': 11
}

// Time periods in Malay (with default hours, including SMS shortforms)
const MALAY_TIME_PERIODS: Record<string, number> = {
  // Full forms
  'pagi': 8,           // Morning - 8am
  'tengah hari': 12,   // Noon - 12pm
  'tengahari': 12,     // Noon (no space)
  'petang': 15,        // Afternoon - 3pm
  'malam': 20,         // Night - 8pm
  // SMS shortforms
  'pg': 8,
  'pgi': 8,
  'ptg': 15,
  'tghri': 12,
  'mlm': 20,
  'mlam': 20
}

/**
 * Parse Malay date/time expressions
 */
function parseMalayDate(text: string): MalayParseResult {
  const now = new Date()
  let date: Date | null = null
  let matchedText: string | null = null

  // Relative days (including SMS shortforms)
  const relativeDays: Array<{ pattern: RegExp; daysOffset: number }> = [
    // Day before yesterday
    { pattern: /\bkelmarin\b/i, daysOffset: -2 },
    { pattern: /\bklmrn\b/i, daysOffset: -2 },
    { pattern: /\bklmarin\b/i, daysOffset: -2 },
    // Yesterday
    { pattern: /\bsemalam\b/i, daysOffset: -1 },
    { pattern: /\bsmlm\b/i, daysOffset: -1 },
    { pattern: /\bsmalam\b/i, daysOffset: -1 },
    // Today
    { pattern: /\bhari ini\b/i, daysOffset: 0 },
    { pattern: /\bhari ni\b/i, daysOffset: 0 },
    { pattern: /\bhr ini\b/i, daysOffset: 0 },
    { pattern: /\bhrini\b/i, daysOffset: 0 },
    { pattern: /\bhr ni\b/i, daysOffset: 0 },
    { pattern: /\bhrni\b/i, daysOffset: 0 },
    // Tomorrow
    { pattern: /\besok\b/i, daysOffset: 1 },
    { pattern: /\besk\b/i, daysOffset: 1 },
    { pattern: /\besk\b/i, daysOffset: 1 },
    { pattern: /\bbsk\b/i, daysOffset: 1 },
    { pattern: /\bbesok\b/i, daysOffset: 1 },
    // Day after tomorrow
    { pattern: /\blusa\b/i, daysOffset: 2 },
    { pattern: /\blsa\b/i, daysOffset: 2 },
    // 3 days from now
    { pattern: /\btulat\b/i, daysOffset: 3 },
    { pattern: /\btlt\b/i, daysOffset: 3 }
  ]

  for (const { pattern, daysOffset } of relativeDays) {
    const match = text.match(pattern)
    if (match) {
      date = new Date(now)
      date.setDate(date.getDate() + daysOffset)
      date.setHours(0, 0, 0, 0)
      matchedText = match[0]
      break
    }
  }

  // Relative weeks: minggu depan, minggu lepas, minggu ini (including shortforms)
  if (!date) {
    const weekPatterns: Array<{ pattern: RegExp; weeksOffset: number }> = [
      // Full forms
      { pattern: /\bminggu lepas\b/i, weeksOffset: -1 },
      { pattern: /\bminggu ini\b/i, weeksOffset: 0 },
      { pattern: /\bminggu depan\b/i, weeksOffset: 1 },
      { pattern: /\bminggu hadapan\b/i, weeksOffset: 1 },
      // SMS shortforms
      { pattern: /\bmggu lps\b/i, weeksOffset: -1 },
      { pattern: /\bmggu lpas\b/i, weeksOffset: -1 },
      { pattern: /\bmggu ni\b/i, weeksOffset: 0 },
      { pattern: /\bmggu dpn\b/i, weeksOffset: 1 },
      { pattern: /\bmggu depan\b/i, weeksOffset: 1 },
      { pattern: /\bnext week\b/i, weeksOffset: 1 }  // English fallback
    ]

    for (const { pattern, weeksOffset } of weekPatterns) {
      const match = text.match(pattern)
      if (match) {
        date = new Date(now)
        date.setDate(date.getDate() + (weeksOffset * 7))
        // Set to Monday of that week
        const dayOfWeek = date.getDay()
        const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
        if (weeksOffset > 0) {
          date.setDate(date.getDate() + daysToMonday)
        }
        date.setHours(0, 0, 0, 0)
        matchedText = match[0]
        break
      }
    }
  }

  // Relative months: bulan depan, bulan lepas, bulan ini (including shortforms)
  if (!date) {
    const monthPatterns: Array<{ pattern: RegExp; monthsOffset: number }> = [
      // Full forms
      { pattern: /\bbulan lepas\b/i, monthsOffset: -1 },
      { pattern: /\bbulan ini\b/i, monthsOffset: 0 },
      { pattern: /\bbulan depan\b/i, monthsOffset: 1 },
      { pattern: /\bbulan hadapan\b/i, monthsOffset: 1 },
      // SMS shortforms
      { pattern: /\bbln lps\b/i, monthsOffset: -1 },
      { pattern: /\bbln lpas\b/i, monthsOffset: -1 },
      { pattern: /\bbln ni\b/i, monthsOffset: 0 },
      { pattern: /\bbln dpn\b/i, monthsOffset: 1 },
      { pattern: /\bbln depan\b/i, monthsOffset: 1 },
      { pattern: /\bnext month\b/i, monthsOffset: 1 }  // English fallback
    ]

    for (const { pattern, monthsOffset } of monthPatterns) {
      const match = text.match(pattern)
      if (match) {
        date = new Date(now)
        date.setMonth(date.getMonth() + monthsOffset, 1) // First day of month
        date.setHours(0, 0, 0, 0)
        matchedText = match[0]
        break
      }
    }
  }

  // Relative years: tahun depan, tahun lepas, tahun ini
  if (!date) {
    const yearPatterns: Array<{ pattern: RegExp; yearsOffset: number }> = [
      { pattern: /\btahun lepas\b/i, yearsOffset: -1 },
      { pattern: /\btahun ini\b/i, yearsOffset: 0 },
      { pattern: /\btahun depan\b/i, yearsOffset: 1 },
      { pattern: /\btahun hadapan\b/i, yearsOffset: 1 }
    ]

    for (const { pattern, yearsOffset } of yearPatterns) {
      const match = text.match(pattern)
      if (match) {
        date = new Date(now)
        date.setFullYear(date.getFullYear() + yearsOffset, 0, 1) // Jan 1st
        date.setHours(0, 0, 0, 0)
        matchedText = match[0]
        break
      }
    }
  }

  // Day of week: hari isnin, isnin depan, etc.
  if (!date) {
    for (const [dayName, dayIndex] of Object.entries(MALAY_DAYS)) {
      // Match "hari X", "X depan", "X ini", or just "X"
      const patterns = [
        new RegExp(`\\bhari\\s+${dayName}\\b`, 'i'),
        new RegExp(`\\b${dayName}\\s+depan\\b`, 'i'),
        new RegExp(`\\b${dayName}\\s+ini\\b`, 'i'),
        new RegExp(`\\b${dayName}\\b`, 'i')
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
          date = new Date(now)
          const currentDay = date.getDay()
          let daysUntil = dayIndex - currentDay

          // If "depan" or day has passed, go to next week
          if (match[0].toLowerCase().includes('depan') || daysUntil <= 0) {
            daysUntil += 7
          }
          if (daysUntil <= 0) daysUntil += 7

          date.setDate(date.getDate() + daysUntil)
          date.setHours(0, 0, 0, 0)
          matchedText = match[0]
          break
        }
      }
      if (date) break
    }
  }

  // Month with day: "15 januari", "januari 15"
  if (!date) {
    for (const [monthName, monthIndex] of Object.entries(MALAY_MONTHS)) {
      // "15 januari" or "januari 15"
      const patterns = [
        new RegExp(`\\b(\\d{1,2})\\s+${monthName}\\b`, 'i'),
        new RegExp(`\\b${monthName}\\s+(\\d{1,2})\\b`, 'i')
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
          const day = parseInt(match[1], 10)
          if (day >= 1 && day <= 31) {
            date = new Date(now.getFullYear(), monthIndex, day)
            // If date has passed, use next year
            if (date < now) {
              date.setFullYear(date.getFullYear() + 1)
            }
            date.setHours(0, 0, 0, 0)
            matchedText = match[0]
            break
          }
        }
      }
      if (date) break
    }
  }

  // Time of day: pagi, petang, malam, tengah hari
  if (date) {
    for (const [timeName, hour] of Object.entries(MALAY_TIME_PERIODS)) {
      const pattern = new RegExp(`\\b${timeName}\\b`, 'i')
      const match = text.match(pattern)
      if (match) {
        date.setHours(hour, 0, 0, 0)
        matchedText = matchedText ? `${matchedText} ${match[0]}` : match[0]
        break
      }
    }
  } else {
    // Check for standalone time periods (implies today)
    for (const [timeName, hour] of Object.entries(MALAY_TIME_PERIODS)) {
      const pattern = new RegExp(`\\b${timeName}\\b`, 'i')
      const match = text.match(pattern)
      if (match) {
        date = new Date(now)
        date.setHours(hour, 0, 0, 0)
        // If time has passed, use tomorrow
        if (date < now) {
          date.setDate(date.getDate() + 1)
        }
        matchedText = match[0]
        break
      }
    }
  }

  // Specific time: "pukul 3", "jam 3", "3 petang", "10 pagi" (including shortforms)
  if (!matchedText || (date && date.getHours() === 0)) {
    // Pattern: pukul/jam/pkl followed by number
    const timePatterns = [
      /\bpukul\s+(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam|pg|ptg|mlm)?\b/i,
      /\bpkul\s+(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam|pg|ptg|mlm)?\b/i,
      /\bpkl\s+(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam|pg|ptg|mlm)?\b/i,
      /\bjam\s+(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam|pg|ptg|mlm)?\b/i,
      /\bjm\s+(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam|pg|ptg|mlm)?\b/i,
      /\b(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam|pg|ptg|mlm)\b/i
    ]

    for (const pattern of timePatterns) {
      const match = text.match(pattern)
      if (match) {
        let hour = parseInt(match[1], 10)
        const minutes = match[2] ? parseInt(match[2], 10) : 0
        const period = match[3]?.toLowerCase()

        // Adjust for AM/PM based on period (including shortforms)
        if (period === 'petang' || period === 'ptg' || period === 'malam' || period === 'mlm') {
          if (hour < 12) hour += 12
        } else if ((period === 'pagi' || period === 'pg') && hour === 12) {
          hour = 0
        }

        if (!date) {
          date = new Date(now)
          date.setHours(hour, minutes, 0, 0)
          if (date < now) {
            date.setDate(date.getDate() + 1)
          }
        } else {
          date.setHours(hour, minutes, 0, 0)
        }
        matchedText = matchedText ? `${matchedText} ${match[0]}` : match[0]
        break
      }
    }
  }

  return { date, matchedText }
}

/**
 * Parse natural language task input (supports English and Malay)
 *
 * Syntax:
 * - English dates: "tomorrow", "next friday", "3pm", "jan 15"
 * - Malay dates: "esok", "lusa", "isnin depan", "15 januari", "petang"
 * - Malay shortforms: "esk", "bsk", "ptg", "mlm", "mggu dpn"
 * - Categories: "#work", "#personal" (matches against user's categories)
 * - Reminders:
 *   - Prefix: !reminder, !remind, !peringatan, !ingat, @remind
 *   - Natural: "remind me", "ingatkan", "ingatkan saya"
 *
 * Examples:
 * - "Buy milk tomorrow 9am #personal !reminder"
 * - "Beli susu esk pgi #peribadi ingatkan"
 * - "Meeting isn dpn ptg #work remind me"
 */
export function parseTaskInput(input: string, categories: CategoryOption[]): ParsedTask {
  let text = input.trim()
  let categoryId: string | null = null
  let categoryName: string | null = null
  let hasReminder = false

  // Extract category: #work, #personal, etc.
  const categoryMatch = text.match(/#(\w+)/i)
  if (categoryMatch) {
    const searchTerm = categoryMatch[1].toLowerCase()
    const found = categories.find(c =>
      c.name.toLowerCase() === searchTerm ||
      c.name.toLowerCase().startsWith(searchTerm)
    )
    if (found) {
      categoryId = found.id
      categoryName = found.name
    }
    // Remove category tag from text
    text = text.replace(/#\w+/gi, '').trim()
  }

  // Extract reminder flag - supports multiple formats:
  // With ! prefix: !reminder, !remind, !peringatan, !ingat, !ingatkan
  // With @ prefix: @remind, @reminder
  // Keywords: [remind me], [ingatkan], [peringatan]
  const reminderPatterns = [
    // With ! prefix (most common)
    /!remind(er)?/gi,
    /!peringatan/gi,
    /!ingat(kan)?/gi,
    /!notify/gi,
    /!alert/gi,
    // With @ prefix
    /@remind(er)?/gi,
    // Natural language (English)
    /\bremind\s+me\b/gi,
    /\bset\s+remind(er)?\b/gi,
    /\bwith\s+remind(er)?\b/gi,
    // Natural language (Malay)
    /\bingatkan\s+(saya|aku)\b/gi,
    /\bingatkan\b/gi,
    /\bperingatan\b/gi,
    /\bnotify\s+me\b/gi
  ]

  for (const pattern of reminderPatterns) {
    if (pattern.test(text)) {
      hasReminder = true
      text = text.replace(pattern, '').trim()
    }
  }

  let dueDate: Date | null = null
  let dueDateText: string | null = null

  // Try Malay parser first
  const malayResult = parseMalayDate(text)
  if (malayResult.date && malayResult.matchedText) {
    dueDate = malayResult.date
    dueDateText = malayResult.matchedText
    // Remove matched Malay text from title
    text = text.replace(new RegExp(escapeRegex(malayResult.matchedText), 'gi'), '').trim()
  }

  // If no Malay match, try English with chrono
  if (!dueDate) {
    const parsed = chrono.parse(text, new Date(), { forwardDate: true })
    if (parsed.length > 0) {
      const result = parsed[0]
      dueDate = result.date()
      dueDateText = result.text
      // Remove parsed date text from title
      text = text.replace(result.text, '').trim()
    }
  }

  // Clean up extra spaces
  const title = text.replace(/\s+/g, ' ').trim()

  return {
    title,
    dueDate,
    dueDateText,
    categoryId,
    categoryName,
    hasReminder
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Format a date for display in preview
 */
export function formatParsedDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0

  if (dateOnly.getTime() === today.getTime()) {
    return hasTime ? `Today, ${timeStr}` : 'Today'
  }

  if (dateOnly.getTime() === tomorrow.getTime()) {
    return hasTime ? `Tomorrow, ${timeStr}` : 'Tomorrow'
  }

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  return hasTime ? `${dateStr}, ${timeStr}` : dateStr
}
