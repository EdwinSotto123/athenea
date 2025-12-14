# 💜 Athena - Freedom Protocol

> **AI Agent that protects domestic violence victims through financial sovereignty and immutable evidence.**

[![IQAI Agent](https://img.shields.io/badge/IQAI-Agent%20Tokenized-purple)](https://app.iqai.com/agents/0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4)
[![Fraxtal](https://img.shields.io/badge/Network-Fraxtal%20L2-blue)](https://frax.com)
[![ADK-TS](https://img.shields.io/badge/Framework-ADK--TS-green)](https://github.com/iqai/adk)

---

## 🌐 Live Links

| Resource | Link |
|----------|------|
| 🚀 **App (Demo)** | [athenea-nine.vercel.app](https://athenea-nine.vercel.app/) |
| 🤖 **Agent Dashboard** | [IQAI ATP Dashboard](https://app.iqai.com/agents/0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4) |
| 💜 **$ATHENA Token** | `0xee30b1d751c32cfed78826ed6377927d7ff85892` |
| 📊 **Agent Contract** | `0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4` |
| 💧 **Liquidity Pool** | `0x805c15c2d7e13c32bde69ef3982bc3f1e835ba24` |

---

## 🎯 The Problem

**99% of domestic violence victims suffer financial abuse.** Without their own money or immutable evidence (often deleted by abusers), escape is logistically impossible.

## 💡 The Solution

A stealth AI agent disguised as a calculator that provides:

| Feature | Description |
|---------|-------------|
| 🔐 **Freedom Vault** | Secret crypto savings account (frxETH on Fraxtal) |
| 📁 **Evidence Locker** | Photos/audio/text stored on IPFS with blockchain hashes |
| 🆘 **Panic Button (SOS)** | One-tap emergency liquidation to safe contact |
| 🤖 **AI Companion** | Empathetic planning assistant powered by Gemini |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ATHENA AGENT (ADK-TS)                │
├──────────────┬──────────────┬───────────────────────────┤
│   🧠 Brain   │   💪 Muscle  │      🔗 Blockchain        │
│  Gemini 2.5  │ AthenaAgent  │    Fraxtal L2 Testnet     │
│  Flash Lite  │   TypeScript │    Custodial Wallets      │
└──────────────┴──────────────┴───────────────────────────┘
        │               │                   │
        ▼               ▼                   ▼
   Risk Analysis   Evidence Hash      SOS Transfer
   Escape Planning IPFS Storage      ATP Logs (IQAI)
```

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| Agent Core | `lib/athena-agent.ts` | ADK-TS pattern implementation |
| Blockchain SOS | `lib/blockchain-sos.ts` | Real frxETH transfers on testnet |
| Custodial Wallets | `lib/wallet-custody.ts` | Auto-generated encrypted wallets |
| Evidence Export | `lib/evidence-export.ts` | User-friendly certificates |
| ATP Logs | `lib/atp-logs.ts` | IQAI dashboard humanized logs |

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, Vite, Tailwind CSS, Lucide |
| **AI** | Google Vertex AI, Gemini 2.5, IQAI ADK-TS |
| **Blockchain** | Fraxtal L2 (Testnet), Ethers.js |
| **Storage** | Firebase (Auth/Firestore), IPFS (Pinata) |
| **Agent Platform** | IQAI Agent Tokenization Platform |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/your-repo/athenea.git
cd athenea

# Install
npm install

# Configure (copy and edit)
cp .env.local.example .env.local
# Add your API keys (see .env.firebase for Firebase config)

# Run
npm run dev
```

### Required Environment Variables

```env
# Firebase (see .env.firebase for values)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=

# Gemini AI
VITE_GEMINI_API_KEY=your-gemini-api-key

# IPFS (Pinata)
VITE_PINATA_JWT=your-pinata-jwt

# Wallet Encryption
VITE_WALLET_ENCRYPTION_KEY=your-secret-key

# IQAI ATP (for agent logs)
VITE_IQAI_API_KEY=your-iqai-api-key
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **Wallet Custody** | Auto-generated on registration, AES encrypted in Firestore |
| **Evidence Hashing** | SHA-256 + IPFS CID verification |
| **Stealth Mode** | Calculator disguise, quick escape button |
| **SOS Protocol** | Real blockchain transfer to safe destination |

---

## 📊 IQAI ATP Integration

Athena is a **tokenized agent** on the IQAI platform. Every significant action generates an on-chain log:

```
💜 ¡Luna AB. ha iniciado su camino hacia la libertad!
🔐 Aurora CD. aseguró evidencia (FOTO) en blockchain
✨ ¡Esperanza EF. tiene su Freedom Goal! Meta: $1,100
🆘 EMERGENCIA: Valentía GH. activó el protocolo SOS
```

**View logs:** [IQAI Dashboard](https://app.iqai.com/agents/0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4/logs)

---

## 🎯 Roadmap

- [x] MVP with Vault, Locker, AI Planner
- [x] Custodial wallet system
- [x] IQAI ATP integration
- [x] Real blockchain SOS on testnet
- [ ] Angels Pool for anonymous donations
- [ ] Dynamic disguise (Calculator, Recipes, Period Tracker)
- [ ] Mainnet deployment

---

## 💜 Impact

> *Technology that saves lives.*

Athena empowers victims with:
- **Financial invisibility** from abusers
- **Legally valid evidence** stored forever
- **One-tap escape** when danger escalates

---

**Built with 💜 for IQAI Hackathon**

*Protecting those who need it most.*
