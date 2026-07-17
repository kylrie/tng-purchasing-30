import { execSync } from 'child_process';
import fs from 'fs';

console.log('\x1b[35mDeploying to PRODUCTION...\x1b[0m');

if (fs.existsSync('.firebase')) {
  fs.rmSync('.firebase', { recursive: true, force: true });
}

if (!fs.existsSync('.env.production')) {
  console.error('\x1b[31mERROR: .env.production file missing! It must contain VITE_FIREBASE_DATABASE_ID=tng-systems\x1b[0m');
  process.exit(1);
}

console.log('\x1b[33mUsing .env.production (database: tng-systems)...\x1b[0m');
try {
  execSync('npm run build -- --mode production', { stdio: 'inherit' });
} catch (e) {
  console.error('\x1b[31mBuild failed!\x1b[0m');
  process.exit(1);
}

console.log('\x1b[33mDeploying to tng-systems.web.app...\x1b[0m');
try {
  execSync('npx firebase deploy --only hosting:production', { stdio: 'inherit' });
  console.log('\x1b[32mProduction deployed successfully!\x1b[0m');
  console.log('\x1b[36mURL: https://tng-systems.web.app\x1b[0m');
} catch (e) {
  console.error('\x1b[31mDeployment failed!\x1b[0m');
  process.exit(1);
}

