import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getChat = () => ai.chats.create({
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

let chatInstance: Chat = getChat();

/**
 * Sends a message to the Gemini model and returns the response stream.
 * @param message The user's message.
 * @returns An async iterable stream of GenerateContentResponse chunks.
 */
export async function sendMessageToGemini(message: string): Promise<AsyncGenerator<GenerateContentResponse>> {
    try {
        // Fix: Return the result of sendMessageStream directly.
        const result = await chatInstance.sendMessageStream({ message });
        return result;
    } catch (error) {
        console.error("Gemini chat error, restarting chat session:", error);
        // If the chat session has an issue, try creating a new one
        chatInstance = getChat();
        // Fix: Return the result of sendMessageStream directly after restarting the chat.
        const result = await chatInstance.sendMessageStream({ message });
        return result;
    }
}