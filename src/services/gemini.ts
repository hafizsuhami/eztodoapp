import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
               (typeof process !== 'undefined' && (process.env as any)?.GEMINI_API_KEY) || '';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!apiKey) {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export function isAIEnabled(): boolean {
  return !!apiKey;
}

export interface GeneratedSubtask {
  title: string;
}

export async function generateSubtasks(taskTitle: string): Promise<GeneratedSubtask[]> {
  if (!taskTitle.trim()) {
    return [];
  }

  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Given the following task title, generate 3-5 practical subtasks that would help complete this task. 
  
Task: "${taskTitle}"

Respond ONLY with a JSON array of objects, each with a "title" property. Example format:
[{"title": "First subtask"}, {"title": "Second subtask"}]

Keep subtasks concise, actionable, and specific. Do not include any explanation or markdown, just the JSON array.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Parse the JSON response
    const parsed = JSON.parse(text);
    
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item.title === 'string' && item.title.trim());
    }
    
    return [];
  } catch (error) {
    console.error('Failed to generate subtasks:', error);
    throw new Error('Failed to generate subtasks. Please try again.');
  }
}
