'use client'

type Props = {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-80 rounded-xl border border-white/[0.10] bg-[#0D1117] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-sans text-sm text-white/80 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md font-mono text-xs text-white/40
              hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-md font-mono text-xs
              bg-red-500/10 hover:bg-red-500/20 border border-red-500/30
              text-red-400 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
