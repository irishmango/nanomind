import { ChatAnthropic } from '@langchain/anthropic'
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { getStructureTool, getPropertiesTool } from '@/lib/tools/materialsProject'
import { hfQATool } from '@/lib/tools/hfInference'
import { NANOSCIENCE_SYSTEM_PROMPT } from '@/lib/prompts/nanoscience'

const tools = [getStructureTool, getPropertiesTool, hfQATool]

const ROUTING_PROMPT = `

## Question routing
Before calling any tool, classify the question into one of these categories:
- SPECTROSCOPY: Raman, FTIR, XRD, XPS, PL peak analysis in isolation (e.g. "what does this peak mean?", "assign these modes") → answer from RAG + LLM only, do not call materialsProject
- SPECTROSCOPY+DB: spectral data being validated or compared against a named material (e.g. "do these peaks match MoS₂?", "are these XRD reflections consistent with TiO₂?", "confirm phase identity") → call materialsProject to retrieve the material's crystal structure and properties as a reference, then cross-check against the spectrum
- SYNTHESIS: CVD, ALD, sol-gel, growth conditions → RAG + LLM only, never call materialsProject
- DATABASE: bandgap, crystal structure, space group, formation energy, lattice parameters → call materialsProject
- LITERATURE: anything referencing a paper or experiment → RAG only, never call materialsProject

Call materialsProject for DATABASE and SPECTROSCOPY+DB questions. For pure SPECTROSCOPY, SYNTHESIS, and LITERATURE categories, do not call any tools — answer using RAG context and LLM knowledge directly.

Source priority: Always check the DOCUMENT CONTEXT section of the input first before deciding to call any tool. Only call a tool if the document context does not contain the answer.

Tool output synthesis: When a tool returns a result, always synthesize it into a clear well-formed response. Never show raw tool output, confidence scores, or character positions to the user.

Source routing: When a question could be answered from either uploaded documents OR the Materials Project database and you are not certain which is more appropriate, output EXACTLY this as the first line of your response with no other text before it:
__CLARIFY__[{{"label":"📄 Your uploaded papers","value":"rag"}},{{"label":"🔬 Materials Project database","value":"mp"}},{{"label":"📄 + 🔬 Both","value":"both"}}]
Then on a new line, briefly explain why you are asking. Only skip asking if: the question is clearly experimental/spectroscopy (use docs), the user explicitly asks for DFT or database values (use MP), or no document context is present in the input (use MP).`

const prompt = ChatPromptTemplate.fromMessages([
  ['system', NANOSCIENCE_SYSTEM_PROMPT + ROUTING_PROMPT],
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
  new MessagesPlaceholder('agent_scratchpad'),
])

export function createNanoAgent() {
  const llm = new ChatAnthropic({
    model: 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.2,
    maxTokens: 2048,
  })
  // LangChain defaults topP to -1 which Anthropic rejects for this model.
  // Force it to undefined so it's omitted from the serialised API request.
  Object.assign(llm, { topP: undefined })

  const agent = createToolCallingAgent({ llm, tools, prompt })

  return new AgentExecutor({
    agent,
    tools,
    verbose: false,
    maxIterations: 6,
    returnIntermediateSteps: true,
  })
}
