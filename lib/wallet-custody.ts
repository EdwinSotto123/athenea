/**
 * Wallet Custody Service
 * 
 * Manages custodial wallets for users who don't understand crypto.
 * Generates wallets automatically on registration and encrypts private keys.
 */

import { ethers, Wallet } from 'ethers';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Simple encryption using AES (in production, use Google Cloud KMS)
import CryptoJS from 'crypto-js';

const ENCRYPTION_SECRET = process.env.VITE_WALLET_ENCRYPTION_KEY || 'CHANGE_THIS_IN_PRODUCTION';

interface CustodialWallet {
    address: string;
    encryptedPrivateKey: string;
    createdAt: number;
    caseId?: string;
}

interface CaseMetadata {
    caseId: string;
    userId: string;
    walletAddress: string;

    // Public info for frontend
    displayName: string; // "María" or "Caso #123"
    story: string; // Brief description (anonymized)
    goalAmount: number; // In USD
    currentAmount: number; // In USD
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    // Private info (only for victim)
    realName?: string;
    location?: string;

    // Timestamps
    createdAt: number;
    lastUpdated: number;

    // Status
    isActive: boolean;
    isPublic: boolean; // Show in public donation page?
}

export class WalletCustodyService {
    // Lock to prevent race condition in wallet creation
    private creatingWallets: Set<string> = new Set();

    /**
     * Generate a new custodial wallet for a user
     * Uses lock to prevent race conditions
     */
    async createCustodialWallet(userId: string): Promise<string> {
        // Check if already creating wallet for this user (race condition protection)
        if (this.creatingWallets.has(userId)) {
            console.log(`[Custody] Already creating wallet for ${userId}, waiting...`);
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            const existing = await this.getWallet(userId);
            if (existing) return existing.address;
        }

        try {
            // Add lock
            this.creatingWallets.add(userId);

            // Check if wallet already exists
            const existingWallet = await this.getWallet(userId);
            if (existingWallet) {
                console.log(`[Custody] Wallet already exists for user ${userId}`);
                return existingWallet.address;
            }

            // 1. Generate new wallet
            const wallet = Wallet.createRandom();

            // 2. Encrypt private key
            const encryptedKey = this.encryptPrivateKey(wallet.privateKey, userId);

            // 3. Save to Firestore
            const custodialWallet: CustodialWallet = {
                address: wallet.address,
                encryptedPrivateKey: encryptedKey,
                createdAt: Date.now()
            };

            await setDoc(doc(db, `users/${userId}/custody/wallet`), custodialWallet);

            console.log(`[Custody] Created wallet ${wallet.address} for user ${userId}`);

            return wallet.address;

        } catch (error) {
            console.error('[Custody] Failed to create wallet:', error);
            throw new Error('Failed to create custodial wallet');
        } finally {
            // Release lock
            this.creatingWallets.delete(userId);
        }
    }

    /**
     * Get wallet for a user
     */
    async getWallet(userId: string): Promise<CustodialWallet | null> {
        try {
            const walletDoc = await getDoc(doc(db, `users/${userId}/custody/wallet`));

            if (!walletDoc.exists()) {
                return null;
            }

            return walletDoc.data() as CustodialWallet;

        } catch (error) {
            console.error('[Custody] Failed to get wallet:', error);
            return null;
        }
    }

    /**
     * Get decrypted wallet instance (for signing transactions)
     * ONLY use this server-side or in secure contexts
     */
    async getWalletInstance(userId: string): Promise<Wallet | null> {
        try {
            const custodialWallet = await this.getWallet(userId);

            if (!custodialWallet) {
                return null;
            }

            // Decrypt private key
            const privateKey = this.decryptPrivateKey(
                custodialWallet.encryptedPrivateKey,
                userId
            );

            return new Wallet(privateKey);

        } catch (error) {
            console.error('[Custody] Failed to get wallet instance:', error);
            return null;
        }
    }

