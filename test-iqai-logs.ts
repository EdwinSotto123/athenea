/**
 * Test script for IQAI Logs API
 * Run with: npx tsx test-iqai-logs.ts
 */

const IQAI_CONFIG = {
    logsEndpoint: "https://app.iqai.com/api/logs",
    apiKey: "4465fc43-06c7-41b7-9e03-16cd3f6dd2ab",
    agentTokenContract: "0xee30b1d751c32cfed78826ed6377927d7ff85892"
};

async function testLog() {
    console.log("🧪 Testing IQAI Logs API...\n");

    const payload = {
        agentTokenContract: IQAI_CONFIG.agentTokenContract,
        content: "💜 ¡Luna AB. ha iniciado su camino hacia la libertad! Athena la acompañará en cada paso. Juntas somos más fuertes. #NuevaEsperanza",
        type: "Agent",
        chainId: 252  // Must be NUMBER, not string
    };

    console.log("📤 Sending payload:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("\n");

    try {
        const response = await fetch(IQAI_CONFIG.logsEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apiKey": IQAI_CONFIG.apiKey
            },
            body: JSON.stringify(payload)
        });

        console.log("📥 Response status:", response.status, response.statusText);

        const text = await response.text();
        console.log("📥 Response body:", text);

        if (response.ok) {
            console.log("\n✅ SUCCESS! Log sent to IQAI Dashboard");
        } else {
            console.log("\n❌ FAILED! Check the error above");
        }
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

testLog();
