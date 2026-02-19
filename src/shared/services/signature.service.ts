import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';

/**
 * Service for handling digital signature uploads to Firebase Storage.
 * Signatures are stored under: signatures/{documentId}/{approverUid}_{timestamp}.png
 */
export class SignatureService {
    /**
     * Upload a signature image to Firebase Storage.
     * @param documentId - The requisition/document ID being approved
     * @param approverUid - The UID of the approver
     * @param blob - The signature image blob (PNG)
     * @returns The download URL of the uploaded signature
     */
    static async uploadSignature(
        documentId: string,
        approverUid: string,
        blob: Blob
    ): Promise<string> {
        const timestamp = Date.now();
        const fileName = `${approverUid}_${timestamp}.png`;
        const storagePath = `signatures/${documentId}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, blob, {
            contentType: 'image/png',
            customMetadata: {
                documentId,
                approverUid,
                uploadedAt: new Date().toISOString(),
            },
        });

        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    }
}
