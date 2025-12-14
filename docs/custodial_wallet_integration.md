# Custodial Wallet System - Integration Guide

## 🎯 Overview

The custodial wallet system automatically generates and manages wallets for users who don't understand crypto. Users only see "Saldo: $500" instead of complex wallet addresses.

---

## 📁 Files Created

1. **`lib/wallet-custody.ts`** - Core custody service
2. **`lib/useCustodialWallet.ts`** - React hooks
3. **`components/PublicDonationPage.tsx`** - Public donation frontend

---

## 🔧 Setup

### 1. Environment Variables

Add to `.env.local`:

```env
# Wallet Encryption Key (CHANGE THIS IN PRODUCTION!)
VITE_WALLET_ENCRYPTION_KEY=your-super-secret-encryption-key-min-32-chars

# Optional: For backend signing (if you want to sign transactions server-side)
VITE_ADMIN_PRIVATE_KEY=your-admin-wallet-private-key
```

**⚠️ CRITICAL:** In production, use Google Cloud KMS instead of environment variables for encryption keys.

### 2. Firestore Security Rules

Update your Firestore rules to protect custodial wallets:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read their own custodial wallet
    match /users/{userId}/custody/{document=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only backend can write
    }
    
    // Public cases are readable by anyone
    match /cases/{caseId} {
      allow read: if true;
      allow write: if false; // Only backend can write
    }
  }
}
```

---

## 🚀 Usage

### Option A: Auto-Generate on Registration

Modify `AuthModal.tsx` to create wallet automatically:

```typescript
import { getCustodyService } from '../lib/wallet-custody';

// In your handleRegister function:
const handleRegister = async () => {
  try {
    // 1. Create Firebase user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    
    // 2. Auto-generate custodial wallet
    const custodyService = getCustodyService();
    const walletAddress = await custodyService.createCustodialWallet(
      userCredential.user.uid
    );
    
    console.log(`✅ Wallet created: ${walletAddress}`);
    
    // 3. Continue with normal flow...
    
  } catch (error) {
    console.error('Registration failed:', error);
  }
};
```

### Option B: Create Case with Metadata

When user completes their escape plan:

```typescript
import { useCustodialWallet } from '../lib/useCustodialWallet';

function EscapePlanComplete() {
  const { createCase, loading } = useCustodialWallet();
  
  const handleCreateCase = async () => {
    const caseId = await createCase({
      displayName: 'María', // Or "Caso #123" for anonymity
      story: 'Madre de 2 hijos buscando escapar de violencia doméstica.',
      goalAmount: 500, // USD
      urgencyLevel: 'HIGH',
      realName: 'María González', // Private, not shown publicly
      location: 'Lima, Perú', // Private
      isPublic: true // Show in donation page
    });
    
    if (caseId) {
      console.log(`✅ Case created: ${caseId}`);
    }
  };
  
  return (
    <button onClick={handleCreateCase} disabled={loading}>
      {loading ? 'Creando...' : 'Crear Pool de Donaciones'}
    </button>
  );
}
```

### Option C: Display in WalletView

Show custodial wallet info in the existing WalletView:

```typescript
import { useCustodialWallet } from '../lib/useCustodialWallet';

