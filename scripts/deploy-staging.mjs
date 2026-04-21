import { execSync } from 'child_process';
import fs from 'fs';

console.log('\x1b[36mDeploying to STAGING...\x1b[0m');

if (fs.existsSync('.firebase')) {
  fs.rmSync('.firebase', { recursive: true, force: true });
}

fs.writeFileSync('.env.staging', 'VITE_FIREBASE_DATABASE_ID=\n');

console.log('\x1b[33mBuilding with staging config...\x1b[0m');
try {
  execSync('npm run build -- --mode staging', { stdio: 'inherit' });
} catch (e) {
  console.error('\x1b[31mBuild failed!\x1b[0m');
  if (fs.existsSync('.env.staging')) fs.unlinkSync('.env.staging');
  process.exit(1);
}

if (fs.existsSync('.env.staging')) {
  fs.unlinkSync('.env.staging');
}

const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const originalSite = config.hosting.site;
config.hosting.site = 'tng-systems-staging';
fs.writeFileSync('firebase.json', JSON.stringify(config, null, 4));

console.log('\x1b[33mDeploying to tng-systems-staging.web.app...\x1b[0m');
try {
  execSync('npx firebase deploy --only hosting', { stdio: 'inherit' });
  console.log('\x1b[32mStaging deployed successfully!\x1b[0m');
  console.log('\x1b[36mURL: https://tng-systems-staging.web.app\x1b[0m');
} catch (e) {
  console.error('\x1b[31mDeployment failed!\x1b[0m');
  process.exit(1);
} finally {
  config.hosting.site = originalSite;
  fs.writeFileSync('firebase.json', JSON.stringify(config, null, 4));
}
