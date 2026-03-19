import { ChatAnthropic } from '@langchain/anthropic'
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { getStructureTool, getPropertiesTool } from '@/lib/tools/materialsProject'
import { hfQATool } from '@/lib/tools/hfInference'
import { NANOSCIENCE_SYSTEM_PROMPT } from '@/lib/prompts/nanoscience'

const tools = [getStructureTool, getPropertiesTool, hfQATool]

const prompt = ChatPromptTemplate.fromMessages([
  ['system', NANOSCIENCE_SYSTEM_PROMPT + '\n\nYou have access to tools. Use them to look up accurate data before answering quantitative questions about crystal structures, band gaps, formation energies, and other computed properties.'],
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
