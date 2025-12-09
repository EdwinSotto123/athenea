
export enum AppMode {
  CALCULATOR = 'CALCULATOR',
  AGENT_DASHBOARD = 'AGENT_DASHBOARD',
  ONBOARDING_CHAT = 'ONBOARDING_CHAT'
}

export interface EvidenceAnalysis {
  summary: string;
  riskLevel: number; // 1-10
  category: 'PHYSICAL' | 'EMOTIONAL' | 'FINANCIAL' | 'THREAT' | 'UNCATEGORIZED';
  keywords: string[];
}

export type EvidenceType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO';

export interface EvidenceItem {
  id: string;
  timestamp: number;
  content: string; // Description or text content
  type: EvidenceType;
  mediaData?: string; // Base64 string for images or audio
  hash: string; // Simulated Tx Hash
  status: 'PENDING' | 'SECURED_ON_CHAIN';
  analysis?: EvidenceAnalysis; // New field for AI Forensic Data
  ipfsCid?: string; // IPFS Content ID
  ipfsUrl?: string; // Gateway URL for viewing
}

export interface EscapePlan {
  isReady: boolean;
  caseId?: string; // Unique case ID for pool donations (e.g., ATHENA-1702095267-X8K9)
  poolContractAddress?: string; // Pool contract address for donations
  freedomGoal: {
    targetAmount: number;
    currentAmount: number;
    currency: string;
    breakdown?: {
      transport: number;
      supplies: number;
      shelter: number;
      legal: number;
    };
  };
  strategy: {
    step1: string;
    step2: string;
    step3: string;
  };
  riskLevel: number; // 1-10
  destination: string;
  emergencyContact?: {
    name: string;
    contactInfo: string;
    relationship: string;
    withdrawalMethod?: 'WALLET' | 'PHONE' | 'CASH_CODE';
  };
  nextSteps?: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface WalletState {
  totalValue: number;
  savings: number;     // User deposits
  yieldEarned: number; // sFRAX growth
  communityAngels: number; // Donations
  freedomGoalAmount: number; // e.g., 1600
  apy: number;
}

export interface SafeContact {
  name: string;
  method: 'TRUSTED_ALLY' | 'CASH_CODE' | 'CRYPTO_WALLET';
  addressOrDetails: string;
}

export type AgentTab = 'HOME' | 'PLAN' | 'EVIDENCE' | 'SOS';
