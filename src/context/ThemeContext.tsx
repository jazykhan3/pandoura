import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

// Preset accent colors
export const PRESET_ACCENT_COLORS = [
  { name: 'Panda Orange', value: '#FF6A00' },
  { name: 'Electric Blue', value: '#3B82F6' },
  { name: 'Emerald Green', value: '#10B981' },
  { name: 'Royal Purple', value: '#8B5CF6' },
  { name: 'Rose Pink', value: '#F43F5E' },
  { name: 'Amber Gold', value: '#F59E0B' },
  { name: 'Teal Cyan', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
] as const

interface ContrastResult {
  ratio: number
  passesAA: boolean
  passesAAA: boolean
  passesAALarge: boolean
  passesAAALarge: boolean
  isLowContrast: boolean
  suggestedColor?: string
}

interface ThemeContextType {
  theme: Theme
  actualTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  accentColor: string
  setAccentColor: (color: string) => void
  getContrastRatio: (color1: string, color2: string) => number
  checkContrast: (foreground: string, background: string) => ContrastResult
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
}

// Color utility functions
function hexToRgb(hex: string): [number, number, number] {
  const sanitized = hex.replace('#', '')
  const match = sanitized.match(/.{1,2}/g)
  if (!match || match.length < 3) return [255, 255, 255]
  return [
    parseInt(match[0], 16),
    parseInt(match[1], 16),
    parseInt(match[2], 16)
  ]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  const lum1 = relativeLuminance(...rgb1)
  const lum2 = relativeLuminance(...rgb2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

// Adjust color lightness to improve contrast - LIMITED to 3 shades (15% max adjustment)
function adjustColorForContrast(hex: string, background: string, _targetRatio: number = 4.5): string {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const bgLuminance = relativeLuminance(...hexToRgb(background))
  
  // Determine if we need to go lighter or darker
  const needsDarker = bgLuminance > 0.5
  
  // Maximum adjustment is 15% (about 3 shades) - don't suggest drastically different colors
  const maxAdjustment = 15
  
  // Try adjusting lightness in small steps, up to max adjustment
  for (let adjustment = 5; adjustment <= maxAdjustment; adjustment += 5) {
    const newL = needsDarker 
      ? Math.max(0, l - adjustment) 
      : Math.min(100, l + adjustment)
    
    const newHex = hslToHex(h, s, newL)
    return newHex // Return the slightly adjusted color
  }
  
  // Return color with max adjustment (3 shades darker/lighter)
  const newL = needsDarker 
    ? Math.max(0, l - maxAdjustment) 
    : Math.min(100, l + maxAdjustment)
  return hslToHex(h, s, newL)
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function checkContrast(foreground: string, background: string): ContrastResult {
  const ratio = getContrastRatio(foreground, background)
  
  // Only flag as low contrast if it's REALLY bad (below 3:1)
  // This means only very light colors like yellow, light pink, etc. will trigger warnings
  const isLowContrast = ratio < 3 // Only flag very light colors
  
  let suggestedColor: string | undefined
  if (isLowContrast) {
    // When checking white text (#FFFFFF) on a background (accent color),
    // we want to suggest a slightly darker version of the BACKGROUND (accent) color
    if (foreground.toUpperCase() === '#FFFFFF') {
      // Suggest a slightly darker version (max 3 shades)
      suggestedColor = adjustColorForContrast(background, foreground, 3)
    } else {
      suggestedColor = adjustColorForContrast(foreground, background, 3)
    }
  }
  
  return {
    ratio,
    passesAA: ratio >= 4.5,        // WCAG AA for normal text
    passesAAA: ratio >= 7,          // WCAG AAA for normal text
    passesAALarge: ratio >= 3,      // WCAG AA for large text (this is our threshold)
    passesAAALarge: ratio >= 4.5,   // WCAG AAA for large text
    isLowContrast,
    suggestedColor,
  }
}

// Generate CSS color variations from a base accent color
function generateColorVariations(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  
  return {
    '--accent-color': hex,
    '--accent-color-rgb': `${r}, ${g}, ${b}`,
    '--accent-color-h': `${h}`,
    '--accent-color-s': `${s}%`,
    '--accent-color-l': `${l}%`,
    '--accent-hover': `hsl(${h}, ${s}%, ${Math.max(0, l - 10)}%)`,
    '--accent-light': `hsl(${h}, ${s}%, ${Math.min(95, l + 25)}%)`,
    '--accent-dark': `hsl(${h}, ${s}%, ${Math.max(0, l - 15)}%)`,
    '--accent-subtle': `hsla(${h}, ${s}%, ${l}%, 0.1)`,
    '--accent-muted': `hsla(${h}, ${s}%, ${l}%, 0.2)`,
  }
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system'
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    return savedTheme || defaultTheme
  })

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light')
  
  const [accentColor, setAccentColorState] = useState<string>(() => {
    const savedAccent = localStorage.getItem('accentColor')
    return savedAccent || '#FF6A00'
  })

  // Apply accent color CSS variables to the document
  const applyAccentColor = useCallback((color: string) => {
    const root = document.documentElement
    const variations = generateColorVariations(color)
    
    Object.entries(variations).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }, [])

  const setAccentColor = useCallback((color: string) => {
    setAccentColorState(color)
    localStorage.setItem('accentColor', color)
    applyAccentColor(color)
  }, [applyAccentColor])

  useEffect(() => {
    const updateActualTheme = () => {
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setActualTheme(systemPrefersDark ? 'dark' : 'light')
      } else {
        setActualTheme(theme)
      }
    }

    updateActualTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', updateActualTheme)

    return () => {
      mediaQuery.removeEventListener('change', updateActualTheme)
    }
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    
    if (actualTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    localStorage.setItem('theme', theme)
  }, [theme, actualTheme])

  // Apply accent color on mount and when it changes
  useEffect(() => {
    applyAccentColor(accentColor)
  }, [accentColor, applyAccentColor])

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
    accentColor,
    setAccentColor,
    getContrastRatio,
    checkContrast,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