function WalletView() {
  const { walletAddress, caseInfo, loading } = useCustodialWallet();
  
  if (loading) return <div>Cargando...</div>;
  
  return (
    <div>
      {/* User never sees the 0x... address */}
      <h2>Tu Bóveda de Libertad</h2>
      
      {caseInfo && (
        <div>
          <p>Meta: ${caseInfo.goalAmount}</p>
          <p>Recaudado: ${caseInfo.currentAmount}</p>
          <div className="progress-bar">
            <div style={{ width: `${caseInfo.progress}%` }} />
          </div>
          
          {/* Share link for donations */}
          <button onClick={() => {
            navigator.clipboard.writeText(
              `https://athena.app/donate/${caseInfo.caseId}`
            );
          }}>
            Compartir Link de Donación
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 🌐 Public Donation Page

### Add Route to App.tsx

```typescript
import PublicDonationPage from './components/PublicDonationPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Calculator />} />
      <Route path="/donate" element={<PublicDonationPage />} />
      {/* ... other routes */}
    </Routes>
  );
}
```

### Access

Users can now visit:
- `https://your-app.com/donate` - See all active cases
- Click "Donar Ahora" - Opens Fraxscan to send ETH directly

---

## 🔐 Security Considerations

### Current Implementation (MVP)
- ✅ Private keys encrypted with AES
- ✅ Encryption key derived from userId + secret
- ✅ Keys stored in Firestore (protected by rules)
- ⚠️ Encryption key in environment variable

### Production Recommendations
1. **Use Google Cloud KMS:**
   ```typescript
   import { KeyManagementServiceClient } from '@google-cloud/kms';
   
   async function encryptPrivateKey(privateKey: string) {
     const client = new KeyManagementServiceClient();
     const [result] = await client.encrypt({
       name: 'projects/YOUR_PROJECT/locations/global/keyRings/athena/cryptoKeys/wallet-key',
       plaintext: Buffer.from(privateKey)
     });
     return result.ciphertext;
   }
   ```

2. **Implement 2FA for withdrawals**
3. **Add spending limits**
4. **Audit logs for all wallet operations**

---

## 📊 Data Flow

```
User Registration
    ↓
Generate Wallet (ethers.Wallet.createRandom())
    ↓
Encrypt Private Key (AES + userId salt)
    ↓
Save to Firestore (users/{uid}/custody/wallet)
    ↓
Create Case in AthenaPool.sol (optional)
    ↓
Save Case Metadata (cases/{caseId})
    ↓
Public Donation Page reads cases collection
    ↓
Donors send ETH to walletAddress
    ↓
Backend listens for deposits (webhook/cron)
    ↓
Update currentAmount in Firestore
```

---

## 🧪 Testing

### 1. Test Wallet Generation

```typescript
import { getCustodyService } from './lib/wallet-custody';

const testWalletGeneration = async () => {
  const service = getCustodyService();
  
  // Create wallet for test user
  const address = await service.createCustodialWallet('test-user-123');
  console.log('Generated address:', address);
  
  // Retrieve wallet
  const wallet = await service.getWallet('test-user-123');
  console.log('Retrieved wallet:', wallet);
  
  // Get wallet instance (for signing)
  const instance = await service.getWalletInstance('test-user-123');
  console.log('Can sign?', instance !== null);
};
```

### 2. Test Case Creation

```typescript
const testCaseCreation = async () => {
  const service = getCustodyService();
  
  const caseId = await service.createCaseWithMetadata('test-user-123', {
    displayName: 'Test Case',
    story: 'This is a test case for development',
    goalAmount: 100,
    urgencyLevel: 'LOW',
    isPublic: true
  });
  
  console.log('Created case:', caseId);
  
  // Retrieve case
  const metadata = await service.getCaseMetadata(caseId);
  console.log('Case metadata:', metadata);
};
```

---

## 🔄 Next Steps

1. **Integrate with Registration:** Add `createCustodialWallet()` to `AuthModal.tsx`
2. **Add to WalletView:** Show case info using `useCustodialWallet()` hook
3. **Deploy Public Page:** Make `/donate` route accessible
4. **Set up Webhooks:** Listen for donations and update `currentAmount`
5. **Migrate to KMS:** Replace env-based encryption with Google Cloud KMS

---

## 📝 Contract Address Storage

The contract address is already defined in `lib/pool-service.ts`:

```typescript
const ATHENA_POOL_ADDRESS = '0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605';
```

This is the single contract that manages all cases. Each case has a unique `caseId` but shares the same contract address.

---

## 💡 Frontend Example for Donors

Create a simple donation widget:

```typescript
function DonateButton({ caseId, walletAddress }: { caseId: string, walletAddress: string }) {
  const handleDonate = () => {
    // Option 1: Open Fraxscan
    window.open(`https://holesky.fraxscan.com/address/${walletAddress}`, '_blank');
    
    // Option 2: Use Web3 wallet (MetaMask)
    // if (window.ethereum) {
    //   await window.ethereum.request({
    //     method: 'eth_sendTransaction',
    //     params: [{
    //       to: walletAddress,
    //       value: '0x' + (0.01 * 1e18).toString(16), // 0.01 ETH
    //     }],
    //   });
    // }
  };
  
  return (
    <button onClick={handleDonate}>
      Donar a {caseId}
    </button>
  );
}
```

---

## ✅ Checklist

- [x] Install `crypto-js` dependency
- [x] Create `wallet-custody.ts` service
- [x] Create `useCustodialWallet.ts` hooks
- [x] Create `PublicDonationPage.tsx` component
- [ ] Add encryption key to `.env.local`
- [ ] Update Firestore security rules
- [ ] Integrate with `AuthModal.tsx`
- [ ] Add `/donate` route to `App.tsx`
- [ ] Test wallet generation
- [ ] Deploy public donation page

---

**Ready to integrate!** Start by adding the encryption key to `.env.local` and then integrate with your registration flow.
