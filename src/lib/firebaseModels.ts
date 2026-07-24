import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

export const firebaseConfig = {
  projectId: "gen-lang-client-0014422363",
  appId: "1:978227936883:web:946402bf6886970bc77406",
  apiKey: "AIzaSyAJLNrYkuTt16qs034UlkEBJrMvlrNCnA4",
  authDomain: "gen-lang-client-0014422363.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-29f335c3-c8ac-451f-97d7-9c310736d1d9",
  storageBucket: "gen-lang-client-0014422363.firebasestorage.app",
  messagingSenderId: "978227936883",
  measurementId: ""
};

export interface AIModelOption {
  value: string; // modelId
  label: string; // name
  category: string;
  order: number;
  isActive: boolean;
  isDefaultLevel1: boolean;
  isDefaultLevel2: boolean;
}

export const FALLBACK_TEXT_MODELS: AIModelOption[] = [
  { value: 'gemini-3.6-flash', label: '(20)Gemini 3.6 Flash', category: 'text_reasoning', order: 1, isActive: true, isDefaultLevel1: true, isDefaultLevel2: false },
  { value: 'gemini-3.5-flash', label: '(20)Gemini 3.5 Flash', category: 'text_reasoning', order: 2, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
  { value: 'gemini-3-flash-preview', label: '(20)Gemini 3 Flash Preview', category: 'text_reasoning', order: 3, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
  { value: 'gemini-3.5-flash-lite', label: '(500)Gemini 3.5 Flash Lite', category: 'text_reasoning', order: 4, isActive: true, isDefaultLevel1: false, isDefaultLevel2: true },
  { value: 'gemini-3.1-flash-lite', label: '(500)Gemini 3.1 Flash Lite', category: 'text_reasoning', order: 5, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
  { value: 'gemini-3.1-pro-preview', label: '(0)Gemini 3.1 Pro Preview', category: 'text_reasoning', order: 7, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
  { value: 'gemini-flash-latest', label: 'Gemini Flash Latest', category: 'text_reasoning', order: 8, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
];

export const FALLBACK_IMAGE_MODELS: AIModelOption[] = [
  { value: 'gemini-3-pro-image', label: 'Nano Banana Pro (Gemini 3 Pro Image)', category: 'image_gen', order: 1, isActive: true, isDefaultLevel1: true, isDefaultLevel2: false },
  { value: 'gemini-3.1-flash-image', label: 'Nano Banana 2 (Gemini 3.1 Flash Image)', category: 'image_gen', order: 2, isActive: true, isDefaultLevel1: false, isDefaultLevel2: true },
  { value: 'gemini-2.5-flash-image', label: 'gemini-2.5-flash-image', category: 'image_gen', order: 6, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
  { value: 'gemini-flash-image-latest', label: 'Gemini Flash Image Latest', category: 'image_gen', order: 7, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
];

export const FALLBACK_TTS_MODELS: AIModelOption[] = [
  { value: 'gemini-3.1-flash-tts-preview', label: '(10)Gemini 3.1 Flash TTS', category: 'tts', order: 1, isActive: true, isDefaultLevel1: true, isDefaultLevel2: false },
  { value: 'gemini-2.5-flash-preview-tts', label: '(10)Gemini 2.5 Flash TTS', category: 'tts', order: 2, isActive: true, isDefaultLevel1: false, isDefaultLevel2: true },
  { value: 'gemini-2.5-pro-preview-tts', label: '(0)Gemini 2.5 Pro TTS', category: 'tts', order: 4, isActive: true, isDefaultLevel1: false, isDefaultLevel2: false },
];

let firestoreDb: ReturnType<typeof getFirestore> | null = null;

function getDb() {
  if (!firestoreDb) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  return firestoreDb;
}

export async function fetchCentralizedAIModels(): Promise<{
  textModels: AIModelOption[];
  imageModels: AIModelOption[];
  ttsModels: AIModelOption[];
  defaultTextModel: string;
  defaultImageModel: string;
  defaultTtsModel: string;
}> {
  try {
    const db = getDb();
    const modelsRef = collection(db, "ai_models");
    const q = query(modelsRef, where("isActive", "==", true));
    const snapshot = await getDocs(q);

    const textList: AIModelOption[] = [];
    const imageList: AIModelOption[] = [];
    const ttsList: AIModelOption[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const modelId = data.modelId || doc.id;
      const name = data.name || modelId;
      const category = (data.category || '').toLowerCase();
      const order = typeof data.order === 'number' ? data.order : 999;
      const isActive = data.isActive === true;
      const isDefaultLevel1 = data.isDefaultLevel1 === true;
      const isDefaultLevel2 = data.isDefaultLevel2 === true;

      const item: AIModelOption = {
        value: modelId,
        label: name,
        category,
        order,
        isActive,
        isDefaultLevel1,
        isDefaultLevel2,
      };

      if (category === 'text_reasoning' || category === 'text') {
        textList.push(item);
      } else if (category === 'image_gen' || category === 'image') {
        imageList.push(item);
      } else if (category === 'tts' || category === 'audio' || category === 'speech') {
        ttsList.push(item);
      }
    });

    const sortFn = (a: AIModelOption, b: AIModelOption) => a.order - b.order;
    textList.sort(sortFn);
    imageList.sort(sortFn);
    ttsList.sort(sortFn);

    const textResult = textList.length > 0 ? textList : FALLBACK_TEXT_MODELS;
    const imageResult = imageList.length > 0 ? imageList : FALLBACK_IMAGE_MODELS;
    const ttsResult = ttsList.length > 0 ? ttsList : FALLBACK_TTS_MODELS;

    const findDefault = (list: AIModelOption[], fallbackDefault: string) => {
      const level1 = list.find(m => m.isDefaultLevel1);
      if (level1) return level1.value;
      if (list.length > 0) return list[0].value;
      return fallbackDefault;
    };

    return {
      textModels: textResult,
      imageModels: imageResult,
      ttsModels: ttsResult,
      defaultTextModel: findDefault(textResult, 'gemini-3.6-flash'),
      defaultImageModel: findDefault(imageResult, 'gemini-3-pro-image'),
      defaultTtsModel: findDefault(ttsResult, 'gemini-3.1-flash-tts-preview'),
    };
  } catch (error) {
    console.error("Error fetching centralized AI models from Firestore:", error);
    return {
      textModels: FALLBACK_TEXT_MODELS,
      imageModels: FALLBACK_IMAGE_MODELS,
      ttsModels: FALLBACK_TTS_MODELS,
      defaultTextModel: 'gemini-3.6-flash',
      defaultImageModel: 'gemini-3-pro-image',
      defaultTtsModel: 'gemini-3.1-flash-tts-preview',
    };
  }
}
