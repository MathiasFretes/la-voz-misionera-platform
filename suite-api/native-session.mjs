export function nativeRequest(headers) {
  return (
    headers['x-lvm-client'] === 'native' &&
    !headers.origin &&
    !headers['sec-fetch-site']
  )
}

export function nativeToken(headers) {
  if (!nativeRequest(headers) || headers.cookie) return null
  return (
    /^Bearer (n_[A-Za-z0-9_-]{43})$/.exec(headers.authorization || '')?.[1] ||
    null
  )
}

export function nativeAuthAction(path, headers) {
  if (!path.startsWith('/api/native/auth/')) return null
  if (!nativeRequest(headers) || headers.cookie)
    throw Object.assign(
      new Error('Native authentication requires a cookie-free device request'),
      { status: 403 },
    )
  const action = path.slice('/api/native/auth/'.length)
  if (!['login', 'signup', 'session', 'logout', 'password'].includes(action))
    throw Object.assign(new Error('Unsupported native authentication action'), {
      status: 404,
    })
  return action
}
