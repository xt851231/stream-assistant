import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDummy" });

async function run() {
  console.log("Checking Live config builder...");
  try {
    const session = await ai.live.connect({ model: "gemini-2.5-flash-native-audio-preview-12-2025" }).catch(e => {
        console.error("Connect failed as expected with dummy key");
    });
  } catch (e) {
    console.error(e);
  }
}
run();
