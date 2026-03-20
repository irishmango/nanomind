import { DynamicStructuredTool } from '@langchain/core/tools'
import { InferenceClient } from '@huggingface/inference'
import { z } from 'zod'

// MatSciBERT fine-tuned on materials science literature QA
const QA_MODEL = 'deepset/roberta-base-squad2'

function getClient() {
  return new InferenceClient(process.env.HUGGINGFACE_API_KEY ?? '')
}

export const hfQATool = new DynamicStructuredTool({
  name: 'extract_answer_from_passage',
  description:
    'Use ONLY when the user provides a specific text passage and asks you to extract a specific ' +
    'answer span from it. Do NOT use for general knowledge questions, Raman spectroscopy questions, ' +
    'or anything answerable from the document context already provided in the input. ' +
    'This tool is for targeted NLP extraction only.',
  schema: z.object({
    passage: z
      .string()
      .describe('The source text passage (up to ~500 words) containing the answer.'),
    question: z
      .string()
      .describe('The specific question to answer from the passage.'),
  }),
  func: async ({ passage, question }) => {
    const client = getClient()
    try {
      const result = await client.questionAnswering({
        model: QA_MODEL,
        inputs: {
          question,
          context: passage,
        },
      })
      const score = typeof result.score === 'number' ? result.score : 0
      if (score < 0.05) {
        return `No answer found in the passage for: "${question}"`
      }
      return result.answer
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return `HuggingFace inference error: ${msg}`
    }
  },
})
