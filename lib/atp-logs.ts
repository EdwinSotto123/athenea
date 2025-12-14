/**
 * IQAI ATP Logs Service
 * 
 * Sends humanized logs to the IQAI ATP Dashboard for Athena agent.
 * This makes the agent appear active and builds trust with token holders.
 */

// ATP Configuration
const ATP_CONFIG = {
    agentContract: "0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4",
    tokenContract: "0xee30b1d751c32cfed78826ed6377927d7ff85892",
    liquidityPool: "0x805c15c2d7e13c32bde69ef3982bc3f1e835ba24",
    network: "Fraxtal",
    chainId: 252
};

const IQAI_API = {
    logsEndpoint: "https://app.iqai.com/api/logs",
    // @ts-ignore
    apiKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_IQAI_API_KEY) || ""
};

// Generate pseudonym for privacy
function generatePseudonym(): string {
    const names = [
        "Luna", "Aurora", "Esperanza", "Victoria", "Valentía",
        "Fortaleza", "Libertad", "Estrella", "Mariposa", "Fénix",
        "Amanecer", "Renacer", "Guerrera", "Valiente", "Luz"
    ];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
        String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${randomName} ${randomLetters}.`;
}

// Log templates
const TEMPLATES = {
    USER_JOINED: (p: string) =>
        `💜 ¡${p} ha iniciado su camino hacia la libertad! Athena la acompañará en cada paso. Juntas somos más fuertes. #NuevaEsperanza`,

    PLAN_STARTED: (p: string) =>
        `🦋 ${p} está creando su plan de escape con Athena. Cada paso cuenta, cada decisión es valiente. #PlaneandoLibertad`,

    PLAN_COMPLETED: (p: string, goal: number) =>
        `✨ ¡${p} tiene su Freedom Goal definida! Meta: $${goal} para su nueva vida. El camino está trazado. #MetaDeLibertad`,

    VAULT_DEPOSIT: (p: string, amount: number) =>
        `💰 ${p} añadió $${amount.toFixed(2)} a su Freedom Vault. Cada centavo es un paso más cerca de la libertad. #AhorrandoEsperanza`,

    VAULT_MILESTONE: (p: string, percent: number) =>
        `🎯 ¡${p} alcanzó el ${percent}% de su Freedom Goal! El vuelo a la libertad está cada vez más cerca. 🦅 #ProgresoReal`,

    EVIDENCE_SECURED: (p: string, type: string) =>
        `🔐 ${p} aseguró evidencia (${type}) en blockchain. Protegida para siempre, nadie puede borrarla. #EvidenciaSegura`,

    WITHDRAWAL_COMPLETED: (p: string) =>
        `✅ Fondos transferidos exitosamente para ${p}. Un paso más en su camino a la libertad. #MisiónCumplida`,

    SOS_TRIGGERED: (p: string) =>
        `🆘 EMERGENCIA: ${p} activó el protocolo SOS. Athena está transfiriendo todos los fondos a su lugar seguro. #ProtocoloDeEmergencia`,

    DONATION_RECEIVED: (amount: number) =>
        `💜 ¡Donación de $${amount.toFixed(2)} recibida! La comunidad se une para apoyar. Gracias, ángeles donadores. #ComunidadSolidaria`
};

type LogAction = keyof typeof TEMPLATES;

/**
 * Send a log to IQAI ATP Dashboard
 */
export async function sendATPLog(
    action: LogAction,
    data?: { amount?: number; goal?: number; percent?: number; type?: string },
    txHash?: string
): Promise<boolean> {
    const pseudo = generatePseudonym();

    let message = "";
    switch (action) {
        case "USER_JOINED":
            message = TEMPLATES.USER_JOINED(pseudo);
            break;
        case "PLAN_STARTED":
            message = TEMPLATES.PLAN_STARTED(pseudo);
            break;
        case "PLAN_COMPLETED":
            message = TEMPLATES.PLAN_COMPLETED(pseudo, data?.goal || 0);
            break;
        case "VAULT_DEPOSIT":
            message = TEMPLATES.VAULT_DEPOSIT(pseudo, data?.amount || 0);
            break;
        case "VAULT_MILESTONE":
            message = TEMPLATES.VAULT_MILESTONE(pseudo, data?.percent || 0);
            break;
        case "EVIDENCE_SECURED":
            message = TEMPLATES.EVIDENCE_SECURED(pseudo, data?.type || "documento");
            break;
        case "WITHDRAWAL_COMPLETED":
            message = TEMPLATES.WITHDRAWAL_COMPLETED(pseudo);
            break;
        case "SOS_TRIGGERED":
            message = TEMPLATES.SOS_TRIGGERED(pseudo);
            break;
        case "DONATION_RECEIVED":
            message = TEMPLATES.DONATION_RECEIVED(data?.amount || 0);
            break;
    }

    console.log("[ATP-LOG]", message);

    if (!IQAI_API.apiKey) {
        console.warn("[ATP-LOG] No API key configured");
        return false;
    }

    try {
        const response = await fetch(IQAI_API.logsEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apiKey": IQAI_API.apiKey
            },
            body: JSON.stringify({
                agentTokenContract: ATP_CONFIG.tokenContract,
                content: message,
                type: "Agent",
                txHash: txHash || undefined,
                chainId: ATP_CONFIG.chainId
            })
        });

        if (response.ok) {
            console.log("[ATP-LOG] ✅ Sent to IQAI Dashboard");
            return true;
        } else {
            console.warn("[ATP-LOG] ⚠️ Failed:", await response.text());
            return false;
        }
    } catch (error) {
        console.error("[ATP-LOG] ❌ Error:", error);
        return false;
    }
}

// Convenience functions
export const atpLogs = {
    userJoined: () => sendATPLog("USER_JOINED"),
    planStarted: () => sendATPLog("PLAN_STARTED"),
    planCompleted: (goal: number) => sendATPLog("PLAN_COMPLETED", { goal }),
    deposit: (amount: number) => sendATPLog("VAULT_DEPOSIT", { amount }),
    milestone: (percent: number) => sendATPLog("VAULT_MILESTONE", { percent }),
    evidenceSecured: (type: string) => sendATPLog("EVIDENCE_SECURED", { type }),
    withdrawalCompleted: () => sendATPLog("WITHDRAWAL_COMPLETED"),
    sosTriggered: () => sendATPLog("SOS_TRIGGERED"),
    donationReceived: (amount: number) => sendATPLog("DONATION_RECEIVED", { amount })
};

export default atpLogs;
