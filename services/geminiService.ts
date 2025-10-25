import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

let chatInstance: Chat | null = null;

const getChat = (): Chat => {
    // This function will be called on first use and will either return
    // an existing chat instance or create a new one.
    if (chatInstance) {
        return chatInstance;
    }

    // The constructor will throw an error if the API key is not provided.
    // This error will be caught by the calling function.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    chatInstance = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are ORION Assistant, a helpful AI assistant for a sophisticated weather and environmental monitoring system. 
    Your primary role is to help users understand data, identify trends, and manage their monitoring stations.
    - You have access to real-time data about stations, sensors (temperature, humidity, wind, snow depth, etc.), and cameras.
    - Be concise and direct in your answers.
    - When asked about system status, you should imagine you have access to the data and provide plausible, realistic responses. For example: "Station Alpha is online, reporting a temperature of 15°C with stable conditions."
    - If a user asks a question outside the scope of weather/environmental monitoring, politely decline and steer the conversation back to your purpose. For example: "I am an assistant for the ORION monitoring system. I can help you with questions about your stations and sensor data."
    - Do not make up fake data if you can't access it, instead say something like "I cannot access live data at the moment, but I can help you analyze patterns or explain what certain metrics mean."
    - Respond in Turkish.
    `,
      },
    });

    return chatInstance;
};

/**
 * Sends a message to the Gemini model and returns the response stream.
 * @param message The user's message.
 * @returns An async iterable stream of GenerateContentResponse chunks.
 */
export async function sendMessageToGemini(message: string): Promise<AsyncGenerator<GenerateContentResponse>> {
    try {
        const chat = getChat();
        const result = await chat.sendMessageStream({ message });
        return result;
    } catch (error) {
        console.error("Gemini chat error, restarting chat session:", error);
        // If the chat session has an issue (e.g., expired), reset and try again.
        chatInstance = null;
        const chat = getChat();
        const result = await chat.sendMessageStream({ message });
        return result;
    }
}