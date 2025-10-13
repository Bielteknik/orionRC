
import { GoogleGenAI, Chat } from "@google/genai";

// Ensure API_KEY is available in the environment
if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

let chat: Chat | null = null;

const SYSTEM_INSTRUCTION = "Sen dünya standartlarında bir meteoroloji asistanısın. Kullanıcı sorularını açık ve öz bir şekilde yanıtla. Hava olaylarını açıklayabilir, sensör okumalarını yorumlayabilir ve trendlere göre tahminlerde bulunabilirsin. Cevaplarını her zaman Türkçe ver.";

export const startChat = () => {
  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const sendMessageToGemini = async (message: string) => {
    if (!chat) {
        startChat();
    }
    
    if (chat) {
        try {
            const result = await chat.sendMessageStream({ message });
            return result;
        } catch (error) {
            console.error("Error sending message to Gemini:", error);
            throw new Error("Yapay zeka asistanına mesaj gönderilirken bir hata oluştu.");
        }
    }
    throw new Error("Sohbet başlatılamadı.");
};