import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

// ~800 tokens at ~4 chars/token, 100-token overlap
const CHUNK_SIZE = 3200
const CHUNK_OVERLAP = 400

const SECTION_PATTERNS: [RegExp, string][] = [
  [/\babstract\b/i, 'ABSTRACT'],
  [/\bintroduction\b/i, 'INTRODUCTION'],
  [/\b(materials?\s+and\s+methods?|experimental(\s+section)?|methodology)\b/i, 'METHODS'],
  [/\b(results?(\s+and\s+discussion)?)\b/i, 'RESULTS'],
  [/\bdiscussion\b/i, 'DISCUSSION'],
  [/\bconclusions?\b/i, 'CONCLUSIONS'],
  [/\b(acknowledgements?|acknowledgments?)\b/i, 'ACKNOWLEDGEMENTS'],
  [/\breferences?\b/i, 'REFERENCES'],
  [/\bsupplementary\b/i, 'SUPPLEMENTARY'],
  [/\bcharacteri[sz]ation\b/i, 'CHARACTERIZATION'],
]

function detectSection(text: string): string | null {
  // Look at the first ~120 chars of the chunk for a section heading
  const head = text.slice(0, 120).replace(/\n+/g, ' ').trim()
  for (const [pattern, label] of SECTION_PATTERNS) {
    if (pattern.test(head)) return label
  }
  return null
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  // Prefer paragraph and sentence boundaries — avoids mid-sentence splits
  separators: ['\n\n\n', '\n\n', '\n', '. ', '? ', '! ', ' ', ''],
})

export async function chunkText(text: string): Promise<string[]> {
  const docs = await splitter.createDocuments([text])
  return docs.map((d) => {
    const content = d.pageContent.trim()
    const section = detectSection(content)
    return section ? `[${section}]\n${content}` : content
  })
}