    /**
     * Create a case with metadata for public display
     */
    async createCaseWithMetadata(
        userId: string,
        metadata: {
            displayName: string;
            story: string;
            goalAmount: number;
            urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            realName?: string;
            location?: string;
            isPublic?: boolean;
        }
    ): Promise<string> {
        try {
            // 1. Get or create wallet
            let walletAddress = (await this.getWallet(userId))?.address;

            if (!walletAddress) {
                walletAddress = await this.createCustodialWallet(userId);
            }

            // 2. Generate case ID
            const caseId = this.generateCaseId();

            // 3. Create case metadata (only include defined fields)
            const caseMetadata: any = {
                caseId,
                userId,
                walletAddress,
                displayName: metadata.displayName,
                story: metadata.story,
                goalAmount: metadata.goalAmount,
                currentAmount: 0,
                urgencyLevel: metadata.urgencyLevel,
                createdAt: Date.now(),
                lastUpdated: Date.now(),
                isActive: true,
                isPublic: metadata.isPublic ?? true
            };

            // Only add optional fields if they have values
            if (metadata.realName) {
                caseMetadata.realName = metadata.realName;
            }
            if (metadata.location) {
                caseMetadata.location = metadata.location;
            }

            // 4. Save to Firestore (public collection for frontend)
            await setDoc(doc(db, `cases/${caseId}`), caseMetadata);

            // 5. Link case to user's wallet
            await updateDoc(doc(db, `users/${userId}/custody/wallet`), {
                caseId
            });

            console.log(`[Custody] Created case ${caseId} for user ${userId}`);

            return caseId;

        } catch (error) {
            console.error('[Custody] Failed to create case:', error);
            throw new Error('Failed to create case with metadata');
        }
    }

    /**
     * Get case metadata by ID
     */
    async getCaseMetadata(caseId: string): Promise<CaseMetadata | null> {
        try {
            const caseDoc = await getDoc(doc(db, `cases/${caseId}`));

            if (!caseDoc.exists()) {
                return null;
            }

            return caseDoc.data() as CaseMetadata;

        } catch (error) {
            console.error('[Custody] Failed to get case metadata:', error);
            return null;
        }
    }

    /**
     * Update case current amount (called when donations are received)
     */
    async updateCaseAmount(caseId: string, newAmount: number): Promise<void> {
        try {
            await updateDoc(doc(db, `cases/${caseId}`), {
                currentAmount: newAmount,
                lastUpdated: Date.now()
            });

            console.log(`[Custody] Updated case ${caseId} amount to ${newAmount}`);

        } catch (error) {
            console.error('[Custody] Failed to update case amount:', error);
        }
    }

    /**
     * Get all public cases (for donation frontend)
     */
    async getPublicCases(): Promise<CaseMetadata[]> {
        try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');

            const casesQuery = query(
                collection(db, 'cases'),
                where('isPublic', '==', true),
                where('isActive', '==', true)
            );

            const snapshot = await getDocs(casesQuery);

            return snapshot.docs.map(doc => doc.data() as CaseMetadata);

        } catch (error) {
            console.error('[Custody] Failed to get public cases:', error);
            return [];
        }
    }

    // ============ PRIVATE HELPERS ============

    private encryptPrivateKey(privateKey: string, userId: string): string {
        // Use userId as salt for encryption
        const encrypted = CryptoJS.AES.encrypt(
            privateKey,
            ENCRYPTION_SECRET + userId
        ).toString();

        return encrypted;
    }

    private decryptPrivateKey(encryptedKey: string, userId: string): string {
        const decrypted = CryptoJS.AES.decrypt(
            encryptedKey,
            ENCRYPTION_SECRET + userId
        ).toString(CryptoJS.enc.Utf8);

        if (!decrypted) {
            throw new Error('Failed to decrypt private key');
        }

        return decrypted;
    }

    private generateCaseId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ATHENA-${timestamp}-${random}`;
    }
}

// Singleton instance
let custodyServiceInstance: WalletCustodyService | null = null;

export const getCustodyService = (): WalletCustodyService => {
    if (!custodyServiceInstance) {
        custodyServiceInstance = new WalletCustodyService();
    }
    return custodyServiceInstance;
};

export default WalletCustodyService;
