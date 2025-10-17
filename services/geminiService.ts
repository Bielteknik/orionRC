
// This function communicates with our own backend, which then securely calls the Gemini API.
export const sendMessageToGemini = async function* (message: string) {
    try {
        const response = await fetch('/api/gemini-chat-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Yapay zeka asistanından yanıt alınamadı.');
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Yanıt akışı okunamadı.');
        }

        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value);
            // Yield each piece of text as it arrives
            yield { text: chunk };
        }

    } catch (error) {
        console.error("Error streaming message from backend:", error);
        // Yield a final error message in the generator
        yield { text: "Üzgünüm, asistana bağlanırken bir sorun oluştu." };
    }
};
