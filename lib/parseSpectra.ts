export type SpectraType = 'raman' | 'ftir' | 'xrd'

export type SpectraData = {
  x: number[]
  y: number[]
  xLabel: string
  yLabel: string
}

export type Peak = {
  x: number
  y: number
  label?: string
}

const X_LABELS: Record<SpectraType, string> = {
  raman: 'Wavenumber (cm⁻¹)',
  ftir: 'Wavenumber (cm⁻¹)',
  xrd: '2θ (°)',
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range === 0) return values.map(() => 0)
  return values.map((v) => (v - min) / range)
}

function parseLine(line: string): [number, number] | null {
  // Handle comma, tab, semicolon, or whitespace delimiters
  const parts = line.trim().split(/[,\t;]+|\s+/)
  if (parts.length < 2) return null
  const x = parseFloat(parts[0])
  const y = parseFloat(parts[1])
  if (isNaN(x) || isNaN(y)) return null
  return [x, y]
}

export function parseSpectra(text: string, type: SpectraType): SpectraData {
  const lines = text.split(/\r?\n/)
  const points: [number, number][] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    // Skip header lines that contain non-numeric first tokens
    const parsed = parseLine(trimmed)
    if (parsed) points.push(parsed)
  }

  if (points.length === 0) {
    throw new Error('No valid two-column numeric data found in file.')
  }

  // Sort by x ascending
  points.sort((a, b) => a[0] - b[0])

  const x = points.map((p) => p[0])
  const y = normalize(points.map((p) => p[1]))

  return {
    x,
    y,
    xLabel: X_LABELS[type],
    yLabel: 'Intensity (normalized)',
  }
}

// Extract the top-N local maxima as candidate peaks for the AI prompt
export function extractPeaks(data: SpectraData, n = 20): Peak[] {
  const { x, y } = data
  const peaks: Peak[] = []

  for (let i = 1; i < y.length - 1; i++) {
    if (y[i] > y[i - 1] && y[i] > y[i + 1] && y[i] > 0.05) {
      peaks.push({ x: x[i], y: y[i] })
    }
  }

  // Return top-n by intensity
  return peaks.sort((a, b) => b.y - a.y).slice(0, n)
}
