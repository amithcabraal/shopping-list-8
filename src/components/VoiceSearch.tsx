import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface VoiceSearchProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export const VoiceSearch: React.FC<VoiceSearchProps> = ({ onResult, disabled }) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('Voice recognition is not supported in your browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      toast.success('Listening...');
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      toast.success('Voice input received');
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      toast.error('Error recognizing speech');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={disabled || isListening}
      className={`p-2 rounded-full transition-colors ${
        isListening 
          ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      }`}
      title={isListening ? 'Listening...' : 'Voice search'}
    >
      {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
    </button>
  );
};