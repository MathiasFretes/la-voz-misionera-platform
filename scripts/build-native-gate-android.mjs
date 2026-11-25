import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openSync, closeSync, statfsSync } from 'node:fs'
import { mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises'
import { dirname, join, resolve, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadNativeGateContext } from './native-gate-context.mjs'
import {
  qaApiOrigin,
  qaHostname,
  patchQaAndroidManifest,
  qaNetworkSecurityXml,
} from './native-android-overlay.mjs'
import { verifyNativeQaTls } from './native-qa-tls.mjs'

// Local test overlay only: no product source, SDK upgrade, store submission or
// trust-all TLS settings. Generated CNG/SDK files are restored in finally.
const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { manifest: gate } = await loadNativeGateContext()
assert.ok(gate.android, 'Use npm run build:native-android:isolated')
assert.equal(gate.android.apiOrigin, qaApiOrigin)
const ca = await readFile(gate.android.caPath)
const sha = (value) => createHash('sha256').update(value).digest('hex')
assert.equal(sha(ca), gate.android.caSha256)
await verifyNativeQaTls({
  port: gate.android.localTlsPort,
  runId: gate.runId,
  ca,
})
const clientRoot = gate.client.root
const mobile = join(clientRoot, 'apps/mobile')
const android = join(mobile, 'android')
const output = join(
  serviceRoot,
  'test-results/native-gate',
  gate.runId,
  'android',
)
await mkdir(output, { recursive: true })
const clientCommit = execFileSync(
  'git',
  ['-C', clientRoot, 'rev-parse', 'HEAD'],
  { encoding: 'utf8' },
).trim()
assert.equal(clientCommit, gate.client.commit)
assert.equal(
  execFileSync('git', ['-C', clientRoot, 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  '',
  'Client must match the recorded commit',
)
const space = statfsSync(clientRoot)
assert.ok(
  space.bavail * space.bsize > 700 * 1024 * 1024,
  'Insufficient room for incremental QA APK',
)
const files = {
  gradle: join(android, 'app/build.gradle'),
  application: join(
    android,
    'app/src/main/java/com/lavozmisionera/app/MainApplication.kt',
  ),
  strings: join(android, 'app/src/main/res/values/strings.xml'),
  mainManifest: join(android, 'app/src/main/AndroidManifest.xml'),
  debugManifest: join(android, 'app/src/debug/AndroidManifest.xml'),
  network: join(
    android,
    'app/src/main/res/xml/lvm_qa_network_security_config.xml',
  ),
  ca: join(android, 'app/src/main/res/raw/lvm_qa_ca.pem'),
  devLauncher: join(
    mobile,
    'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/DevLauncherPackageDelegate.kt',
  ),
}
const originals = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [
      key,
      await readFile(file).catch((error) => {
        if (['network', 'ca'].includes(key) && error.code === 'ENOENT')
          return null
        throw error
      }),
    ]),
  ),
)
assert.match(
  originals.gradle.toString(),
  /applicationId 'com\.lavozmisionera\.app'/,
)
assert.ok(!originals.application.toString().includes('LVM_NATIVE_GATE'))
const manifest = {
  clientCommit,
  apiOrigin: qaApiOrigin,
  apiCommit: gate.server.commit,
  apiImageId: gate.server.imageId,
  gateRunId: gate.runId,
  caSha256: gate.android.caSha256,
  caScope: qaHostname,
  applicationId: 'com.lavozmisionera.qa',
  debugSigning: true,
  debuggable: true,
  embeddedJavaScript: true,
  metroRequired: false,
  tlsVerificationDisabled: false,
  dnsOverride: {
    host: qaHostname,
    address: '127.0.0.1',
    purpose: 'ADB reverse to SSH-only isolated QA HTTPS proxy',
  },
  originals: {},
  overlay: {},
}
for (const [key, value] of Object.entries(originals)) {
  if (value !== null) await writeFile(join(output, `original-${key}`), value)
  manifest.originals[key] = value === null ? 'absent' : sha(value)
}
await writeFile(
  join(output, 'android-build-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
const overlay = {
  gradle:
    originals.gradle
      .toString()
      .replace(
        "applicationId 'com.lavozmisionera.app'",
        "applicationId 'com.lavozmisionera.qa'",
      )
      .replace('react {', 'react {\n    debuggableVariants = []') +
    `
// LVM_NATIVE_GATE: embedded production JS with debug storage inspection.
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    inputs.property("lvmQaClientCommit", "${clientCommit}")
    inputs.property("lvmQaApiOrigin", "${qaApiOrigin}")
    devEnabled.set(false)
    doFirst { if (devEnabled.get()) throw new GradleException("QA must bundle production JavaScript") }
}
`,
  application: originals.application
    .toString()
    .replace(
      '        }\n    )',
      '        },\n      useDevSupport = false\n    )',
    )
    .replace(
      '    super.onCreate()',
      `    super.onCreate()
    // LVM_NATIVE_GATE: keep normal CA and hostname validation; route only QA DNS.
    com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory {
      com.facebook.react.modules.network.OkHttpClientProvider.createClientBuilder()
        .dns(object : okhttp3.Dns {
          override fun lookup(hostname: String): List<java.net.InetAddress> =
            if (hostname == "${qaHostname}") listOf(java.net.InetAddress.getByName("127.0.0.1"))
            else okhttp3.Dns.SYSTEM.lookup(hostname)
        }).build()
    }`,
    ),
  strings: originals.strings
    .toString()
    .replace('>La Voz Misionera</string>', '>LVM QA</string>'),
  mainManifest: patchQaAndroidManifest(originals.mainManifest.toString()),
  debugManifest: patchQaAndroidManifest(originals.debugManifest.toString()),
  network: qaNetworkSecurityXml(),
  ca,
  // Same official no-op delegate used by Expo's release variant. This prevents
  // the debug launcher from replacing the bundled app with its Metro home.
  devLauncher: await readFile(
    join(
      mobile,
      'node_modules/expo-dev-launcher/android/src/disableInRelease/java/expo/modules/devlauncher/DevLauncherPackageDelegate.kt',
    ),
    'utf8',
  ),
}
assert.ok(overlay.application.includes('useDevSupport = false'))
assert.ok(overlay.strings.includes('>LVM QA</string>'))
const log = join(output, 'android-build.log')
let exitCode
try {
  for (const [key, value] of Object.entries(overlay)) {
    await mkdir(dirname(files[key]), { recursive: true })
    await writeFile(files[key], value)
    manifest.overlay[key] = sha(value)
  }
  await writeFile(
    join(output, 'android-build-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
  const fd = openSync(log, 'w')
  try {
    exitCode = await new Promise((fulfill, reject) => {
      const child = spawn(
        'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          'gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain',
        ],
        {
          cwd: android,
          windowsHide: true,
          stdio: ['ignore', fd, fd],
          env: {
            ...process.env,
            JAVA_HOME:
              'C:/Users/mathi/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2',
            ANDROID_HOME: 'C:/Users/mathi/AppData/Local/Android/Sdk',
            NODE_ENV: 'production',
            EXPO_PUBLIC_LVM_API_URL: manifest.apiOrigin,
            PATH: [
              'C:/Program Files/Git/usr/bin',
              'C:/Program Files/Git/mingw64/bin',
              process.env.PATH,
            ].join(delimiter),
          },
        },
      )
      child.once('error', reject)
      child.once('exit', fulfill)
    })
  } finally {
    closeSync(fd)
  }
  assert.equal(exitCode, 0, `Gradle failed; inspect ${log}`)
  const apk = join(android, 'app/build/outputs/apk/debug/app-debug.apk')
  const archivedApk = join(output, 'app-debug.apk')
  await writeFile(archivedApk, await readFile(apk))
  manifest.apk = {
    path: archivedApk,
    sha256: sha(await readFile(apk)),
    bytes: (await stat(apk)).size,
  }
  console.log(JSON.stringify(manifest.apk, null, 2))
} finally {
  for (const [key, value] of Object.entries(originals)) {
    if (value === null) await rm(files[key], { force: true })
    else await writeFile(files[key], value)
    const restored = await readFile(files[key]).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    assert.deepEqual(restored, value, `QA overlay was not restored: ${key}`)
  }
  manifest.exitCode = exitCode
  manifest.overlaysRestored = true
  await writeFile(
    join(output, 'android-build-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
}
