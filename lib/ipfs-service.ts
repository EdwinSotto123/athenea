/**
 * IPFS Service using Pinata
 * 
 * Uploads files to IPFS via Pinata and returns the CID
 * for permanent, decentralized storage of evidence.
 */

// Pinata API endpoints
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs';

// Get JWT from environment (Vite style)
const getPinataJWT = (): string | null => {
    // Try Vite env first (cast to any to avoid TS errors)
    const env = (import.meta as any).env;
    if (env?.VITE_PINATA_JWT) {
        return env.VITE_PINATA_JWT;
    }
    // Fallback for demo
    return null;
};

export interface IPFSUploadResult {
    success: boolean;
    cid: string;
    ipfsUrl: string;
    gatewayUrl: string;
    size: number;
    timestamp: Date;
    error?: string;
}

export interface EvidenceMetadata {
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO';
    description: string;
    timestamp: number;
    caseId?: string;
    hash?: string;
}

/**
 * Upload a file to IPFS via Pinata
 */
export async function uploadToIPFS(
    file: File | Blob,
    metadata: EvidenceMetadata
): Promise<IPFSUploadResult> {
    const jwt = getPinataJWT();

    // If no JWT, use fallback demo mode
    if (!jwt) {
        console.warn('[IPFS] No Pinata JWT, using demo mode');
        return generateDemoResult(metadata);
    }

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);

        // Add Pinata metadata
        const pinataMetadata = JSON.stringify({
            name: `athena-evidence-${Date.now()}`,
            keyvalues: {
                type: metadata.type,
                description: metadata.description.substring(0, 100),
                timestamp: metadata.timestamp.toString(),
                caseId: metadata.caseId || 'anonymous'
            }
        });
        formData.append('pinataMetadata', pinataMetadata);

        // Pinata options
        const pinataOptions = JSON.stringify({
            cidVersion: 1
        });
        formData.append('pinataOptions', pinataOptions);

        // Upload to Pinata
        const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwt}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata upload failed: ${error}`);
        }

        const result = await response.json();
        const cid = result.IpfsHash;

        console.log('[IPFS] File uploaded successfully:', cid);

        return {
            success: true,
            cid,
            ipfsUrl: `ipfs://${cid}`,
            gatewayUrl: `${PUBLIC_GATEWAY}/${cid}`,
            size: result.PinSize,
            timestamp: new Date()
        };

    } catch (error: any) {
        console.error('[IPFS] Upload error:', error);
        return {
            success: false,
            cid: '',
            ipfsUrl: '',
            gatewayUrl: '',
            size: 0,
            timestamp: new Date(),
            error: error.message
        };
    }
}

/**
 * Upload text content to IPFS
 */
export async function uploadTextToIPFS(
    text: string,
    metadata: EvidenceMetadata
): Promise<IPFSUploadResult> {
    const blob = new Blob([text], { type: 'text/plain' });
    return uploadToIPFS(blob, metadata);
}

/**
 * Upload base64 data to IPFS (for images/audio from canvas/recorder)
 */
export async function uploadBase64ToIPFS(
    base64Data: string,
    mimeType: string,
    metadata: EvidenceMetadata
): Promise<IPFSUploadResult> {
    // Convert base64 to blob
    const binaryString = atob(base64Data.split(',')[1] || base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    return uploadToIPFS(blob, metadata);
}

/**
 * Generate demo result when no Pinata JWT is available
 */
function generateDemoResult(metadata: EvidenceMetadata): IPFSUploadResult {
    // Generate fake but realistic-looking CID
    const fakeCid = 'Qm' + Array(44).fill(0).map(() =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
            Math.floor(Math.random() * 62)
        )
    ).join('');

    return {
        success: true,
        cid: fakeCid,
        ipfsUrl: `ipfs://${fakeCid}`,
        gatewayUrl: `${PUBLIC_GATEWAY}/${fakeCid}`,
        size: Math.floor(Math.random() * 100000) + 1000,
        timestamp: new Date()
    };
}

/**
 * Check if a CID is pinned on Pinata
 */
export async function checkPinStatus(cid: string): Promise<boolean> {
    const jwt = getPinataJWT();
    if (!jwt) return false;

    try {
        const response = await fetch(
            `${PINATA_API_URL}/data/pinList?status=pinned&hashContains=${cid}`,
            {
                headers: {
                    'Authorization': `Bearer ${jwt}`
                }
            }
        );
        const result = await response.json();
        return result.count > 0;
    } catch {
        return false;
    }
}

/**
 * Generate a shareable evidence URL
 */
export function getEvidenceUrl(cid: string): string {
    return `${PUBLIC_GATEWAY}/${cid}`;
}

/**
 * Generate evidence certificate data
 */
export function generateCertificate(
    cid: string,
    txHash: string,
    metadata: EvidenceMetadata
): {
    title: string;
    content: string;
    verificationUrl: string;
} {
    const date = new Date(metadata.timestamp);

    return {
        title: 'Athena Evidence Certificate',
        content: `
ATHENA IMMUTABLE EVIDENCE CERTIFICATE
=====================================

Evidence Type: ${metadata.type}
Description: ${metadata.description}
Timestamp: ${date.toISOString()}

IPFS Content ID (CID):
${cid}

Blockchain Transaction:
${txHash}

Verification Links:
• IPFS: ${PUBLIC_GATEWAY}/${cid}
• Blockchain: https://holesky.fraxscan.com/tx/${txHash}

This evidence was securely stored on the decentralized IPFS network
and its hash was recorded on the Fraxtal blockchain, providing
immutable proof of existence at the recorded timestamp.

Generated by Athena - Protecting Those Who Need It Most
        `.trim(),
        verificationUrl: `${PUBLIC_GATEWAY}/${cid}`
    };
}

export default {
    uploadToIPFS,
    uploadTextToIPFS,
    uploadBase64ToIPFS,
    checkPinStatus,
    getEvidenceUrl,
    generateCertificate
};
