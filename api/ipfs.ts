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

    console.log('[IPFS API] Request received');
    console.log('[IPFS API] PINATA_JWT configured:', !!PINATA_JWT);

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
        console.error('[IPFS API] No content provided');
        return res.status(400).json({ error: 'Content is required' });
    }

    console.log('[IPFS API] Content length:', content.length);
    console.log('[IPFS API] Filename:', filename);
    console.log('[IPFS API] Content type:', contentType);

    try {
        // Convert base64 to buffer
        // Handle data URL prefix if present
        let base64Data = content;
        if (content.includes(',')) {
            base64Data = content.split(',')[1];
        }

        const buffer = Buffer.from(base64Data, 'base64');
        console.log('[IPFS API] Buffer size:', buffer.length, 'bytes');

        // Use Pinata's JSON API for smaller files (simpler and more reliable)
        if (buffer.length < 1024 * 1024) { // Less than 1MB
            console.log('[IPFS API] Using JSON upload for small file');

            // For small files, use base64 JSON upload
            const pinataBody = {
                pinataContent: base64Data,
                pinataMetadata: {
                    name: filename || `athena-evidence-${Date.now()}`,
                    keyvalues: {
                        type: metadata?.type || 'UNKNOWN',
                        description: (metadata?.description || '').substring(0, 100),
                        timestamp: Date.now().toString()
                    }
                },
                pinataOptions: {
                    cidVersion: 1
                }
            };

            const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PINATA_JWT}`
                },
                body: JSON.stringify(pinataBody)
            });

            const responseText = await response.text();
            console.log('[IPFS API] Pinata response status:', response.status);
            console.log('[IPFS API] Pinata response:', responseText.substring(0, 500));

            if (!response.ok) {
                return res.status(response.status).json({
                    success: false,
                    error: 'Pinata upload failed',
                    details: responseText,
                    status: response.status
                });
            }

            const result = JSON.parse(responseText);
            const cid = result.IpfsHash;

            console.log('[IPFS API] ✅ File uploaded via JSON:', cid);

            return res.status(200).json({
                success: true,
                cid,
                ipfsUrl: `ipfs://${cid}`,
                gatewayUrl: `${PUBLIC_GATEWAY}/${cid}`,
                size: buffer.length,
                timestamp: new Date().toISOString()
            });
        }

        // For larger files, use multipart form upload
        console.log('[IPFS API] Using multipart upload for large file');

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

        const responseText = await response.text();
        console.log('[IPFS API] Pinata response status:', response.status);
        console.log('[IPFS API] Pinata response:', responseText.substring(0, 500));

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Pinata upload failed',
                details: responseText,
                status: response.status
            });
        }

        const result = JSON.parse(responseText);
        const cid = result.IpfsHash;

        console.log('[IPFS API] ✅ File uploaded via multipart:', cid);

        return res.status(200).json({
            success: true,
            cid,
            ipfsUrl: `ipfs://${cid}`,
            gatewayUrl: `${PUBLIC_GATEWAY}/${cid}`,
            size: result.PinSize,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[IPFS API] Exception:', error.message);
        console.error('[IPFS API] Stack:', error.stack);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
