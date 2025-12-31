import type { CategoryOption } from './types';

export const PASTEL_COLORS: string[] = [
  '#BFDBFE', // blue-200
  '#C7D2FE', // indigo-200
  '#FBCFE8', // pink-200
  '#FDE68A', // yellow-200
  '#A7F3D0', // emerald-200
  '#BBF7D0', // green-200
  '#FCD34D', // amber-300
  '#FCA5A5', // red-200
  '#F8B4ED', // fuchsia-ish
  '#C4B5FD', // violet-200
];

export const DEFAULT_CATEGORIES: CategoryOption[] = [
  { id: 'cat-work', name: 'Work', color: '#3B82F6' },
  { id: 'cat-personal', name: 'Personal', color: '#10B981' },
  { id: 'cat-health', name: 'Health', color: '#EC4899' },
  { id: 'cat-family', name: 'Family', color: '#8B5CF6' }
];

export const THEME_PRESETS = {
  light: {
    name: 'Light',
    tokens: {
      '--background': '0 0% 100%',
      '--foreground': '222.2 84% 4.9%',
      '--card': '0 0% 100%',
      '--card-foreground': '222.2 84% 4.9%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '222.2 84% 4.9%',
      '--primary': '221.2 83.2% 53.3%',
      '--primary-foreground': '210 40% 98%',
      '--secondary': '210 40% 96.1%',
      '--secondary-foreground': '222.2 47.4% 11.2%',
      '--muted': '210 40% 96.1%',
      '--muted-foreground': '215.4 16.3% 46.9%',
      '--accent': '210 40% 96.1%',
      '--accent-foreground': '222.2 47.4% 11.2%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '214.3 31.8% 91.4%',
      '--input': '214.3 31.8% 91.4%',
      '--ring': '221.2 83.2% 53.3%',
    }
  },
  dark: {
    name: 'Dark',
    tokens: {
      '--background': '222.2 84% 4.9%',
      '--foreground': '210 40% 98%',
      '--card': '222.2 84% 4.9%',
      '--card-foreground': '210 40% 98%',
      '--popover': '222.2 84% 4.9%',
      '--popover-foreground': '210 40% 98%',
      '--primary': '217.2 91.2% 59.8%',
      '--primary-foreground': '222.2 47.4% 11.2%',
      '--secondary': '217.2 32.6% 17.5%',
      '--secondary-foreground': '210 40% 98%',
      '--muted': '217.2 32.6% 17.5%',
      '--muted-foreground': '215 20.2% 65.1%',
      '--accent': '217.2 32.6% 17.5%',
      '--accent-foreground': '210 40% 98%',
      '--destructive': '0 62.8% 30.6%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '217.2 32.6% 17.5%',
      '--input': '217.2 32.6% 17.5%',
      '--ring': '224.3 76.3% 48%',
    }
  },
  dim: {
    name: 'Dim',
    tokens: {
      '--background': '220 22% 10%',
      '--foreground': '210 20% 95%',
      '--card': '220 22% 12%',
      '--card-foreground': '210 20% 95%',
      '--popover': '220 22% 12%',
      '--popover-foreground': '210 20% 95%',
      '--primary': '215 70% 60%',
      '--primary-foreground': '222 47% 11%',
      '--secondary': '220 18% 18%',
      '--secondary-foreground': '210 20% 95%',
      '--muted': '220 18% 18%',
      '--muted-foreground': '215 15% 70%',
      '--accent': '220 18% 18%',
      '--accent-foreground': '210 20% 95%',
      '--destructive': '0 62% 45%',
      '--destructive-foreground': '210 20% 95%',
      '--border': '220 18% 20%',
      '--input': '220 18% 20%',
      '--ring': '215 70% 60%',
    }
  },
  sepia: {
    name: 'Sepia',
    tokens: {
      '--background': '35 40% 92%',
      '--foreground': '25 30% 22%',
      '--card': '35 40% 94%',
      '--card-foreground': '25 30% 22%',
      '--popover': '35 40% 94%',
      '--popover-foreground': '25 30% 22%',
      '--primary': '25 65% 45%',
      '--primary-foreground': '35 40% 94%',
      '--secondary': '35 35% 85%',
      '--secondary-foreground': '25 30% 25%',
      '--muted': '35 35% 85%',
      '--muted-foreground': '25 25% 35%',
      '--accent': '25 40% 75%',
      '--accent-foreground': '25 30% 25%',
      '--destructive': '5 70% 50%',
      '--destructive-foreground': '35 40% 96%',
      '--border': '30 25% 70%',
      '--input': '30 25% 70%',
      '--ring': '25 65% 45%',
    }
  },
  vibrantPurple: {
    name: 'Vibrant Purple',
    tokens: {
      '--background': '250 45% 10%',
      '--foreground': '260 20% 95%',
      '--card': '252 40% 12%',
      '--card-foreground': '260 20% 95%',
      '--popover': '252 40% 12%',
      '--popover-foreground': '260 20% 95%',
      '--primary': '270 90% 65%',
      '--primary-foreground': '250 45% 10%',
      '--secondary': '250 35% 20%',
      '--secondary-foreground': '260 20% 95%',
      '--muted': '250 35% 20%',
      '--muted-foreground': '260 15% 75%',
      '--accent': '280 65% 65%',
      '--accent-foreground': '250 45% 12%',
      '--destructive': '0 70% 55%',
      '--destructive-foreground': '260 20% 95%',
      '--border': '250 30% 28%',
      '--input': '250 30% 28%',
      '--ring': '270 90% 65%',
    }
  },
  blush: {
    name: 'Blush',
    tokens: {
      '--background': '340 50% 98%',
      '--foreground': '335 25% 20%',
      '--card': '340 45% 99%',
      '--card-foreground': '335 25% 20%',
      '--popover': '340 45% 99%',
      '--popover-foreground': '335 25% 20%',
      '--primary': '340 70% 60%',
      '--primary-foreground': '350 60% 98%',
      '--secondary': '335 35% 90%',
      '--secondary-foreground': '335 25% 25%',
      '--muted': '335 30% 92%',
      '--muted-foreground': '335 20% 40%',
      '--accent': '355 70% 72%',
      '--accent-foreground': '335 25% 18%',
      '--destructive': '0 70% 58%',
      '--destructive-foreground': '350 60% 98%',
      '--border': '335 25% 85%',
      '--input': '335 25% 85%',
      '--ring': '340 70% 60%',
    }
  },
  playful: {
    name: 'Playful Kids',
    tokens: {
      '--background': '195 70% 96%',
      '--foreground': '205 25% 20%',
      '--card': '195 65% 97%',
      '--card-foreground': '205 25% 20%',
      '--popover': '195 65% 97%',
      '--popover-foreground': '205 25% 20%',
      '--primary': '200 85% 55%',
      '--primary-foreground': '195 70% 96%',
      '--secondary': '35 90% 60%',
      '--secondary-foreground': '205 25% 20%',
      '--muted': '195 35% 88%',
      '--muted-foreground': '205 20% 35%',
      '--accent': '150 65% 55%',
      '--accent-foreground': '195 70% 96%',
      '--destructive': '5 80% 58%',
      '--destructive-foreground': '195 70% 96%',
      '--border': '195 25% 80%',
      '--input': '195 25% 80%',
      '--ring': '200 85% 55%',
    }
  }
} as const;
