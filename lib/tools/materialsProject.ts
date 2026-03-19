import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

const BASE = 'https://api.materialsproject.org'
const FIELDS = 'material_id,formula_pretty,symmetry,band_gap,formation_energy_per_atom,energy_above_hull,theoretical'

function headers() {
  return {
    'X-API-KEY': process.env.MATERIALS_PROJECT_API_KEY ?? '',
    'Content-Type': 'application/json',
  }
}

async function mpFetch(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  if (!res.ok) throw new Error(`Materials Project API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export const getStructureTool = new DynamicStructuredTool({
  name: 'get_structure',
  description:
    'Query the Materials Project database for crystal structure, space group, and electronic properties of a material by chemical formula. Returns the top matches including material_id, space group, band gap, and formation energy.',
  schema: z.object({
    formula: z.string().describe('Chemical formula, e.g. "MoS2", "TiO2", "Al2O3"'),
  }),
  func: async ({ formula }) => {
    const data = await mpFetch(
      `/materials/core/?formula=${encodeURIComponent(formula)}&_fields=${FIELDS}&_limit=3`,
    )
    const entries = (data.data as Record<string, unknown>[]) ?? []
    if (!entries.length) return `No entries found for formula "${formula}" in the Materials Project.`

    return entries
      .map((e) => {
        const sym = e.symmetry as Record<string, unknown> | null
        return [
          `Material ID: ${e.material_id}`,
          `Formula: ${e.formula_pretty}`,
          `Space group: ${sym?.symbol ?? 'N/A'} (${sym?.crystal_system ?? 'N/A'})`,
          `Band gap: ${typeof e.band_gap === 'number' ? e.band_gap.toFixed(3) + ' eV' : 'N/A'}`,
          `Formation energy: ${typeof e.formation_energy_per_atom === 'number' ? e.formation_energy_per_atom.toFixed(3) + ' eV/atom' : 'N/A'}`,
          `Energy above hull: ${typeof e.energy_above_hull === 'number' ? e.energy_above_hull.toFixed(3) + ' eV/atom' : 'N/A'}`,
          `Theoretical: ${e.theoretical ? 'Yes' : 'No'}`,
        ].join('\n')
      })
      .join('\n\n')
  },
})

export const getPropertiesTool = new DynamicStructuredTool({
  name: 'get_properties',
  description:
    'Retrieve detailed computed properties for a specific material using its Materials Project ID (mp-id). Returns mechanical, electronic, and thermodynamic properties.',
  schema: z.object({
    mp_id: z.string().describe('Materials Project ID, e.g. "mp-1023924"'),
  }),
  func: async ({ mp_id }) => {
    const PROP_FIELDS =
      'material_id,formula_pretty,band_gap,formation_energy_per_atom,energy_above_hull,' +
      'efermi,total_magnetization,is_magnetic,is_metal,symmetry,volume,density'
    const data = await mpFetch(
      `/materials/core/?material_ids=${encodeURIComponent(mp_id)}&_fields=${PROP_FIELDS}`,
    )
    const entries = (data.data as Record<string, unknown>[]) ?? []
    if (!entries.length) return `No material found with ID "${mp_id}".`
    const e = entries[0]
    const sym = e.symmetry as Record<string, unknown> | null
    return [
      `Material ID: ${e.material_id}`,
      `Formula: ${e.formula_pretty}`,
      `Space group: ${sym?.symbol ?? 'N/A'} (Number: ${sym?.number ?? 'N/A'})`,
      `Crystal system: ${sym?.crystal_system ?? 'N/A'}`,
      `Band gap: ${typeof e.band_gap === 'number' ? e.band_gap.toFixed(3) + ' eV' : 'N/A'}`,
      `Fermi energy: ${typeof e.efermi === 'number' ? e.efermi.toFixed(3) + ' eV' : 'N/A'}`,
      `Is metal: ${e.is_metal ? 'Yes' : 'No'}`,
      `Is magnetic: ${e.is_magnetic ? 'Yes' : 'No'}`,
      `Total magnetisation: ${typeof e.total_magnetization === 'number' ? e.total_magnetization.toFixed(3) + ' µB' : 'N/A'}`,
      `Formation energy: ${typeof e.formation_energy_per_atom === 'number' ? e.formation_energy_per_atom.toFixed(3) + ' eV/atom' : 'N/A'}`,
      `Energy above hull: ${typeof e.energy_above_hull === 'number' ? e.energy_above_hull.toFixed(3) + ' eV/atom' : 'N/A'}`,
      `Volume: ${typeof e.volume === 'number' ? e.volume.toFixed(2) + ' ų' : 'N/A'}`,
      `Density: ${typeof e.density === 'number' ? e.density.toFixed(3) + ' g/cm³' : 'N/A'}`,
    ].join('\n')
  },
})
