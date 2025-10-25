import React, { useState, useRef, useEffect } from 'react';
// Fix: Corrected import path, removing unnecessary extension.
import { sendMessageToGemini } from '../services/geminiService';
import { ChatIcon, PaperAirplaneIcon } from './icons/Icons';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

const GeminiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userInput: Message = { sender: 'user', text: input };
    setMessages(prev => [...prev, userInput]);
    setInput('');
    setIsLoading(true);

    try {
        const stream = await sendMessageToGemini(userInput.text);
        let botResponseText = '';
        setMessages(prev => [...prev, { sender: 'bot', text: '' }]);
        
        for await (const chunk of stream) {
            botResponseText += chunk.text;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { sender: 'bot', text: botResponseText };
                return newMessages;
            });
        }
    } catch (error) {
        console.error("Gemini Error:", error);
        setMessages(prev => [...prev, { sender: 'bot', text: 'Üzgünüm, bir sorunla karşılaştım. Lütfen daha sonra tekrar deneyin.' }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-accent text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-orange-600 transition-transform transform hover:scale-110"
          aria-label="Yapay Zeka Asistanı"
        >
          <ChatIcon className="w-8 h-8" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[32rem] bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col z-50">
          <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">ORION Asistanı</h3>
            <button onClick={() => setIsOpen(false)} className="text-muted dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">&times;</button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
                 <div className="flex justify-start">
                    <div className="max-w-xs px-4 py-2 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-900">
                        <div className="flex items-center space-x-1">
                            <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
          </main>

          <footer className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder="Bir soru sorun..."
                className="w-full bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent text-gray-900 dark:text-gray-200"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading}
                className="bg-accent text-white p-2.5 rounded-full hover:bg-orange-600 disabled:bg-gray-400"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </footer>
        </div>
      )}
    </>
  );
};

export default GeminiAssistant;