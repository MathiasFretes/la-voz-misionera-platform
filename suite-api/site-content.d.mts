export type ContentField = {
  key: string
  label: string
  required: boolean
  type: string
  value: string | boolean
}
export type ContentCollection = {
  id: string
  label: string
  titleField: string
  publicPath: string
  fields: ContentField[]
}
export type ContentInput = {
  p_collection: string
  p_id: string
  p_data: Record<string, string | boolean>
  p_expected_revision: number
  p_action: 'save' | 'publish' | 'unpublish'
}
export const contentCollections: ContentCollection[]
export function validateSiteDocument(input: ContentInput): ContentInput
