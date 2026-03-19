import Anthropic from '@anthropic-ai/sdk'
import type { Peak, SpectraType } from '@/lib/parseSpectra'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_LABELS: Record<SpectraType, string> = {
  raman: 'Raman',
  ftir: 'FTIR',
  xrd: 'XRD (X-ray diffraction)',
}

export async function POST(request: Request) {
  const { peaks, spectraType, materialName } = (await request.json()) as {
    peaks: Peak[]
    spectraType: SpectraType
    materialName?: string
  }

  if (!peaks?.length || !spectraType) {
    return Response.json({ error: 'peaks and spectraType are required' }, { status: 400 })
  }

  const typeLabel = TYPE_LABELS[spectraType]
  const material = materialName ?? 'the material'

  const peakList = peaks
    .map((p, i) => `${i + 1}. x = ${p.x.toFixed(1)}, normalised intensity = ${p.y.toFixed(3)}`)
    .join('\n')

  const prompt = `The following is ${typeLabel} spectral data for ${material}.

Detected peaks (top ${peaks.length} by intensity):
${peakList}

Tasks:
1. Identify and assign each major peak to its vibrational mode, phase, or crystallographic reflection.
2. Comment on what the peak positions reveal about the material (e.g. phase purity, defects, layer number, crystallite size via Scherrer equation for XRD).
3. Flag any unexpected or anomalous peaks.
4. Suggest one follow-up measurement that would complement this spectrum.

Format your response with a numbered peak assignment table first, then a brief interpretation paragraph, then the follow-up suggestion.`

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          temperature: 0.2,
          system: 'You are an expert spectroscopist and materials characterisation scientist. Be precise and quantitative.',
          messages: [{ role: 'user', content: prompt }],
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`[error: ${msg}]`))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
