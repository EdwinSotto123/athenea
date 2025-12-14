# Athena - Comparación de Arquitecturas de Wallet

## 📊 Situación Actual vs Opciones Futuras

---

## 🔍 Tu Arquitectura ACTUAL (Pool-Based)

### Cómo Funciona Ahora:

```
┌─────────────────────────────────────────┐
│   TU WALLET (Admin)                     │
│   0x1F2a710fFaF8F81A339Da2824188597539  │
└─────────────────────────────────────────┘
                    │
                    │ Despliega
                    ▼
┌─────────────────────────────────────────┐
│   AthenaPool.sol (Smart Contract)       │
│   ├─ Case "ATHENA-001" → María          │
│   │  └─ owner: 0xMaría...               │
│   │  └─ balance: 0.5 ETH                │
│   ├─ Case "ATHENA-002" → Ana            │
│   │  └─ owner: 0xAna...                 │
│   │  └─ balance: 1.2 ETH                │
└─────────────────────────────────────────┘
```

### Pros ✅
- **Eficiente en Gas:** Un solo contrato gestiona múltiples casos.
- **Tú controlas:** Solo tú (admin) puedes crear casos.
- **Transparente:** Cada víctima tiene su `caseId` único.
- **Donaciones Directas:** Los ángeles donan al contrato, no a ti.

### Contras ❌
- **Cada víctima NECESITA una wallet:** Deben tener `0x...` para ser `owner`.
- **Fricción UX:** Si la víctima no sabe qué es crypto, es confuso.
- **Dependencia de ti:** Si pierdes tu clave admin, no puedes crear más casos.

---

## 🆕 Opción 1: Custodial "Federada" (Hedera Style)

### Concepto:
Tú creas y **custodias** las wallets de las víctimas. Ellas no ven claves privadas, solo un "login" normal (email/password).

### Arquitectura:

```
┌─────────────────────────────────────────┐
│   Athena Backend (Tu Servidor)          │
│   ├─ Wallet María: 0xABC... (encrypted) │
│   ├─ Wallet Ana:   0xDEF... (encrypted) │
│   └─ Master Key (MPC/HSM)               │
└─────────────────────────────────────────┘
                    │
                    │ Firma transacciones
                    ▼
┌─────────────────────────────────────────┐
│   Fraxtal Blockchain                    │
│   María: 0xABC... → 0.5 ETH             │
│   Ana:   0xDEF... → 1.2 ETH             │
└─────────────────────────────────────────┘
```

### Tecnologías:
- **Hedera Hashgraph:** Usa MPC (Multi-Party Computation) para dividir la clave en 3 partes (tú, víctima, trusted third party).
- **Fireblocks/DFNS:** Servicios que gestionan claves con MPC.
- **Web3Auth:** Permite login con Google/Email y genera wallets automáticamente.

### Pros ✅
- **UX Perfecta:** La víctima solo ve "Saldo: $500" sin saber qué es una wallet.
- **Recovery Social:** Si pierden acceso, pueden recuperar con guardians (hermana, amiga).
- **Escalable:** Puedes crear 1000 wallets sin que las víctimas sepan.

### Contras ❌
- **Centralización:** Tú tienes las claves (aunque encriptadas).
- **Costo:** Servicios como Fireblocks cobran por transacción.
- **Confianza:** Las víctimas deben confiar en que no robarás sus fondos.

---

## 🆕 Opción 2: Account Abstraction (ERC-4337)

### Concepto:
Cada víctima tiene una "Smart Wallet" que puede ser controlada sin claves privadas tradicionales.

### Arquitectura:

```
┌─────────────────────────────────────────┐
│   María (Email Login)                   │
│   └─ Smart Wallet 0xABC...              │
│      ├─ Guardian 1: Hermana             │
│      ├─ Guardian 2: Athena (tú)         │
│      └─ Recovery: 2 de 3 firmas         │
└─────────────────────────────────────────┘
```

### Tecnologías:
- **ERC-4337:** Estándar de Ethereum para "Smart Accounts".
- **Wallets:** Argent, Ambire, Coinbase Smart Wallet.
- **Bundlers:** Servicios que pagan el gas por la víctima (gasless transactions).

