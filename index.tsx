// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality, Type, Chat } from '@google/genai';

// --- Helper Functions for Audio Processing ---

/**
 * Decodes a base64 string into a Uint8Array.
 */
function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer for playback.
 */
async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts a File object to a base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove the "data:image/jpeg;base64," part
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
}


// --- UI Translations ---

const translations = {
  th: {
    title: 'AI สร้างสูตรอาหาร',
    description: 'บอกอาหารที่คุณอยากทาน แล้ว AI จะสร้างสูตรพิเศษให้คุณ by ต้นเองจ้า',
    placeholder: 'เช่น "ชีสเค้กเนื้อนุ่มฟู ไม่ต้องอบ สไตล์ญี่ปุ่น"',
    generate: 'สร้างสูตร',
    openFile: 'เปิดไฟล์',
    extractTextFromImage: 'ดึงข้อความจากภาพ',
    extractingText: 'กำลังดึงข้อความ...',
    analyzeImage: 'วิเคราะห์จากภาพ',
    analyzing: 'กำลังวิเคราะห์...',
    generating: 'กำลังสร้าง...',
    readAloud: 'อ่านสูตรให้ฟัง',
    loadingAudio: 'กำลังโหลดเสียง...',
    copy: 'คัดลอก',
    copied: 'คัดลอกแล้ว! ✅',
    saveTxt: 'บันทึกเป็น .txt',
    error: 'เกิดข้อผิดพลาด:',
    langThai: 'ไทย',
    langEnglish: 'English',
    filenameLabel: 'ชื่อไฟล์',
    servingsLabel: 'ปริมาณ',
    calculate: 'คำนวณ',
    calculating: 'กำลังคำนวณ...',
    decreaseFontSize: 'ลดขนาดตัวอักษร',
    increaseFontSize: 'เพิ่มขนาดตัวอักษร',
    askQuestion: 'สอบถามเกี่ยวกับสูตร',
    chatPlaceholder: 'ถามคำถามเกี่ยวกับสูตรนี้...',
    send: 'ส่ง',
    clear: 'ลบ',
    aiTyping: 'AI กำลังพิมพ์...',
    you: 'คุณ',
    ai: 'AI',
    generateImage: 'สร้างภาพ',
    generatingImage: 'กำลังสร้างภาพ...',
    unit_serve: 'ที่ (serve)',
    unit_part: 'ส่วน',
    unit_piece: 'ชิ้น',
    rateLimitError: 'คุณใช้โควต้า API เกินกำหนดแล้ว โปรดตรวจสอบแผนการใช้งานและการเรียกเก็บเงินของคุณใน Google AI Studio หรือรอสักครู่แล้วลองอีกครั้ง',
    textModelLabel: 'โมเดลข้อความ:',
    imageModelLabel: 'โมเดลสร้างภาพ:',
    apiKeyRequired: 'กรุณากรอก API Key ด้านบนก่อนเริ่มใช้งาน',
    apiKeySaved: 'บันทึก API Key ลงระบบเรียบร้อย',
    apiKeyPleaseEnter: 'กรุณากรอก API Key',
    apiKeyCopiedMsg: 'คัดลอก API Key ลง Clipboard แล้ว',
    noApiKey: 'no API key',
  },
  en: {
    title: 'AI Recipe Maker',
    description: 'Describe the dish you crave, and AI will create a custom recipe for you.',
    placeholder: 'e.g., "A fluffy, no-bake Japanese-style cheesecake"',
    generate: 'Generate Recipe',
    openFile: 'Open File',
    extractTextFromImage: 'Extract Text from Image',
    extractingText: 'Extracting Text...',
    analyzeImage: 'Analyze from Image',
    analyzing: 'Analyzing...',
    generating: 'Generating...',
    readAloud: 'Read Aloud',
    loadingAudio: 'Loading Audio...',
    copy: 'Copy',
    copied: 'Copied! ✅',
    saveTxt: 'Save as .txt',
    error: 'An error occurred:',
    langThai: 'ไทย',
    langEnglish: 'English',
    filenameLabel: 'Filename',
    servingsLabel: 'Servings',
    calculate: 'Calculate',
    calculating: 'Calculating...',
    decreaseFontSize: 'Decrease font size',
    increaseFontSize: 'Increase font size',
    askQuestion: 'Ask about the recipe',
    chatPlaceholder: 'Ask a question about this recipe...',
    send: 'Send',
    clear: 'Clear',
    aiTyping: 'AI is typing...',
    you: 'You',
    ai: 'AI',
    generateImage: 'Generate Image',
    generatingImage: 'Generating Image...',
    unit_serve: 'servings',
    unit_part: 'parts',
    unit_piece: 'pieces',
    rateLimitError: 'You have exceeded your API quota. Please check your usage plan and billing details in Google AI Studio, or wait a while and try again.',
    textModelLabel: 'Text Model:',
    imageModelLabel: 'Image Model:',
    apiKeyRequired: 'Please enter an API Key at the top first.',
    apiKeySaved: 'API Key saved!',
    apiKeyPleaseEnter: 'Please enter an API Key',
    apiKeyCopiedMsg: 'API Key copied!',
    noApiKey: 'no API key',
  }
};

// --- Styles ---

const appContainerStyle: React.CSSProperties = {
  backgroundColor: 'var(--card-bg-color)',
  padding: '2rem',
  borderRadius: '16px',
  boxShadow: 'var(--shadow)',
  textAlign: 'center',
  transition: 'all 0.4s ease-in-out',
  border: '1px solid var(--border-color)',
  width: '100%',
  backdropFilter: 'blur(10px)',
};

const apiKeyContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  marginBottom: '2rem',
  padding: '1rem',
  backgroundColor: '#1F222A',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  flexWrap: 'wrap',
};

