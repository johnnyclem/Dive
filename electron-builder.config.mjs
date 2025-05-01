import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

// load existing JSON config
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const jsonConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'electron-builder.json'), 'utf-8'))

export default {
  // merge in all of your existing JSON config
  ...jsonConfig,

  // sign native modules before the main app is signed
  afterPack: async (context) => {
    const { electronPlatformName, appOutDir, packager } = context
    if (electronPlatformName !== 'darwin') {
      return
    }

    const appName = packager.appInfo.productFilename
    const appPath = path.join(appOutDir, `${appName}.app`)
    const unpackPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked')

    const signIdentity = process.env.CSC_NAME
    if (!signIdentity) {
      console.log('Skipping native module signing: CSC_NAME not set')
      return
    }

    console.log('Signing native modules before main app signing...')

    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (fullPath.endsWith('.node') || fullPath.endsWith('.dylib')) {
          console.log(`Codesigning ${fullPath}`)
          const identityHash = (packager.codeSigningInfo.identity && packager.codeSigningInfo.identity.hash) || process.env.CSC_NAME
          execFileSync('codesign', [
            '--timestamp',
            '--options=runtime',
            '--force',
            '--sign',
            identityHash,
            fullPath,
          ], { stdio: 'inherit' })
        }
      }
    }

    walk(unpackPath)
  },
} 