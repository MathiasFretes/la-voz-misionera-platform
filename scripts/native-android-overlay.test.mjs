import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  patchQaAndroidManifest,
  qaNetworkSecurityXml,
  qaApiOrigin,
} from './native-android-overlay.mjs'

test('adds a scoped policy without replacing backup/Keystore settings', () => {
  const value = patchQaAndroidManifest(
    '<manifest><application android:fullBackupContent="@xml/secure_store_backup_rules"></application></manifest>',
  )
  assert.ok(
    value.includes(
      'android:fullBackupContent="@xml/secure_store_backup_rules"',
    ),
  )
  assert.ok(value.includes('android:usesCleartextTraffic="false"'))
  assert.ok(
    value.includes(
      'android:networkSecurityConfig="@xml/lvm_qa_network_security_config"',
    ),
  )
})
test('overrides debug cleartext and preserves a self-closing application tag', () => {
  const value = patchQaAndroidManifest(
    '<application android:usesCleartextTraffic="true" tools:replace="android:usesCleartextTraffic" />',
  )
  assert.ok(value.endsWith('/>'))
  assert.ok(!value.includes('="true"'))
  assert.equal((value.match(/android:usesCleartextTraffic=/g) || []).length, 1)
})
test('refuses to silently replace an existing custom network policy', () => {
  assert.throws(() =>
    patchQaAndroidManifest(
      '<application android:networkSecurityConfig="@xml/existing" />',
    ),
  )
})
test('the QA CA is restricted to one synthetic domain and cleartext stays disabled', () => {
  const xml = qaNetworkSecurityXml()
  assert.ok(
    xml.includes('<domain includeSubdomains="false">lvm-qa.invalid</domain>'),
  )
  assert.ok(xml.includes('<certificates src="@raw/lvm_qa_ca" />'))
  assert.ok(!xml.includes('cleartextTrafficPermitted="true"'))
  assert.ok(!xml.includes('src="user"'))
  assert.equal(qaApiOrigin, 'https://lvm-qa.invalid:8443/api')
})