const apiKeyInputStyle: React.CSSProperties = {
  flexGrow: 1,
  padding: '0.6rem 0.8rem',
  fontSize: '1rem',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  backgroundColor: '#101216',
  color: 'var(--text-color)',
  minWidth: '400px',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  color: 'var(--primary-color)',
  fontSize: '3.5rem',
  margin: '0 0 0.5rem 0',
  textShadow: '0 1px 8px rgba(0, 255, 240, 0.3)',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  color: '#A0A5B0',
  marginBottom: '2.5rem',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '1rem',
  fontSize: '1rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  boxSizing: 'border-box',
  minHeight: '120px',
  marginBottom: '1.5rem',
  resize: 'vertical',
  fontFamily: 'inherit',
  backgroundColor: '#101216',
  color: 'var(--text-color)',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const baseButtonStyle: React.CSSProperties = {
  padding: '0.8rem 1.5rem',
  fontSize: '1rem',
  fontWeight: '600',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '8px',
  transition: 'all 0.3s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  backgroundColor: 'var(--primary-color)',
  color: '#121418',
  boxShadow: '0 4px 15px rgba(0, 255, 240, 0.2)',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  backgroundColor: 'var(--secondary-button-bg)',
  color: 'var(--secondary-button-text)',
  border: '1px solid var(--border-color)',
};

const disabledButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  backgroundColor: '#2A2D35',
  color: '#6A707C',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

const spinnerStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255, 255, 255, 0.2)',
    borderTopColor: 'var(--primary-color)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
};

const recipeContainerStyle: React.CSSProperties = {
  marginTop: '3rem',
  textAlign: 'left',
  backgroundColor: 'transparent',
  border: '1px solid var(--border-color)',
  padding: '2rem',
  borderRadius: '12px',
};

const editableRecipeStyle: React.CSSProperties = {
    width: '100%',
    height: '400px',
    border: '1px solid var(--border-color)',
    outline: 'none',
    backgroundColor: '#101216',
    resize: 'vertical',
    fontFamily: 'inherit',
    fontSize: '1rem',
    lineHeight: '1.7',
    color: 'var(--text-color)',
    padding: '1.5rem',
    borderRadius: '8px',
    boxSizing: 'border-box',
    marginTop: '1rem',
    transition: 'border-color 0.3s, box-shadow 0.3s',
};

const readOnlyRecipeStyle: React.CSSProperties = {
    ...editableRecipeStyle,
    backgroundColor: '#1F222A',
    borderColor: '#333742',
    cursor: 'default',
    color: '#B0B5C0',
    marginTop: 0,
};

const filenameInputContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
    marginTop: '1rem',
};

const filenameLabelStyle: React.CSSProperties = {
    fontWeight: 500,
    fontSize: '1rem',
    color: '#A0A5B0',
};

const filenameInputStyle: React.CSSProperties = {
    flexGrow: 1,
    padding: '0.6rem 0.8rem',
    fontSize: '1rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    backgroundColor: '#101216',
    color: 'var(--text-color)',
    transition: 'border-color 0.3s, box-shadow 0.3s',
};

const audioPlayerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: 'var(--secondary-button-bg)',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    marginTop: '1rem',
};

const topControlsContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
};

const langSelectorStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
};

const modelSelectorContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
};

const modelSelectStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: '#101216',
    color: 'var(--text-color)',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
};

const langButtonStyle: React.CSSProperties = {
    ...secondaryButtonStyle,
    padding: '0.5rem 1rem',
    border: '1px solid var(--border-color)',
    textTransform: 'none',
    letterSpacing: '0.5px',
};

const activeLangButtonStyle: React.CSSProperties = {
    ...langButtonStyle,
    backgroundColor: 'var(--primary-color)',
    color: '#121418',
    border: '1px solid var(--primary-color)',
};

const calculationContainerStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '1.5rem',
};

const servingsInputGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  marginBottom: '1rem',
};

const fontSizeControlContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginLeft: 'auto',
};

const fontSizeButtonStyle: React.CSSProperties = {
    ...secondaryButtonStyle,
    padding: 0,
    width: '36px',
    height: '36px',
    fontSize: '1.5rem',
    lineHeight: 1,
};

const imageContainerStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  overflow: 'hidden',
  marginBottom: '1.5rem',
  aspectRatio: '4 / 3',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#101216',
  border: '1px solid var(--border-color)',
};

const generatedImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const servingsUnitSelectStyle: React.CSSProperties = {
    padding: '0.6rem 0.8rem',
    fontSize: '1rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    backgroundColor: '#101216',
    color: 'var(--text-color)',
    transition: 'border-color 0.3s, box-shadow 0.3s',
    flexGrow: 0,
    width: 'auto',
};

// --- Chat Styles ---
const chatSectionContainerStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '1.5rem',
};

const chatHistoryStyle: React.CSSProperties = {
  height: '300px',
  overflowY: 'auto',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1rem',
  backgroundColor: '#101216',
};

const chatMessageStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
  padding: '0.5rem 1rem',
  borderRadius: '12px',
  maxWidth: '80%',
  wordWrap: 'break-word',
  lineHeight: '1.5',
};

const userMessageStyle: React.CSSProperties = {
  ...chatMessageStyle,
  backgroundColor: 'var(--primary-color)',
  color: '#121418',
  marginLeft: 'auto',
  borderBottomRightRadius: '2px',
};

const modelMessageStyle: React.CSSProperties = {
  ...chatMessageStyle,
  backgroundColor: 'var(--secondary-button-bg)',
  color: 'var(--text-color)',
  marginRight: 'auto',
  borderBottomLeftRadius: '2px',
};

const chatInputContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
};

const chatInputStyle: React.CSSProperties = {
    ...textareaStyle,
    minHeight: '50px',
    marginBottom: 0,
    flexGrow: 1,
    resize: 'none',
};


// --- Models ---
const TEXT_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro Preview' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite Preview' },
  { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
  { value: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const IMAGE_MODELS = [
  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (High Quality)' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3.0 Pro Image (Premium)' },
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Standard)' },
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0' },
  { value: 'gemini-flash-image-latest', label: 'Gemini Flash Image Latest' },
  { value: 'gemini-pro-image-latest', label: 'Gemini Pro Image Latest' },
];

// --- Main App Component ---

