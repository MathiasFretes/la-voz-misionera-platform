import assert from 'node:assert/strict'

export const qaHostname = 'lvm-qa.invalid'
export const qaApiOrigin = `https://${qaHostname}:8443/api`

export function patchQaAndroidManifest(source) {
  assert.equal((source.match(/<application\b/g) || []).length, 1)
  assert.ok(
    !source.includes('android:networkSecurityConfig='),
    'Review the existing network policy before overlaying QA',
  )
  return source.replace(/<application\b[^>]*>/, (tag) => {
    const ending = tag.endsWith('/>') ? '/>' : '>'
    const clean = tag
      .slice(0, -ending.length)
      .replace(/\s+android:usesCleartextTraffic="[^"]*"/, '')
    return (
      clean +
      ' android:usesCleartextTraffic="false" android:networkSecurityConfig="@xml/lvm_qa_network_security_config"' +
      ending
    )
  })
}

export function qaNetworkSecurityXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system" /></trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${qaHostname}</domain>
    <trust-anchors><certificates src="@raw/lvm_qa_ca" /></trust-anchors>
  </domain-config>
</network-security-config>
`
}
