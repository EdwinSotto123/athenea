# 💰 Sistema de Donaciones - Guía Completa

## 🌐 Red y Configuración Actual

**Red:** Fraxtal Testnet (L2 de Ethereum)
- **Chain ID:** 2523
- **RPC:** https://rpc.testnet.frax.com
- **Explorer:** https://holesky.fraxscan.com
- **Moneda:** frxETH (Frax Ether)

**Contrato Pool:** `0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605`

---

## 📋 Arquitectura Actual (Custodial)

```
┌─────────────────────────────────────────┐
│   Donante (Persona externa)             │
│   - Tiene MetaMask                      │
│   - Conecta a Fraxtal Testnet           │
└─────────────────────────────────────────┘
                    │
                    │ Envía frxETH
                    ▼
┌─────────────────────────────────────────┐
│   Wallet Custodial de la Víctima        │
│   0x429f5A734A148E4BA281a49eD2Ed83f035d5Ab51 │
│   (Generada automáticamente)            │
└─────────────────────────────────────────┘
                    │
                    │ Tú (Athena) controlas
                    ▼
┌─────────────────────────────────────────┐
│   Firestore: cases/ATHENA-XXX           │
│   - currentAmount actualizado           │
└─────────────────────────────────────────┘
```

---

## 🔧 Cómo Donar AHORA (Método Manual)

### Opción 1: MetaMask Direct Transfer

1. **Donante abre MetaMask**
2. **Agrega Fraxtal Testnet:**
   ```
   Network Name: Fraxtal Testnet
   RPC URL: https://rpc.testnet.frax.com
   Chain ID: 2523
   Currency Symbol: frxETH
   Block Explorer: https://holesky.fraxscan.com
   ```

3. **Consigue frxETH de prueba:**
   - Faucet: https://faucet.frax.com (si existe)
   - O usa un bridge de Sepolia/Holesky

4. **Envía frxETH a la wallet custodial:**
   ```
   To: 0x429f5A734A148E4BA281a49eD2Ed83f035d5Ab51
   Amount: 0.01 frxETH (ejemplo)
   ```

5. **La víctima ve el saldo actualizado** (cuando refresques el estado)

---

## 🚀 Integraciones Recomendadas (Para Producción)

### 1. **Botón "Donar con MetaMask"**

Agrega esto a `PublicDonationPage.tsx`:

```tsx
const handleDonate = async (walletAddress: string) => {
  if (!window.ethereum) {
    alert('Por favor instala MetaMask');
    return;
  }

  try {
    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Switch to Fraxtal Testnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x9DB' }], // 2523 in hex
    });

    // Send transaction
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: accounts[0],
        to: walletAddress,
        value: '0x2386F26FC10000', // 0.01 ETH in wei
      }],
    });

    alert(`✅ Donación enviada! TX: ${txHash}`);
  } catch (error) {
    console.error('Error donating:', error);
  }
};
```

### 2. **Webhook para Actualizar `currentAmount`**

Necesitas un backend que escuche transacciones:

```typescript
// backend/donation-listener.ts
import { ethers } from 'ethers';
import { getCustodyService } from './wallet-custody';

const provider = new ethers.JsonRpcProvider('https://rpc.testnet.frax.com');
const custodyService = getCustodyService();

// Listen for incoming transactions
provider.on('block', async (blockNumber) => {
  const block = await provider.getBlock(blockNumber, true);
  
  for (const tx of block.transactions) {
    // Check if transaction is to a custodial wallet
    const caseMetadata = await getCaseByWallet(tx.to);
    
    if (caseMetadata) {
      // Update currentAmount in Firestore
      const newAmount = caseMetadata.currentAmount + parseFloat(ethers.formatEther(tx.value));
      await custodyService.updateCaseAmount(caseMetadata.caseId, newAmount);
      
      console.log(`✅ Donation received: ${tx.value} to ${caseMetadata.caseId}`);
    }
  }
});
```

### 3. **Integración con Coinbase Commerce** (Más fácil)

Si quieres evitar complejidad:

```bash
npm install @coinbase/coinbase-commerce-node
```

```typescript
import { Client, resources } from '@coinbase/coinbase-commerce-node';

Client.init(process.env.COINBASE_COMMERCE_API_KEY);

const charge = await resources.Charge.create({
  name: `Donation to ${caseInfo.displayName}`,
  description: caseInfo.story,
  pricing_type: 'fixed_price',
  local_price: {
    amount: '10.00',
    currency: 'USD'
  },
  metadata: {
    caseId: caseInfo.caseId,
    walletAddress: caseInfo.walletAddress
  }
});

// Redirect user to charge.hosted_url
```

---

## 📱 Flujo de Donación Ideal (UX)

```
1. Usuario ve caso en /donate
   ↓
2. Click "Donar Ahora"
   ↓
3. Modal aparece:
   - Opción A: "Donar con MetaMask" (Web3)
   - Opción B: "Donar con Tarjeta" (Coinbase Commerce)
   ↓
4. Usuario elige monto ($5, $10, $25, Custom)
   ↓
5. Transacción se procesa
   ↓
6. Webhook actualiza Firestore
   ↓
7. Víctima ve saldo actualizado en WalletView
```

---

## 🔐 Seguridad: Retiro de Fondos

La víctima puede retirar fondos de 2 formas:

### Opción 1: SOS (Emergencia)
```typescript
// Transfiere TODO a contacto seguro
await triggerSOS(safeContactAddress);
```

### Opción 2: Retiro Normal
```typescript
// Desencripta wallet y envía a exchange/banco
const wallet = await custodyService.getWalletInstance(userId);
const tx = await wallet.sendTransaction({
  to: exchangeAddress,
  value: ethers.parseEther('0.5')
});
```

---

## 🎯 Próximos Pasos (Prioridad)

1. **[ ] Agregar botón "Donar con MetaMask"** en `PublicDonationPage.tsx`
2. **[ ] Crear webhook/listener** para actualizar `currentAmount`
3. **[ ] Agregar instrucciones** de cómo agregar Fraxtal Testnet
4. **[ ] Implementar modal de donación** con opciones de monto
5. **[ ] (Opcional) Integrar Coinbase Commerce** para tarjetas

---

## 💡 Alternativa: Usar AthenaPool Contract

Si prefieres usar el contrato `AthenaPool.sol` que ya tienes:

```solidity
// Donante llama:
athenaPool.donate("ATHENA-1765678243899-5ODG", { value: ethers.parseEther("0.1") });

// Víctima retira:
athenaPool.withdraw("ATHENA-1765678243899-5ODG", amount);
```

**Ventaja:** Más transparente (todo on-chain)
**Desventaja:** Más complejo para donantes (necesitan saber llamar funciones)

---

## 📊 Resumen

**Ahora mismo:**
- ✅ Casos se muestran en `/donate`
- ✅ Wallets custodiales creadas
- ❌ No hay botón funcional de donación
- ❌ No hay listener para actualizar montos

**Para hacer funcional:**
1. Agrega botón MetaMask (30 min)
2. Crea listener de transacciones (1 hora)
3. Deploy listener en servidor (30 min)

¿Quieres que implemente el botón de donación con MetaMask ahora?
