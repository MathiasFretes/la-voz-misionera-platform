import type { ContentInput } from '../../../suite-api/site-content.mjs'

export type SiteDocument = {
  collection: string
  id: string
  data: Record<string, string | boolean>
  draft_data: Record<string, string | boolean>
  published: boolean
  revision: number
  updated_at: string
  published_at: string | null
}
async function rpc<T>(name: string, data: unknown): Promise<T> {
  const response = await fetch(`/api/data/rpc/${name}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.message || 'No se pudo guardar el contenido')
  return result
}
export const listSiteDocuments = (collection: string) =>
  rpc<SiteDocument[]>('list_site_documents', { p_collection: collection })
export async function saveSiteDocument(input: ContentInput) {
  const rows = await rpc<SiteDocument[]>('save_site_document', input)
  if (!rows[0]) throw new Error('El servidor no confirmó el guardado')
  return rows[0]
}
