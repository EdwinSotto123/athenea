/**
 * Gemini API Route - Secure Backend Handler
 * 
 * This serverless function handles all Gemini AI requests.
 * The API key is stored in Vercel environment variables (not exposed to frontend).
 * 
 * Models: gemini-2.5-flash-preview-05-20, gemini-2.5-pro-preview-05-06
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variable (from Vercel Dashboard, NOT frontend)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Available models
const MODELS = {
    flash: 'gemini-2.5-flash',
    pro: 'gemini-2.5-pro'
};

interface GeminiRequest {
    action: 'chat' | 'analyze';
    message: string;
    history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    systemPrompt?: string;
    model?: 'flash' | 'pro';
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

    if (!GEMINI_API_KEY) {
        console.error('[Gemini API] No API key configured');
        return res.status(500).json({ error: 'Gemini not configured' });
    }

    const { action, message, history, systemPrompt, model = 'flash' }: GeminiRequest = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const modelId = MODELS[model] || MODELS.flash;
        const apiUrl = `${GEMINI_API_URL}/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

        // Build request body
        const contents = [
            ...(history || []),
            { role: 'user', parts: [{ text: message }] }
        ];

        const requestBody: any = {
            contents,
            generationConfig: {
                temperature: action === 'analyze' ? 0.3 : 0.7,
                maxOutputTokens: action === 'analyze' ? 4096 : 2048,
                topP: 0.95,
                topK: 40
            }
        };

        // Add system instruction if provided
        if (systemPrompt) {
            requestBody.systemInstruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        // Call Gemini API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini API] Error:', errorText);
            return res.status(response.status).json({
                error: 'Gemini API error',
                details: errorText
            });
        }

        const data = await response.json();

        // Extract response text
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = data.candidates?.[0]?.finishReason || 'STOP';
        const usageMetadata = data.usageMetadata || {};

        return res.status(200).json({
            success: true,
            response: responseText,
            model: modelId,
            finishReason,
            usage: {
                promptTokens: usageMetadata.promptTokenCount || 0,
                responseTokens: usageMetadata.candidatesTokenCount || 0,
                totalTokens: usageMetadata.totalTokenCount || 0
            }
        });

    } catch (error: any) {
        console.error('[Gemini API] Exception:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