const App = () => {
  // --- API Key State ---
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [activeApiKey, setActiveApiKey] = useState('');

  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [textModel, setTextModel] = useState('gemini-3-flash-preview');
  const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
  const [prompt, setPrompt] = useState('');
  const [recipe, setRecipe] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [filename, setFilename] = useState('');
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Image generation state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Servings state
  const [servings, setServings] = useState('');
  const [recalculatedRecipe, setRecalculatedRecipe] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [servingsUnit, setServingsUnit] = useState<'serve' | 'part' | 'piece'>('serve');

  // Main Recipe Audio state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Recalculated Recipe Audio State
  const [recalculatedAudioBuffer, setRecalculatedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoadingRecalculatedTTS, setIsLoadingRecalculatedTTS] = useState(false);
  const [isRecalculatedPlaying, setIsRecalculatedPlaying] = useState(false);
  const [recalculatedCurrentTime, setRecalculatedCurrentTime] = useState(0);

  // Font size state
  const [fontSize, setFontSize] = useState(1); // 1rem is base
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const analyzeImageInputRef = useRef<HTMLInputElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);

  // Refs for Main Audio Player
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  
  // Refs for Recalculated Audio Player
  const recalculatedAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recalculatedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recalculatedStartTimeRef = useRef(0);
  const recalculatedStartOffsetRef = useRef(0);


  const t = translations[lang];
  const audioSampleRate = 24000;

  // --- API Key Methods ---
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKeyInput(storedKey);
      setActiveApiKey(storedKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    setActiveApiKey(key);
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      alert(t.apiKeySaved);
    } else {
      alert(t.apiKeyPleaseEnter);
    }
  };

  const handleCopyApiKey = () => {
    if (!apiKeyInput) return;
    navigator.clipboard.writeText(apiKeyInput);
    alert(t.apiKeyCopiedMsg);
  };

  const handleClearApiKey = () => {
    setApiKeyInput('');
    setActiveApiKey('');
    localStorage.removeItem('gemini_api_key');
  };
  // -------------------------

  const handleApiError = (error, context) => {
    console.error(`${context} Error:`, error);
    let errorMessage = error.message || `An unexpected error occurred during ${context}.`;

    // Check for specific rate limit / quota exhaustion messages
    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
      setError(t.rateLimitError);
    } else {
      // For other errors, try to parse JSON for a cleaner message, otherwise show the raw message
      try {
        const errorObj = JSON.parse(errorMessage);
        if (errorObj.error && errorObj.error.message) {
          setError(errorObj.error.message);
        } else {
          setError(errorMessage);
        }
      } catch (parseError) {
        // If it's not JSON, it's a plain string message
        setError(errorMessage);
      }
    }
  };

  useEffect(() => {
    // Auto-scroll chat to the bottom
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory, isChatLoading]);

  // Font size constants and handlers
  const MIN_FONT_SIZE = 0.8;
  const MAX_FONT_SIZE = 2.0;
  const FONT_SIZE_STEP = 0.1;

  const handleIncreaseFontSize = () => {
    setFontSize(prevSize => Math.min(MAX_FONT_SIZE, parseFloat((prevSize + FONT_SIZE_STEP).toFixed(2))));
  };

  const handleDecreaseFontSize = () => {
    setFontSize(prevSize => Math.max(MIN_FONT_SIZE, parseFloat((prevSize - FONT_SIZE_STEP).toFixed(2))));
  };


  // Initialize AudioContext on first interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext({ sampleRate: audioSampleRate });
    }
  };
  
  const sanitizeFilename = (name) => {
    if (!name) return '';
    return name.replace(/[\\/:*?"<>|]/g, '').trim();
  };

  const sanitizeForTTS = (text) => {
    if (!text) return '';
    // This sanitization is a final fallback. The primary sanitization is done by the model generating speechText.
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    return normalizedText.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s.,]/g, '');
  };

  const resetChat = () => {
    setChatHistory([]);
    setChatInput('');
    setIsChatLoading(false);
    chatRef.current = null;
  };

  // --- Main Audio Player Logic ---

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
  }, []);

  const handleStop = useCallback(() => {
      stopTimer();
      if (audioSourceRef.current) {
          audioSourceRef.current.onended = null;
          audioSourceRef.current.stop();
      }
      audioSourceRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      startOffsetRef.current = 0;
  }, [stopTimer]);
  
  const startTimer = useCallback(() => {
    stopTimer();
    if (!audioContextRef.current) return;
    startTimeRef.current = audioContextRef.current.currentTime;
    timerRef.current = setInterval(() => {
        if (!audioContextRef.current) return;
        const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
        const newTime = startOffsetRef.current + elapsedTime;
        setCurrentTime(newTime);
        if (audioBuffer && newTime >= audioBuffer.duration) {
            handleStop();
        }
    }, 100);
  }, [audioBuffer, stopTimer, handleStop]);


  const handlePlayPause = useCallback((bufferToPlay?: AudioBuffer) => {
    initAudioContext();
    const currentBuffer = bufferToPlay || audioBuffer;

    if (isPlaying) { // Pause
        stopTimer();
        startOffsetRef.current = currentTime;
        audioSourceRef.current?.stop();
        setIsPlaying(false);
    } else { // Play
        if (!currentBuffer || !audioContextRef.current) return;
        
        if (audioSourceRef.current) {
            audioSourceRef.current.onended = null;
            audioSourceRef.current.stop();
        }

        const source = audioContextRef.current.createBufferSource();
        source.buffer = currentBuffer;
        source.connect(audioContextRef.current.destination);
        
        const offset = startOffsetRef.current % currentBuffer.duration;
        source.start(0, offset);
        audioSourceRef.current = source;
        startTimer();
        setIsPlaying(true);

        source.onended = () => {
            if (audioContextRef.current && startOffsetRef.current + (audioContextRef.current.currentTime - startTimeRef.current) >= currentBuffer.duration - 0.1) {
                handleStop();
            }
        };
    }
  }, [isPlaying, audioBuffer, currentTime, startTimer, stopTimer, handleStop]);


  const handleStopAndClear = useCallback(() => {
    handleStop();
    setAudioBuffer(null);
  }, [handleStop]);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioBuffer) return;
      const newTime = parseFloat(event.target.value);
      
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        handlePlayPause();
      }

      startOffsetRef.current = newTime;
      setCurrentTime(newTime);
      
      if (wasPlaying) {
          setTimeout(() => handlePlayPause(), 0);
      }
  };

  // --- Recalculated Audio Player Logic ---

  const stopRecalculatedTimer = useCallback(() => {
    if (recalculatedTimerRef.current) {
      clearInterval(recalculatedTimerRef.current);
      recalculatedTimerRef.current = null;
    }
  }, []);

  const handleRecalculatedStop = useCallback(() => {
    stopRecalculatedTimer();
    if (recalculatedAudioSourceRef.current) {
      recalculatedAudioSourceRef.current.onended = null;
      recalculatedAudioSourceRef.current.stop();
    }
    recalculatedAudioSourceRef.current = null;
    setIsRecalculatedPlaying(false);
    setRecalculatedCurrentTime(0);
    recalculatedStartOffsetRef.current = 0;
  }, [stopRecalculatedTimer]);

  const startRecalculatedTimer = useCallback(() => {
    stopRecalculatedTimer();
    if (!audioContextRef.current) return;
    recalculatedStartTimeRef.current = audioContextRef.current.currentTime;
    recalculatedTimerRef.current = setInterval(() => {
      if (!audioContextRef.current) return;
      const elapsedTime = audioContextRef.current.currentTime - recalculatedStartTimeRef.current;
      const newTime = recalculatedStartOffsetRef.current + elapsedTime;
      setRecalculatedCurrentTime(newTime);
      if (recalculatedAudioBuffer && newTime >= recalculatedAudioBuffer.duration) {
        handleRecalculatedStop();
      }
    }, 100);
  }, [recalculatedAudioBuffer, stopRecalculatedTimer, handleRecalculatedStop]);

  const handleRecalculatedPlayPause = useCallback((bufferToPlay?: AudioBuffer) => {
    initAudioContext();
    const currentBuffer = bufferToPlay || recalculatedAudioBuffer;

    if (isRecalculatedPlaying) { // Pause
      stopRecalculatedTimer();
      recalculatedStartOffsetRef.current = recalculatedCurrentTime;
      recalculatedAudioSourceRef.current?.stop();
      setIsRecalculatedPlaying(false);
    } else { // Play
      if (!currentBuffer || !audioContextRef.current) return;

      if (recalculatedAudioSourceRef.current) {
        recalculatedAudioSourceRef.current.onended = null;
        recalculatedAudioSourceRef.current.stop();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = currentBuffer;
      source.connect(audioContextRef.current.destination);

      const offset = recalculatedStartOffsetRef.current % currentBuffer.duration;
      source.start(0, offset);
      recalculatedAudioSourceRef.current = source;
      startRecalculatedTimer();
      setIsRecalculatedPlaying(true);

      source.onended = () => {
        if (audioContextRef.current && recalculatedStartOffsetRef.current + (audioContextRef.current.currentTime - recalculatedStartTimeRef.current) >= currentBuffer.duration - 0.1) {
          handleRecalculatedStop();
        }
      };
    }
  }, [isRecalculatedPlaying, recalculatedAudioBuffer, recalculatedCurrentTime, startRecalculatedTimer, stopRecalculatedTimer, handleRecalculatedStop]);

  const handleRecalculatedSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!recalculatedAudioBuffer) return;
    const newTime = parseFloat(event.target.value);
    
    const wasPlaying = isRecalculatedPlaying;
    if (wasPlaying) {
      handleRecalculatedPlayPause();
    }

    recalculatedStartOffsetRef.current = newTime;
    setRecalculatedCurrentTime(newTime);
    
    if (wasPlaying) {
        setTimeout(() => handleRecalculatedPlayPause(), 0);
    }
  };


  // --- Core API Functions ---

  const handleGenerateRecipe = async () => {
    if (!prompt.trim()) return;
    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      return;
    }

    setIsLoadingRecipe(true);
    setError(null);
    setRecipe('');
    setSpeechText('');
    setFilename('');
    setRecalculatedRecipe('');
    setServings('');
    setGeneratedImage(null);
    handleStopAndClear();
    setRecalculatedAudioBuffer(null);
    resetChat();

    const fullPrompt = lang === 'th'
      ? `สร้างสูตรทำอาหารสำหรับ "${prompt}" โดยต้องระบุจำนวนที่เสิร์ฟ (serving size) อย่างชัดเจนในสูตรเสมอ เช่น "สำหรับ 2 ที่ (serve)". จากนั้นแย่งเนื้อหาเป็น 2 ส่วน: ส่วนหนึ่งสำหรับแสดงผลที่จัดรูปแบบสวยงาม และอีกส่วนเป็นข้อความธรรมดาสำหรับโปรแกรมอ่านออกเสียงซึ่งต้องแปลงสัญลักษณ์เป็นคำพูด`
      : `Generate a recipe for "${prompt}". You must clearly state the serving size in the recipe, for example, "Serves 2". Provide two versions of the content: one nicely formatted for display, and another as plain text for a text-to-speech engine where symbols are written out as words.`;

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const result = await ai.models.generateContent({
        model: textModel,
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    displayText: {
                        type: Type.STRING,
                        description: 'Recipe formatted with markdown for beautiful display.'
                    },
                    speechText: {
                        type: Type.STRING,
                        description: 'The same recipe as plain text, with symbols (like °C) written out as words (like degrees Celsius). Optimized for text-to-speech.'
                    }
                },
                required: ['displayText', 'speechText']
            }
        },
      });
      
      let jsonText = result.text.trim();
      const match = jsonText.match(/^```json\s*([\s\S]*?)\s*```$/);
      if (match) {
          jsonText = match[1];
      }
      
      const responseJson = JSON.parse(jsonText);
      const displayText = responseJson.displayText || '';
      const firstLine = displayText.split('\n')[0].replace(/#/g, '').trim();
      setRecipe(displayText);
      setSpeechText(responseJson.speechText || '');
      setFilename(sanitizeFilename(firstLine));
    } catch (e) {
      handleApiError(e, 'Recipe Generation');
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!filename) return;
    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      return;
    }

    setIsGeneratingImage(true);
    setError(null);
    setGeneratedImage(null);

    const imagePrompt = lang === 'th'
      ? `ภาพถ่าย "${filename}" สไตล์ภาพถ่ายอาหารมืออาชีพ, น่ารับประทาน, แสงสว่างสดใส, จัดวางสวยงาม`
      : `A delicious, mouth-watering, high-quality photograph of "${filename}". Professional food photography, bright lighting, appetizing.`;

    try {
        const ai = new GoogleGenAI({ apiKey: activeApiKey });
        const response = await ai.models.generateContent({
            model: imageModel,
            contents: {
                parts: [
                    {
                        text: imagePrompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let foundImage = false;
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
              if (part.inlineData) {
                  const base64ImageBytes: string = part.inlineData.data;
                  const mimeType = part.inlineData.mimeType;
                  const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
                  setGeneratedImage(imageUrl);
                  foundImage = true;
                  break; // Exit after finding the first image
              }
          }
        }
        
        if (!foundImage) {
            throw new Error("No image data received from API.");
        }

    } catch (e) {
        handleApiError(e, 'Image Generation');
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const handleRecalculateRecipe = async () => {
    if (!recipe || !servings || parseInt(servings, 10) <= 0) return;
    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      return;
    }

    setIsRecalculating(true);
    setError(null);
    setRecalculatedRecipe('');
    handleRecalculatedStop();
    setRecalculatedAudioBuffer(null);

    const unitMap = {
        serve: t.unit_serve,
        part: t.unit_part,
        piece: t.unit_piece,
    };
    const unitText = unitMap[servingsUnit];

    const prompt = lang === 'th'
        ? `นี่คือสูตรอาหารต้นฉบับ:\n\n${recipe}\n\nสูตรนี้อาจระบุจำนวนที่ทำได้ในหน่วยต่างๆ (เช่น "1 ส่วน" หรือ "20 ชิ้น") ภารกิจของคุณคือปรับสูตรนี้ให้ได้ผลลัพธ์เป็น **${servings} ${unitText}**.\n\n**คำแนะนำ:**\n1. อ่านสูตรต้นฉบับเพื่อทำความเข้าใจว่าเดิมทำได้เท่าไหร่.\n2. คำนวณสัดส่วนที่ต้องใช้เพื่อเปลี่ยนจากจำนวนเดิมไปเป็น **${servings} ${unitText}**.\n3. **ปรับแก้เฉพาะปริมาณส่วนผสมเท่านั้น** ตามสัดส่วนที่คำนวณได้.\n4. อัปเดตข้อความบอกจำนวนที่ทำได้ในสูตรให้เป็น **"สำหรับ ${servings} ${unitText}"** อย่างชัดเจน.\n\nห้ามแก้ไขขั้นตอนการทำหรือข้อความส่วนอื่นเด็ดขาด.`
        : `Here is the original recipe:\n\n${recipe}\n\nThis recipe might state its yield in different units (e.g., "1 part" or "20 pieces"). Your task is to adjust this recipe to yield **${servings} ${unitText}**.\n\n**Instructions:**\n1. Read the original recipe to understand its original yield.\n2. Calculate the scaling factor required to go from the original yield to the new target of **${servings} ${unitText}**.\n3. **Adjust only the ingredient quantities** based on this scaling factor.\n4. Update the serving size text in the recipe to clearly state **"Makes ${servings} ${unitText}"**.\n\nDo not change the instructions or any other text.`;

    try {
        const ai = new GoogleGenAI({ apiKey: activeApiKey });
        const result = await ai.models.generateContent({
            model: textModel,
            contents: prompt,
        });
        setRecalculatedRecipe(result.text);
    } catch (e) {
        handleApiError(e, 'Recipe Recalculation');
    } finally {
        setIsRecalculating(false);
    }
  };


  const handleGenerateTTS = async () => {
      if (isPlaying) handleStop();
      if (!activeApiKey) {
        setError(t.apiKeyRequired);
        return;
      }

      setIsLoadingTTS(true);
      setError(null);
      setAudioBuffer(null);
      
      const textToSpeak = sanitizeForTTS(speechText);

      if (!textToSpeak || !textToSpeak.trim()) {
        setError("No text available to speak or text was invalid after sanitization.");
        setIsLoadingTTS(false);
        return;
      }
      
      initAudioContext();
      
      try {
          const ai = new GoogleGenAI({ apiKey: activeApiKey });
          const response = await ai.models.generateContent({
              model: "gemini-2.5-flash-preview-tts",
              contents: [{ parts: [{ text: textToSpeak }] }],
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                      },
                  },
              },
          });
          const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio && audioContextRef.current) {
              const audioBytes = decode(base64Audio);
              const buffer = await decodeAudioData(audioBytes, audioContextRef.current, audioSampleRate, 1);
              setAudioBuffer(buffer);
              handlePlayPause(buffer);
          } else {
              throw new Error("No audio data received from API.");
          }
      } catch (e) {
          handleApiError(e, 'TTS Generation');
      } finally {
          setIsLoadingTTS(false);
      }
  };

  const handleGenerateRecalculatedTTS = async () => {
    if (isRecalculatedPlaying) handleRecalculatedStop();
    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      return;
    }

    setIsLoadingRecalculatedTTS(true);
    setError(null);
    setRecalculatedAudioBuffer(null);

    const textToSpeak = sanitizeForTTS(recalculatedRecipe);

    if (!textToSpeak || !textToSpeak.trim()) {
      setError("No recalculated text available to speak or text was invalid after sanitization.");
      setIsLoadingRecalculatedTTS(false);
      return;
    }

    initAudioContext();

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio && audioContextRef.current) {
        const audioBytes = decode(base64Audio);
        const buffer = await decodeAudioData(audioBytes, audioContextRef.current, audioSampleRate, 1);
        setRecalculatedAudioBuffer(buffer);
        handleRecalculatedPlayPause(buffer);
      } else {
        throw new Error("No audio data received from API for recalculated recipe.");
      }
    } catch (e) {
      handleApiError(e, 'Recalculated TTS Generation');
    } finally {
      setIsLoadingRecalculatedTTS(false);
    }
  };
  
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      return;
    }

    setIsChatLoading(true);
    const currentChatInput = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: currentChatInput }]);

    try {
        let chatSession = chatRef.current;
        if (!chatSession) {
            const ai = new GoogleGenAI({ apiKey: activeApiKey });
            chatSession = ai.chats.create({
                model: textModel,
                config: {
                    systemInstruction: lang === 'th'
                        ? `คุณคือผู้ช่วยที่เป็นมิตร ตอบคำถามเกี่ยวกับสูตรอาหารต่อไปนี้เท่านั้น:\n\n${recipe}\n\nพยายามตอบให้กระชับและตรงประเด็น`
                        : `You are a friendly assistant who only answers questions about the following recipe:\n\n${recipe}\n\nKeep your answers concise and to the point.`
                }
            });
            chatRef.current = chatSession;
        }

        const response = await chatSession.sendMessage({ message: currentChatInput });
        setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);

    } catch (e) {
        handleApiError(e, 'Chat Response');
        setChatHistory(prev => prev.slice(0, -1)); // Remove user message on failure
    } finally {
        setIsChatLoading(false);
    }
  };

  // --- Utility & File Handling ---

  const handleCopy = () => {
      if (!recipe) return;
      navigator.clipboard.writeText(recipe);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveTXT = () => {
    if (!recipe) return;

    const downloadFilename = `${filename || 'recipe'}.txt`;

    const blob = new Blob([recipe], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleOpenFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setRecipe(text);
        setSpeechText(sanitizeForTTS(text));
        setPrompt('');
        setError(null);
        handleStopAndClear();
        setRecalculatedRecipe('');
        setServings('');
        setRecalculatedAudioBuffer(null);
        setGeneratedImage(null);
        resetChat();
        const rawFilename = file.name.replace(/\.[^/.]+$/, "");
        setFilename(sanitizeFilename(rawFilename));
      }
    };
    reader.onerror = (e) => {
        console.error("File reading error:", e);
        setError("Failed to read the selected file.");
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  const handleOcrFileClick = () => {
    ocrInputRef.current?.click();
  };

  const handleOcrFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      event.target.value = '';
      return;
    }

    setIsExtractingText(true);
    setError(null);
    resetChat();

    try {
        const ai = new GoogleGenAI({ apiKey: activeApiKey });
        const textPrompt = { text: "Extract all text from this image as plain text." };
        
        let allExtractedText = '';
        for (const file of files) {
            const base64Data = await fileToBase64(file);
            const imagePart = {
                inlineData: {
                    mimeType: file.type,
                    data: base64Data,
                },
            };

            const result = await ai.models.generateContent({
                model: textModel,
                contents: [{ parts: [textPrompt, imagePart] }],
            });

            allExtractedText += result.text + '\n\n';
        }
        
        setRecipe(prevRecipe => prevRecipe ? `${prevRecipe}\n\n${allExtractedText.trim()}` : allExtractedText.trim());
        setSpeechText(prevSpeech => prevSpeech ? `${prevSpeech}\n\n${sanitizeForTTS(allExtractedText)}` : sanitizeForTTS(allExtractedText));
        
    } catch (e) {
        handleApiError(e, 'Text Extraction from Image');
    } finally {
        setIsExtractingText(false);
    }

    event.target.value = '';
  };

  const handleAnalyzeImageClick = () => {
    analyzeImageInputRef.current?.click();
  };

  const handleAnalyzeImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!activeApiKey) {
      setError(t.apiKeyRequired);
      event.target.value = '';
      return;
    }

    setIsAnalyzingImage(true);
    setError(null);
    setRecipe('');
    setSpeechText('');
    setFilename('');
    setRecalculatedRecipe('');
    setServings('');
    setGeneratedImage(null);
    handleStopAndClear();
    setRecalculatedAudioBuffer(null);
    resetChat();
    setPrompt('');

    const fullPrompt = lang === 'th'
      ? `วิเคราะห์ภาพอาหารนี้ บอกว่าคืออะไร และสร้างสูตรอาหารสำหรับทำอาหารจานนี้ โดยต้องระบุจำนวนที่เสิร์ฟ (serving size) อย่างชัดเจนในสูตรเสมอ เช่น "สำหรับ 2 ที่ (serve)". จากนั้นแย่งเนื้อหาเป็น 2 ส่วน: ส่วนหนึ่งสำหรับแสดงผลที่จัดรูปแบบสวยงาม และอีกส่วนเป็นข้อความธรรมดาสำหรับโปรแกรมอ่านออกเสียงซึ่งต้องแปลงสัญลักษณ์เป็นคำพูด`
      : `Analyze this image of food. Identify what it is and generate a recipe to make it. You must clearly state the serving size in the recipe, for example, "Serves 2". Provide two versions of the content: one nicely formatted for display, and another as plain text for a text-to-speech engine where symbols are written out as words.`;
    
    try {
      const base64Data = await fileToBase64(file);
      const imagePart = {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      };
      const textPart = { text: fullPrompt };

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const result = await ai.models.generateContent({
        model: textModel,
        contents: [{ parts: [textPart, imagePart] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              displayText: {
                type: Type.STRING,
                description: 'Recipe formatted with markdown for beautiful display.'
              },
              speechText: {
                type: Type.STRING,
                description: 'The same recipe as plain text, with symbols (like °C) written out as words (like degrees Celsius). Optimized for text-to-speech.'
              }
            },
            required: ['displayText', 'speechText']
          }
        },
      });
    
      let jsonText = result.text.trim();
      const match = jsonText.match(/^```json\s*([\s\S]*?)\s*```$/);
      if (match) {
          jsonText = match[1];
      }
      
      const responseJson = JSON.parse(jsonText);
      const displayText = responseJson.displayText || '';
      const firstLine = displayText.split('\n')[0].replace(/#/g, '').trim();
      setRecipe(displayText);
      setSpeechText(responseJson.speechText || '');
      setFilename(sanitizeFilename(firstLine));
    } catch (e) {
      handleApiError(e, 'Image Analysis');
    } finally {
      setIsAnalyzingImage(false);
    }

    if (event.target) {
      event.target.value = '';
    }
  };
  
  const handleRecipeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRecipe(newText);
    setSpeechText(sanitizeForTTS(newText));
    resetChat(); // Reset chat if recipe is manually edited
  };


  const duration = audioBuffer?.duration ?? 0;
  const recalculatedDuration = recalculatedAudioBuffer?.duration ?? 0;
  const isExpanded = !!(isLoadingRecipe || recipe);

  const dynamicAppContainerStyle: React.CSSProperties = {
    ...appContainerStyle,
    maxWidth: isExpanded ? '100%' : '800px',
  };
  
  const dynamicEditableRecipeStyle: React.CSSProperties = {
    ...editableRecipeStyle,
    fontSize: `${fontSize}rem`,
  };

  const dynamicReadOnlyRecipeStyle: React.CSSProperties = {
    ...readOnlyRecipeStyle,
    fontSize: `${fontSize}rem`,
  };
  
  const anyLoading = isLoadingRecipe || isExtractingText || isAnalyzingImage;

  return (
    <div style={dynamicAppContainerStyle}>
      {/* API Key Section (New) */}
      <div style={apiKeyContainerStyle}>
        <label htmlFor="apiKey" style={{ fontWeight: 500, color: '#A0A5B0', whiteSpace: 'nowrap' }}>
          Google AI Studio API Key:
        </label>
        <input
          id="apiKey"
          type="text"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder={t.noApiKey}
          style={apiKeyInputStyle}
        />
        <button onClick={handleSaveApiKey} style={primaryButtonStyle}>{t.send}</button>
        <button onClick={handleCopyApiKey} style={secondaryButtonStyle} disabled={!apiKeyInput}>{t.copy}</button>
        <button onClick={handleClearApiKey} style={secondaryButtonStyle}>{t.clear}</button>
      </div>

      <h1 style={titleStyle}>{t.title}</h1>
      <p style={descriptionStyle}>{t.description}</p>
      
      <div style={topControlsContainerStyle}>
        <div style={langSelectorStyle}>
          <button onClick={() => setLang('th')} style={lang === 'th' ? activeLangButtonStyle : langButtonStyle}>{t.langThai}</button>
          <button onClick={() => setLang('en')} style={lang === 'en' ? activeLangButtonStyle : langButtonStyle}>{t.langEnglish}</button>
        </div>
        <div style={modelSelectorContainerStyle}>
          <label htmlFor="textModelSelect" style={{ fontSize: '0.9rem', color: '#A0A5B0' }}>{t.textModelLabel}</label>
          <select 
            id="textModelSelect"
            value={textModel} 
            onChange={(e) => setTextModel(e.target.value)}
            style={modelSelectStyle}
            disabled={anyLoading}
          >
            {TEXT_MODELS.map(model => (
              <option key={model.value} value={model.value}>{model.label}</option>
            ))}
          </select>
        </div>
        <div style={modelSelectorContainerStyle}>
          <label htmlFor="imageModelSelect" style={{ fontSize: '0.9rem', color: '#A0A5B0' }}>{t.imageModelLabel}</label>
          <select 
            id="imageModelSelect"
            value={imageModel} 
            onChange={(e) => setImageModel(e.target.value)}
            style={modelSelectStyle}
            disabled={anyLoading}
          >
            {IMAGE_MODELS.map(model => (
              <option key={model.value} value={model.value}>{model.label}</option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t.placeholder}
        style={textareaStyle}
        disabled={anyLoading}
      />
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleOpenFileSelected}
        accept=".txt"
        style={{ display: 'none' }}
      />
      
      <input
        type="file"
        ref={ocrInputRef}
        onChange={handleOcrFileSelected}
        accept="image/*"
        multiple
        style={{ display: 'none' }}
      />

      <input
        type="file"
        ref={analyzeImageInputRef}
        onChange={handleAnalyzeImageSelected}
        accept="image/*"
        style={{ display: 'none' }}
      />
      
      <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap'}}>
        <button
          onClick={handleGenerateRecipe}
          disabled={anyLoading || !prompt.trim()}
          style={(anyLoading || !prompt.trim()) ? disabledButtonStyle : primaryButtonStyle}
        >
          {isLoadingRecipe && <div style={spinnerStyle}></div>}
          {isLoadingRecipe ? t.generating : t.generate}
        </button>
        <button onClick={handleOpenFileClick} disabled={anyLoading} style={secondaryButtonStyle}>
            {t.openFile}
        </button>
        <button
          onClick={handleAnalyzeImageClick}
          disabled={anyLoading}
          style={secondaryButtonStyle}
        >
          {isAnalyzingImage && <div style={{...spinnerStyle, borderTopColor: 'var(--primary-color)'}}></div>}
          {isAnalyzingImage ? t.analyzing : t.analyzeImage}
        </button>
        <button
          onClick={handleOcrFileClick}
          disabled={anyLoading}
          style={secondaryButtonStyle}
        >
          {isExtractingText && <div style={{...spinnerStyle, borderTopColor: 'var(--primary-color)'}}></div>}
          {isExtractingText ? t.extractingText : t.extractTextFromImage}
        </button>
      </div>

      {error && <div style={{ color: '#ff8a80', marginTop: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{t.error} {error}</div>}
      
      {recipe && (
        <div style={recipeContainerStyle}>
          
          {(generatedImage || isGeneratingImage) && (
            <div style={imageContainerStyle}>
                {isGeneratingImage ? (
                    <div>
                        <div style={{...spinnerStyle, margin: '0 auto 1rem auto', borderTopColor: 'var(--primary-color)'}}></div>
                        {t.generatingImage}
                    </div>
                ) : (
                    <img src={generatedImage} alt={filename} style={generatedImageStyle} />
                )}
            </div>
          )}
          
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            alignItems: 'center', 
            flexWrap: 'wrap',
            paddingBottom: '1rem',
          }}>
            {!audioBuffer && (
              <button
                onClick={handleGenerateTTS}
                disabled={isLoadingTTS || !speechText}
                style={isLoadingTTS || !speechText ? disabledButtonStyle : secondaryButtonStyle}
              >
                  {isLoadingTTS && <div style={{...spinnerStyle, borderTopColor: 'var(--primary-color)'}}></div>}
                  {isLoadingTTS ? t.loadingAudio : t.readAloud}
              </button>
            )}

            <button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || !filename}
                style={isGeneratingImage || !filename ? disabledButtonStyle : secondaryButtonStyle}
            >
                {isGeneratingImage && <div style={{...spinnerStyle, borderTopColor: 'var(--primary-color)'}}></div>}
                {isGeneratingImage ? t.generatingImage : t.generateImage}
            </button>

            <button onClick={handleCopy} style={secondaryButtonStyle}>
                {isCopied ? t.copied : t.copy}
            </button>
            <button onClick={handleSaveTXT} style={secondaryButtonStyle}>
                {t.saveTxt}
            </button>
             <div style={fontSizeControlContainerStyle}>
              <button 
                onClick={handleDecreaseFontSize} 
                disabled={fontSize <= MIN_FONT_SIZE} 
                style={{...fontSizeButtonStyle, ...(fontSize <= MIN_FONT_SIZE && {cursor: 'not-allowed', opacity: 0.5})}}
                aria-label={t.decreaseFontSize}
              >
                -
              </button>
              <span style={{ minWidth: '45px', textAlign: 'center', fontWeight: 500, color: '#A0A5B0' }}>
                {`${Math.round(fontSize * 100)}%`}
              </span>
              <button 
                onClick={handleIncreaseFontSize} 
                disabled={fontSize >= MAX_FONT_SIZE} 
                style={{...fontSizeButtonStyle, ...(fontSize >= MAX_FONT_SIZE && {cursor: 'not-allowed', opacity: 0.5})}}
                aria-label={t.increaseFontSize}
              >
                +
              </button>
            </div>
          </div>
          
          {audioBuffer && (
             <div style={audioPlayerStyle}>
                <button onClick={() => handlePlayPause()} style={secondaryButtonStyle}>{isPlaying ? '❚❚' : '▶'}</button>
                <button onClick={handleStop} style={secondaryButtonStyle}>■</button>
                <div style={{flexGrow: 1, display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                    <span style={{fontSize: '0.85rem', minWidth: '80px', textAlign: 'center'}}>
                      {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(duration * 1000).toISOString().substr(14, 5)}
                    </span>
                    <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={handleSeek}
                        style={{flexGrow: 1}}
                    />
                </div>
            </div>
          )}

          <div style={filenameInputContainerStyle}>
            <label htmlFor="filename" style={filenameLabelStyle}>{t.filenameLabel}:</label>
            <input
              id="filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              style={filenameInputStyle}
            />
          </div>

          <textarea
            value={recipe}
            onChange={handleRecipeChange}
            style={dynamicEditableRecipeStyle}
          />

          <div style={calculationContainerStyle}>
            <div style={servingsInputGroupStyle}>
                <label htmlFor="servings" style={filenameLabelStyle}>{t.servingsLabel}:</label>
                <input
                  id="servings"
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  style={{...filenameInputStyle, flexGrow: 0, width: '100px'}}
                  placeholder="e.g., 4"
                />
                <select
                    value={servingsUnit}
                    onChange={(e) => setServingsUnit(e.target.value as 'serve' | 'part' | 'piece')}
                    style={servingsUnitSelectStyle}
                >
                    <option value="serve">{t.unit_serve}</option>
                    <option value="part">{t.unit_part}</option>
                    <option value="piece">{t.unit_piece}</option>
                </select>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                  onClick={handleRecalculateRecipe}
                  disabled={isRecalculating || !servings || parseInt(servings, 10) <= 0}
                  style={(isRecalculating || !servings || parseInt(servings, 10) <= 0) ? disabledButtonStyle : primaryButtonStyle}
              >
                  {isRecalculating && <div style={spinnerStyle}></div>}
                  {isRecalculating ? t.calculating : t.calculate}
              </button>
            </div>

            {recalculatedRecipe && (
              <div style={{ marginTop: '1rem' }}>
                <textarea
                  readOnly
                  value={recalculatedRecipe}
                  style={dynamicReadOnlyRecipeStyle}
                />
                 {!recalculatedAudioBuffer && (
                    <button
                        onClick={handleGenerateRecalculatedTTS}
                        disabled={isLoadingRecalculatedTTS}
                        style={{
                            ...(isLoadingRecalculatedTTS ? disabledButtonStyle : secondaryButtonStyle),
                            marginTop: '1rem'
                        }}
                    >
                        {isLoadingRecalculatedTTS && <div style={{...spinnerStyle, borderTopColor: 'var(--primary-color)'}}></div>}
                        {isLoadingRecalculatedTTS ? t.loadingAudio : t.readAloud}
                    </button>
                 )}
                 {recalculatedAudioBuffer && (
                    <div style={audioPlayerStyle}>
                        <button onClick={() => handleRecalculatedPlayPause()} style={secondaryButtonStyle}>{isRecalculatedPlaying ? '❚❚' : '▶'}</button>
                        <button onClick={handleRecalculatedStop} style={secondaryButtonStyle}>■</button>
                        <div style={{flexGrow: 1, display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                            <span style={{fontSize: '0.85rem', minWidth: '80px', textAlign: 'center'}}>
                              {new Date(recalculatedCurrentTime * 1000).toISOString().substr(14, 5)} / {new Date(recalculatedDuration * 1000).toISOString().substr(14, 5)}
                            </span>
                            <input
                                type="range"
                                min="0"
                                max={recalculatedDuration}
                                value={recalculatedCurrentTime}
                                onChange={handleRecalculatedSeek}
                                style={{flexGrow: 1}}
                            />
                        </div>
                    </div>
                  )}
              </div>
            )}
          </div>
          
          <div style={chatSectionContainerStyle}>
            <h3 style={{...titleStyle, fontSize: '1.75rem', marginBottom: '1rem'}}>{t.askQuestion}</h3>
            <div style={chatHistoryStyle} ref={chatHistoryRef}>
                {chatHistory.map((msg, index) => (
                    <div key={index} style={msg.role === 'user' ? userMessageStyle : modelMessageStyle}>
                        <strong style={{display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem'}}>{msg.role === 'user' ? t.you : t.ai}</strong>
                        {msg.text}
                    </div>
                ))}
                {isChatLoading && (
                    <div style={modelMessageStyle}>
                        <strong style={{display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem'}}>{t.ai}</strong>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                            <div style={{...spinnerStyle, width: '16px', height: '16px', borderTopColor: '#aaa' }}></div>
                            <span>{t.aiTyping}</span>
                        </div>
                    </div>
                )}
            </div>
            <div style={chatInputContainerStyle}>
                <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChatMessage();
                        }
                    }}
                    placeholder={t.chatPlaceholder}
                    style={chatInputStyle}
                    disabled={isChatLoading}
                />
                <button
                    onClick={handleSendChatMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                    style={{...(isChatLoading || !chatInput.trim() ? disabledButtonStyle : primaryButtonStyle), minHeight: '50px'}}
                >
                    {t.send}
                </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);