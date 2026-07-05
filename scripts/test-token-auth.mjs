import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function testAuth() {
    try {
        const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const accessToken = config.tokens.access_token;

        console.log("Access Token available:", !!accessToken);

        const oAuth2Client = new OAuth2Client();
        oAuth2Client.setCredentials({ access_token: accessToken });

        const db = new Firestore({
            projectId: 'tng-systems',
            authClient: oAuth2Client
        });

        const snapshot = await db.collection('users').limit(1).get();
        console.log('Access OK. Users count:', snapshot.size);
    } catch (e) {
        console.error('Error:', e);
    }
}

testAuth();