### Pros ✅
- **Descentralizado:** No custodias las claves, la víctima las tiene (pero encriptadas con email/biometría).
- **Social Recovery:** Si pierde acceso, 2 de 3 guardians pueden recuperar.
- **Gasless:** Tú puedes pagar el gas por ellas (patrocinado).

### Contras ❌
- **Complejidad:** Requiere infraestructura de bundlers y paymasters.
- **Costo Inicial:** Desplegar una Smart Wallet cuesta gas (aunque lo puedes subsidiar).
- **Compatibilidad:** No todas las chains soportan ERC-4337 (Fraxtal sí, es EVM).

---

## 🎯 Recomendación para Athena

### Corto Plazo (MVP Actual):
**Mantén el Pool-Based** pero agrega:
1. **Wallet Generation Service:** Cuando una víctima se registra, generas una wallet para ella automáticamente (guardas la clave encriptada en Firebase).
2. **Abstracción en UI:** Ella nunca ve `0x...`, solo ve "Tu Bóveda: $500".
3. **Export Option:** Si quiere, puede exportar su clave privada después.

### Largo Plazo (Producción):
**Migra a ERC-4337 + Social Recovery:**
1. Cada víctima tiene una Smart Wallet con guardians (tú + su contacto seguro).
2. Usas un Paymaster para pagar el gas por ellas.
3. Si pierden acceso, pueden recuperar con email + aprobación de guardians.

---

## 📋 Implementación Rápida (Custodial Simplificado)

Si quieres implementar custodial **ahora** sin Hedera:

```typescript
// lib/wallet-custody.ts
import { ethers } from 'ethers';
import { encrypt, decrypt } from './crypto-utils';

export async function createCustodialWallet(userId: string): Promise<string> {
  // 1. Generar wallet
  const wallet = ethers.Wallet.createRandom();
  
  // 2. Encriptar clave privada con password derivada del userId
  const encryptedKey = await encrypt(wallet.privateKey, userId);
  
  // 3. Guardar en Firestore
  await saveToFirestore(`users/${userId}/wallet`, {
    address: wallet.address,
    encryptedPrivateKey: encryptedKey,
    createdAt: Date.now()
  });
  
  // 4. Crear caso en AthenaPool
  await poolService.createCase(
    `ATHENA-${userId}`,
    wallet.address,
    safeContactAddress
  );
  
  return wallet.address;
}

export async function signTransaction(userId: string, tx: any) {
  // 1. Recuperar clave encriptada
  const { encryptedPrivateKey } = await getFromFirestore(`users/${userId}/wallet`);
  
  // 2. Desencriptar
  const privateKey = await decrypt(encryptedPrivateKey, userId);
  
  // 3. Firmar
  const wallet = new ethers.Wallet(privateKey);
  return await wallet.signTransaction(tx);
}
```

**Ventajas:**
- Implementas en 1 día.
- La víctima solo ve "Saldo" en la UI.
- Tú gestionas las claves de forma segura.

**Riesgos:**
- Si hackean Firebase, pueden robar claves (mitiga con KMS de Google Cloud).
- Eres custodio legal de los fondos (implicaciones regulatorias).

---

## 🔐 Seguridad: Hedera vs ERC-4337 vs Custodial Simple

| Aspecto | Pool Actual | Custodial Simple | Hedera MPC | ERC-4337 |
|---------|-------------|------------------|------------|----------|
| **Custodia** | Víctima | Tú (Athena) | Compartida (3 partes) | Víctima (con guardians) |
| **UX** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Seguridad** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Costo** | Bajo | Bajo | Alto | Medio |
| **Complejidad** | Baja | Baja | Alta | Alta |
| **Recovery** | No | Tú decides | Social (3 partes) | Social (guardians) |

---

## 💡 Conclusión

**Para tu caso (víctimas de violencia que NO saben de crypto):**

1. **Ahora:** Implementa **Custodial Simplificado** con wallets generadas automáticamente.
2. **En 3 meses:** Migra a **ERC-4337** con social recovery (hermana + Athena como guardians).
3. **Evita Hedera:** Es overkill para tu MVP y Fraxtal ya es rápido/barato.

**Próximo Paso:**
¿Quieres que implemente el servicio de `wallet-custody.ts` que genera wallets automáticamente al registrarse?
