// Script to integrate CounterService into DirectPrfModal (PRFView.tsx)
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, '..', 'src', 'features', 'procurement', 'views', 'PRFView.tsx');

// Read the file
let content = readFileSync(filePath, 'utf8');

// 1. Add import after other imports (after line 10)
const importToAdd = "import { CounterService } from '../../../shared/services/counter.service';";
if (!content.includes(importToAdd)) {
    content = content.replace(
        "import RejectionModal from '../../../shared/components/RejectionModal';",
        "import RejectionModal from '../../../shared/components/RejectionModal';\nimport { CounterService } from '../../../shared/services/counter.service';"
    );
}

// 2. Make DirectPrfModal's handleSubmit async
content = content.replace(
    /const handleSubmit = \(\) => \{/,
    'const handleSubmit = async () => {'
);

// 3. Add PRF ID generation before baseReq
// Find the baseReq definition and add ID generation before it
const baseReqPattern = /const baseReq: any = \{/;
const replacement = `// Generate PRF ID
        const prfId = await CounterService.generatePRFId();

        const baseReq: any = {
            id: prfId,`;

content = content.replace(
    /const baseReq: any = \{/,
    replacement
);

// Write the file back
writeFileSync(filePath, content, 'utf8');

console.log('✅ Successfully integrated CounterService into DirectPrfModal (PRFView.tsx)');
console.log('Changes made:');
console.log('  1. Added CounterService import');
console.log('  2. Made handleSubmit async');
console.log('  3. Added PRF ID generation for direct PRF creation');
