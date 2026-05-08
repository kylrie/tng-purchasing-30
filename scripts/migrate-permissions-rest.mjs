import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

async function main() {
    console.log('Reading Firebase CLI credentials...');
    const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const token = config.tokens.access_token;
    
    if (!token) {
        throw new Error('Could not find access token in firebase-tools config.');
    }

    const projectId = 'tng-systems';
    
    console.log('Fetching config/permissions from (default) database...');
    const getRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/permissions`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!getRes.ok) {
        const err = await getRes.text();
        throw new Error(`Failed to GET document: ${getRes.status} - ${err}`);
    }

    const docData = await getRes.json();
    console.log(`Document fetched. Fields: ${Object.keys(docData.fields || {}).join(', ')}`);

    console.log('Writing config/permissions to tng-systems database...');
    // When using PATCH, if the document doesn't exist, it creates it.
    // The payload needs to have the correct document name in the target DB
    const payload = {
        name: `projects/${projectId}/databases/tng-systems/documents/config/permissions`,
        fields: docData.fields
    };

    const patchRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/tng-systems/documents/config/permissions`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!patchRes.ok) {
        const err = await patchRes.text();
        throw new Error(`Failed to PATCH document: ${patchRes.status} - ${err}`);
    }

    console.log('✅ Successfully migrated config/permissions to tng-systems database!');
}

main().catch(console.error);
