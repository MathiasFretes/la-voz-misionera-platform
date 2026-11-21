export type Church = {
  id: string
  name: string
  status: 'active' | 'suspended'
  revision: number
}
export type ChurchMember = {
  user_id: string
  display_name: string
  role: 'admin' | 'leader' | 'member' | 'viewer'
  status: 'active' | 'suspended'
  revision: number
}
export async function churchRpc<T>(
  name: string,
  data: unknown = {},
): Promise<T> {
  const response = await fetch(`/api/data/rpc/${name}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.message || 'No se pudo actualizar la organización')
  return result
}
