import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/VITE_GEMINI_API_KEY=([^\n]+)/);
if (match) process.env.VITE_GEMINI_API_KEY = match[1].replace(/"/g, '');

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

async function run() {
    console.log("Connecting Persona A...");
    let sessionA;
    try {
        sessionA = await ai.clients.createLiveClient({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: { parts: [{ text: "You are Felix, a wizard." }] },
                responseModalities: ["TEXT"],
                sessionResumption: {}
            }
        });
    } catch (e) { console.error(e); }

    let handle = null;
    let gotResponseA = false;

    sessionA.on('content', (msg) => {
        if (msg.sessionResumptionUpdate?.newHandle) {
            handle = msg.sessionResumptionUpdate.newHandle;
            console.log("Got Handle:", handle.substring(0, 10) + '...');
        }
        if (msg.serverContent?.modelTurn) {
            console.log("Felix:", msg.serverContent.modelTurn.parts.map(p => p.text).join(""));
            gotResponseA = true;
        }
    });

    await sessionA.connect();
    await sessionA.send({ turns: [{ role: 'user', parts: [{ text: "My favorite color is Yellow." }] }] });

    await new Promise(r => {
        const i = setInterval(() => { if (handle && gotResponseA) { clearInterval(i); r(); } }, 100);
    });

    sessionA.disconnect();
    console.log("Disconnecting Felix. Handle saved.\n");

    console.log("Connecting Persona B...");
    const sessionB = await ai.clients.createLiveClient({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: { parts: [{ text: "You are Luna, a moon elf." }] },
            responseModalities: ["TEXT"],
            sessionResumption: { handle }
        }
    });

    let gotResponseB = false;
    sessionB.on('content', (msg) => {
        if (msg.serverContent?.modelTurn) {
            console.log("Luna:", msg.serverContent.modelTurn.parts.map(p => p.text).join(""));
            gotResponseB = true;
        }
    });

    await sessionB.connect();
    await sessionB.send({ turns: [{ role: 'user', parts: [{ text: "What is my favorite color?" }] }] });

    await new Promise(r => {
        const i = setInterval(() => { if (gotResponseB) { clearInterval(i); r(); } }, 100);
    });

    sessionB.disconnect();
    console.log("Done.");
}

run();
