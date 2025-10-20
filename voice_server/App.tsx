import React, { useState, useEffect, useRef } from 'react';
import { Receipt } from './types';
import { generateReceiptJson } from './services/geminiService';
import JsonViewer from './components/JsonViewer';

// FIX: Add type alias for SpeechRecognition to resolve missing type definition error.
type SpeechRecognition = any;

// Polyfill for cross-browser compatibility
// FIX: Cast window to `any` to access vendor-prefixed speech recognition APIs and rename variable to avoid shadowing the SpeechRecognition type.
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const MicrophoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 10.12V16a1 1 0 11-2 0v-1.88A5.002 5.002 0 015 9V8a1 1 0 012 0v1a3 3 0 006 0V8a1 1 0 012 0v1a5.002 5.002 0 01-5 5.12z" clipRule="evenodd" />
    </svg>
);

const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
    </svg>
);

const App: React.FC = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>('');
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [status, setStatus] = useState<string>('Nhấn nút và bắt đầu nói.');
    const [error, setError] = useState<string | null>(null);
    
    // FIX: Use the `SpeechRecognition` type correctly. The constant that was shadowing it has been renamed.
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        // FIX: Use the renamed constant `SpeechRecognitionAPI` to check for browser support.
        if (!SpeechRecognitionAPI) {
            setError('Trình duyệt này không hỗ trợ nhận dạng giọng nói.');
            return;
        }

        // FIX: Use the renamed constant `SpeechRecognitionAPI` to create a new instance.
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'vi-VN';

        // FIX: Explicitly type event as any to avoid potential implicit any errors.
        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setTranscript(prev => prev + finalTranscript);
            // Optionally display interim results for better UX, but here we only update on final.
        };

        // FIX: Explicitly type event as any to avoid potential implicit any errors.
        recognition.onerror = (event: any) => {
            setError(`Lỗi nhận dạng giọng nói: ${event.error}`);
        };
        
        recognition.onend = () => {
            if (isRecording) {
                // Restart recognition if it stops unexpectedly while recording
                recognition.start();
            }
        };

        recognitionRef.current = recognition;
    }, [isRecording]);

    const toggleRecording = () => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        if (isRecording) {
            recognition.stop();
            setIsRecording(false);
            setStatus('Đang xử lý hóa đơn của bạn...');
            handleGenerateReceipt();
        } else {
            setTranscript('');
            setReceipt(null);
            setError(null);
            recognition.start();
            setIsRecording(true);
            setStatus('Đang nghe... Vui lòng đọc các mục trên hóa đơn.');
        }
    };

    const handleGenerateReceipt = async () => {
        if (!transcript.trim()) {
            setError('Không phát hiện thấy giọng nói. Vui lòng thử lại.');
            setStatus('Nhấn nút và bắt đầu nói.');
            return;
        }

        try {
            const result = await generateReceiptJson(transcript);
            setReceipt(result);
            setStatus('Hóa đơn của bạn đã được tạo!');
        } catch (e: any) {
            setError(e.message || 'Đã xảy ra lỗi không xác định.');
            setStatus('Tạo hóa đơn thất bại. Vui lòng thử lại.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center">
                <header className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Hóa đơn AI bằng giọng nói
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">
                        Chỉ cần đọc chi tiết hóa đơn của bạn và xem AI cấu trúc nó thành JSON.
                    </p>
                </header>

                <main className="w-full flex flex-col items-center space-y-8">
                    <div className="relative">
                        <button
                            onClick={toggleRecording}
                            className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                                isRecording
                                ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400'
                                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                            }`}
                        >
                            {isRecording && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                            {isRecording ? <StopIcon /> : <MicrophoneIcon />}
                        </button>
                    </div>
                    
                    <p className="text-gray-300 h-6 transition-opacity duration-300">{status}</p>

                    {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>}

                    <div className="w-full max-w-2xl bg-gray-800/50 p-4 rounded-lg shadow-inner min-h-[100px]">
                        <h3 className="text-sm font-semibold text-gray-400 mb-2">Bản ghi</h3>
                        <p className="text-gray-200">{transcript || '...'}</p>
                    </div>

                    {status === 'Đang xử lý hóa đơn của bạn...' && (
                         <div className="flex items-center space-x-2 text-gray-400">
                            <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Đang phân tích và tạo JSON...</span>
                        </div>
                    )}
                    
                    {receipt && <JsonViewer data={receipt} />}
                </main>
                 <footer className="mt-12 text-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Hóa đơn AI bằng giọng nói. Cung cấp bởi Gemini.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;