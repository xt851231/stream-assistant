import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({});

async function test() {
    const session = await ai.clients.createLiveClient({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: "You are Felix.",
        }
    });

    session.on('content', (msg) => {
        console.log("RECEIVED", JSON.stringify(msg, null, 2));
    });

    await session.connect();
    await session.send({ turns: [{ role: 'user', parts: [{ text: "I like yellow." }] }] });
    
    setTimeout(() => {
        session.disconnect();
        process.exit();
    }, 4000);
}
test();
