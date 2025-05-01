import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

export default async function(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const unpackPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked');

  const rawIdentity = process.env.CSC_NAME;
  if (!rawIdentity) {
    console.log('Skipping native module signing: CSC_NAME not set');
    return;
  }
  const signIdentity = rawIdentity;
  console.log(`Using signing identity: ${signIdentity}`);

  console.log('Signing native modules before overall app signing...');

  function walk(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.node') || fullPath.endsWith('.dylib')) {
        console.log(`Codesigning ${fullPath}`);
        execFileSync('codesign', ['--timestamp', '--options=runtime', '--force', '--sign', signIdentity, fullPath], { stdio: 'inherit' });
      }
    }
  }

  walk(unpackPath);
} 