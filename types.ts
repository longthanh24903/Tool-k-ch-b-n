export interface Chapter {
  title: string;
  content: string;
  mainEmotion: string;
  emotionTag: string;
  keyEvent: string;
  endingHook: string;
}

export interface ScriptConfig {
  title: string;
  genre: string;
  idea: string;
  wordCount: string;
  style: string;
  language: 'vi' | 'en';
  totalChapters: string;
  enableSfx: boolean;
  sfxIntensity: 'light' | 'natural' | 'strong';
  rating: 'teen' | 'pg13' | 'r18';
  characterDescriptions: string;
  aiModel: 'auto' | 'flash' | 'pro';
}

export interface AnalysisResult {
  titles: string[];
  description: string;
  hashtags: string[];
}

export interface DialogueAnalysisCharacter {
    name: string;
    wordCount: number;
    percentage: number;
    frequentWords: string[];
}

export interface DialogueAnalysisResult {
    characters: DialogueAnalysisCharacter[];
    totalWords: number;
}

export interface SrtCompanionItem {
  imagePrompt: string;
  audio: string;
  start: number;
  duration: number;
}

export interface ImagePromptResult {
    id: number;
    prompt: string;
}

export interface ImagePromptConfig {
  style: string;
  artisticInfluence: string;
  aspectRatio: string;
  characterDescriptions: string;
}