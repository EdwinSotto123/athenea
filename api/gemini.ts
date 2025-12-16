/**
 * Gemini API Route - Secure Backend Handler
 * 
 * This serverless function handles all Gemini AI requests.
 * The API key is stored in Vercel environment variables (not exposed to frontend).
 * 
 * Models: gemini-2.5-flash-preview-05-20, gemini-2.5-pro-preview-05-06
 * 
 * SECURITY: Rate limiting implemented to prevent DDoS/abuse attacks
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variable (from Vercel Dashboard, NOT frontend)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ============ RATE LIMITING + IP BLOCKING ============
// Simple in-memory rate limiter (resets on cold start, but effective for DDoS protection)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 requests per minute per IP

// IP Blocking configuration
const BLOCK_THRESHOLD = 3; // Block after 3 rate limit violations
const BLOCK_DURATION_MS = 3600000; // Block for 1 hour (3600000ms)

interface RateLimitEntry {
    count: number;
    firstRequest: number;
    violations: number; // Track how many times this IP hit the rate limit
}

interface BlockedIP {
    blockedAt: number;
    reason: string;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const blockedIPs = new Map<string, BlockedIP>();

function getClientIP(req: VercelRequest): string {
    // Vercel provides real IP in x-forwarded-for or x-real-ip headers
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
        return realIp;
    }
    return 'unknown';
}

function isIPBlocked(ip: string): { blocked: boolean; remainingMs: number } {
    const blocked = blockedIPs.get(ip);
    if (!blocked) {
        return { blocked: false, remainingMs: 0 };
    }

    const now = Date.now();
    const elapsed = now - blocked.blockedAt;

    if (elapsed >= BLOCK_DURATION_MS) {
        // Block expired, remove from blocklist
        blockedIPs.delete(ip);
        rateLimitMap.delete(ip); // Also reset their rate limit
        return { blocked: false, remainingMs: 0 };
    }

    return { blocked: true, remainingMs: BLOCK_DURATION_MS - elapsed };
}

function blockIP(ip: string, reason: string): void {
    blockedIPs.set(ip, { blockedAt: Date.now(), reason });
    console.error(`🚫 [SECURITY] IP BLOCKED: ${ip} - Reason: ${reason}`);
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number; blocked: boolean } {
    const now = Date.now();

    // First check if IP is blocked
    const blockStatus = isIPBlocked(ip);
    if (blockStatus.blocked) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: blockStatus.remainingMs,
            blocked: true
        };
    }

    const entry = rateLimitMap.get(ip);

    // Clean up old entries periodically
    if (rateLimitMap.size > 1000) {
        for (const [key, val] of rateLimitMap.entries()) {
            if (now - val.firstRequest > RATE_LIMIT_WINDOW_MS) {
                rateLimitMap.delete(key);
            }
        }
    }

    if (!entry || (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS)) {
        // New window - preserve violations count if exists
        const previousViolations = entry?.violations || 0;
        rateLimitMap.set(ip, { count: 1, firstRequest: now, violations: previousViolations });
        return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS, blocked: false };
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        // Rate limit exceeded - increment violations
        entry.violations = (entry.violations || 0) + 1;

        // Check if should be blocked
        if (entry.violations >= BLOCK_THRESHOLD) {
            blockIP(ip, `Exceeded rate limit ${BLOCK_THRESHOLD} times`);
            return { allowed: false, remaining: 0, resetIn: BLOCK_DURATION_MS, blocked: true };
        }

        const resetIn = RATE_LIMIT_WINDOW_MS - (now - entry.firstRequest);
        console.warn(`[Rate Limit] IP ${ip} violation #${entry.violations}/${BLOCK_THRESHOLD}`);
        return { allowed: false, remaining: 0, resetIn, blocked: false };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
        blocked: false,
        resetIn: RATE_LIMIT_WINDOW_MS - (now - entry.firstRequest)
    };
}
// ============ END RATE LIMITING ============

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

    // ============ RATE LIMIT & IP BLOCK CHECK ============
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000).toString());

    // If IP is blocked, return 403 Forbidden
    if (rateLimit.blocked) {
        console.error(`🚫 [Gemini API] BLOCKED IP attempted access: ${clientIP}`);
        return res.status(403).json({
            error: 'Access denied',
            message: 'Your IP has been temporarily blocked due to excessive requests. Please try again later.',
            blockedFor: Math.ceil(rateLimit.resetIn / 1000) + ' seconds',
            retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        });
    }

    // If rate limited (not blocked yet), return 429
    if (!rateLimit.allowed) {
        console.warn(`[Gemini API] Rate limit exceeded for IP: ${clientIP}`);
        return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Continued abuse will result in IP block.',
            retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        });
    }
    // ============ END RATE LIMIT CHECK ============

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
