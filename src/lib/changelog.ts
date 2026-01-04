/**
 * Changelog entries for the "What's New" dialog
 * Each entry represents a version with its features
 */

export interface ChangelogFeature {
  icon: string        // Material symbol icon name
  title: string
  description: string
}

export interface ChangelogEntry {
  version: string
  date: string
  title: string       // Friendly title like "Smart Task Input"
  features: ChangelogFeature[]
}

// Changelog entries - newest first
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: '2026-01-03',
    title: 'Smart Task Input',
    features: [
      {
        icon: 'magic_button',
        title: 'Natural Language Input',
        description: 'Type tasks naturally! "Meeting tomorrow 3pm #work" auto-fills date and category.'
      },
      {
        icon: 'translate',
        title: 'Malay Language Support',
        description: 'Full Bahasa Malaysia support - "esok pagi", "isnin depan", even SMS shortforms like "esk", "ptg"!'
      },
      {
        icon: 'notifications_active',
        title: 'Smart Reminders',
        description: 'Just type "remind me" or "ingatkan" to set reminders automatically.'
      },
      {
        icon: 'preview',
        title: 'Live Preview',
        description: 'See what\'s detected as you type - dates, categories, and reminders show instantly.'
      }
    ]
  }
]

/**
 * Get the latest changelog version
 */
export function getLatestVersion(): string {
  return CHANGELOG[0]?.version || '1.0.0'
}

/**
 * Get changelog entries newer than a given version
 */
export function getNewEntries(lastSeenVersion: string | null): ChangelogEntry[] {
  if (!lastSeenVersion) {
    // First time user - show latest only
    return CHANGELOG.slice(0, 1)
  }

  const newEntries: ChangelogEntry[] = []
  for (const entry of CHANGELOG) {
    if (compareVersions(entry.version, lastSeenVersion) > 0) {
      newEntries.push(entry)
    } else {
      break // Changelog is sorted newest first
    }
  }
  return newEntries
}

/**
 * Compare two semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}
