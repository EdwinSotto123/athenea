/**
 * IPFS API Route - Secure Backend Handler
 * 
 * This serverless function handles all IPFS/Pinata uploads.
 * The PINATA_JWT is stored in Vercel environment variables (not exposed to frontend).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variable (from Vercel Dashboard, NOT frontend)
const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_API_URL = 'https://api.pinata.cloud';
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs';

interface IPFSUploadRequest {
    content: string; // Base64 encoded content
    filename: string;
    contentType: string;
    metadata?: {
        type: string;
        description: string;
        caseId?: string;
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!PINATA_JWT) {
        console.warn('[IPFS API] No Pinata JWT configured, using demo mode');
        // Return demo result
        const fakeCid = 'Qm' + Array(44).fill(0).map(() =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
                Math.floor(Math.random() * 62)
            )
        ).join('');

        return res.status(200).json({
            success: true,
            cid: fakeCid,
            ipfsUrl: `ipfs://${fakeCid}`,
            gatewayUrl: `${PUBLIC_GATEWAY}/${fakeCid}`,
            size: 0,
            demo: true
        });
    }

    const { content, filename, contentType, metadata }: IPFSUploadRequest = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        // Convert base64 to buffer
        const buffer = Buffer.from(content, 'base64');

        // Create form data for Pinata
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        // Add file
        formData.append('file', buffer, {
            filename: filename || `evidence-${Date.now()}`,
            contentType: contentType || 'application/octet-stream'
        });

        // Add Pinata metadata
        const pinataMetadata = JSON.stringify({
            name: `athena-evidence-${Date.now()}`,
            keyvalues: {
                type: metadata?.type || 'UNKNOWN',
                description: (metadata?.description || '').substring(0, 100),
                timestamp: Date.now().toString(),
                caseId: metadata?.caseId || 'anonymous'
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
                'Authorization': `Bearer ${PINATA_JWT}`,
                ...formData.getHeaders()
            },
            body: formData as any
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[IPFS API] Pinata error:', errorText);
            return res.status(response.status).json({
                error: 'Pinata upload failed',
                details: errorText
            });
        }

        const result = await response.json();
        const cid = result.IpfsHash;

        console.log('[IPFS API] ✅ File uploaded:', cid);

        return res.status(200).json({
            success: true,
            cid,
            ipfsUrl: `ipfs://${cid}`,
            gatewayUrl: `${PUBLIC_GATEWAY}/${cid}`,
            size: result.PinSize,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[IPFS API] Exception:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
