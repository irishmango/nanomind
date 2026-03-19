type Props = { missing: string[]; warnings: string[] }

export default function EnvWarningBanner({ missing, warnings }: Props) {
  if (missing.length === 0 && warnings.length === 0) return null

  return (
    <div className="shrink-0 border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2.5">
      {missing.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest shrink-0 mt-0.5">
            ✗ Config error
          </span>
          <p className="font-mono text-[10px] text-red-300/80">
            Missing required env vars:{' '}
            {missing.map((m) => m.split(' — ')[0]).join(', ')} — check{' '}
            <code className="text-red-300">.env.local</code>
          </p>
        </div>
      )}
      {warnings.length > 0 && missing.length === 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="font-mono text-[10px] text-yellow-400 uppercase tracking-widest shrink-0 mt-0.5">
            ⚠ Partial config
          </span>
          <p className="font-mono text-[10px] text-yellow-300/70">
            {warnings.map((w) => w.split(' — ')[0]).join(', ')} not set — some features disabled
          </p>
        </div>
      )}
    </div>
  )
}
