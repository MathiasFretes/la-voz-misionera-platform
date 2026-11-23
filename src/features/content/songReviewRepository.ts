export type SongProposal = {
  id: string
  song_id: string | null
  type: 'addition' | 'edit' | 'deletion'
  payload: Record<string, unknown>
  created_at: string
  base_song_updated_at?: string | null
}

async function request<T>(path: string, data?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/data/${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      method: data === undefined ? 'GET' : 'POST',
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new Error(
      'No se pudo confirmar la respuesta. Reintentá la misma decisión para comprobar su resultado.',
    )
  }
  const result = await response.json()
  if (!response.ok) {
    if (response.status === 409)
      throw new Error(
        'La propuesta cambió. Actualizá la bandeja antes de decidir.',
      )
    if (response.status === 401 || response.status === 403)
      throw new Error(
        'Tu cuenta no tiene permisos para completar esta revisión.',
      )
    throw new Error(
      'No se pudo completar la revisión musical. Conservamos tu decisión para que puedas reintentar.',
    )
  }
  return result
}

export const listSongProposals = (offset = 0) =>
  request<SongProposal[]>(
    `song_suggestions?select=id,song_id,type,payload,created_at,base_song_updated_at&status=eq.pending&order=created_at.asc,id.asc&limit=25&offset=${offset}`,
  )

export const getReviewSong = (id: string) =>
  request<(Record<string, unknown> & { slug: string })[]>(
    `songs?select=slug,title,artist,default_key,tags,chordpro_content,updated_at&id=eq.${encodeURIComponent(id)}`,
  ).then((rows) => {
    if (!rows[0]) throw new Error('La canción original ya no está disponible.')
    return rows[0]
  })

export const reviewSongProposal = (
  id: string,
  action: 'approve' | 'reject',
  reason: string,
) =>
  request<{ status: string; song_id?: string }>('rpc/review_song_suggestion', {
    p_suggestion_id: id,
    p_action: action,
    p_reason: action === 'reject' ? reason.trim() || null : null,
  })

export const rebaseSongProposal = (id: string, expectedRevision: string) =>
  request<SongProposal>('rpc/rebase_song_suggestion', {
    p_suggestion_id: id,
    p_expected_song_updated_at: expectedRevision,
  })
