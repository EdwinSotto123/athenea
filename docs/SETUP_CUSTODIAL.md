# 🔑 INSTRUCCIONES RÁPIDAS - Configuración Final

## Paso 1: Agregar la Clave de Encriptación

Copia esta línea EXACTA y agrégala al final de tu archivo `.env.local`:

```
VITE_WALLET_ENCRYPTION_KEY=b3e04c323f90e1cbe126567485e00960c7555515b4387c331f4daafe2d7a32665
```

**⚠️ IMPORTANTE:** Esta clave es ÚNICA y fue generada aleatoriamente. **NO la compartas** con nadie.

---

## Paso 2: Verificar que Funciona

1. Reinicia tu servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Registra un nuevo usuario en la app.

3. Abre la consola del navegador (F12) y busca este mensaje:
   ```
   ✅ Custodial wallet created: 0x...
   ```

4. Si ves ese mensaje, ¡funciona! La wallet se creó automáticamente.

---

## ✅ Lo que ya está hecho:

- [x] Servicio de custodia creado (`lib/wallet-custody.ts`)
- [x] Hooks de React creados (`lib/useCustodialWallet.ts`)
- [x] Página pública de donaciones (`components/PublicDonationPage.tsx`)
- [x] Integración con AuthModal (auto-genera wallet al registrarse)
- [x] Clave de encriptación generada

---

## 📋 Próximos Pasos (Opcionales):

1. **Agregar ruta `/donate` a `App.tsx`:**
   ```tsx
   import PublicDonationPage from './components/PublicDonationPage';
   
   <Route path="/donate" element={<PublicDonationPage />} />
   ```

2. **Mostrar info de caso en WalletView:**
   ```tsx
   import { useCustodialWallet } from '../lib/useCustodialWallet';
   
   const { caseInfo } = useCustodialWallet();
   ```

3. **Crear caso cuando usuario complete plan:**
   ```tsx
   const { createCase } = useCustodialWallet();
   
   await createCase({
     displayName: 'María',
     story: 'Necesita ayuda para escapar...',
     goalAmount: 500,
     urgencyLevel: 'HIGH'
   });
   ```

---

## 🔐 Seguridad en Producción

Cuando vayas a producción, reemplaza la encriptación por Google Cloud KMS:

```typescript
import { KeyManagementServiceClient } from '@google-cloud/kms';
```

Pero para el MVP, la encriptación AES con la clave en `.env.local` es suficiente.

---

**¡Listo!** Solo agrega esa línea a `.env.local` y reinicia el servidor.
