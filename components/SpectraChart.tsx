'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { SpectraData, Peak, SpectraType } from '@/lib/parseSpectra'

type Props = {
  data: SpectraData
  spectraType: SpectraType
  annotatedPeaks?: Peak[]
  height?: number
}

type ChartPoint = { x: number; y: number }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null
  const { x, y } = payload[0].payload
  return (
    <div className="bg-[#0D1117] border border-white/10 rounded px-2.5 py-1.5 font-mono text-[10px] text-white/70">
      <p>{x.toFixed(1)}</p>
      <p className="text-[#00D4AA]">{y.toFixed(4)}</p>
    </div>
  )
}

export default function SpectraChart({ data, spectraType, annotatedPeaks = [], height = 192 }: Props) {
  const chartData: ChartPoint[] = data.x.map((x, i) => ({ x, y: data.y[i] }))

  // Downsample for performance if > 4000 points
  const display =
    chartData.length > 4000
      ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 4000) === 0)
      : chartData

  return (
    <div className="w-full select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={display} margin={{ top: 8, right: 8, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />

          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
            label={{
              value: data.xLabel,
              position: 'insideBottom',
              offset: -12,
              fill: 'rgba(255,255,255,0.25)',
              fontSize: 9,
              fontFamily: 'monospace',
            }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickCount={6}
          />

          <YAxis
            domain={[0, 1]}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            width={28}
            tickCount={4}
          />

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="y"
            stroke="#00D4AA"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#00D4AA', strokeWidth: 0 }}
            isAnimationActive={false}
          />

          {annotatedPeaks.map((peak) => (
            <ReferenceLine
              key={peak.x}
              x={peak.x}
              stroke="rgba(0,212,170,0.4)"
              strokeDasharray="3 3"
              label={{
                value: peak.label ?? peak.x.toFixed(0),
                position: 'top',
                fill: 'rgba(0,212,170,0.6)',
                fontSize: 8,
                fontFamily: 'monospace',
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
