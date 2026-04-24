import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface GeneratedCourse {
  title: string;
  description: string;
  modules: {
    title: string;
    lessons: {
      title: string;
      activities: {
        type: 'html' | 'video' | 'quiz';
        title: string;
        data: any;
      }[];
    }[];
  }[];
}

export const geminiService = {
  async generateCourseStructure(topic: string): Promise<GeneratedCourse> {
    const prompt = `Generate a comprehensive course structure for the topic: "${topic}".
    The course should have 3 modules, each module with 2-3 lessons.
    Each lesson should have 1-2 activities. 
    Activities can be of type 'html' (with content in html field), 'video' (with a YouTube URL in video_url field - use placeholders), or 'quiz' (with questions array).
    
    IMPORTANT: Provide realistic and educational content for the html activities. Use formatted text (h1, h2, p, strong, ul, li).
    
    Return the response in valid JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            modules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  lessons: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        activities: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              type: { type: Type.STRING, enum: ['html', 'video', 'quiz'] },
                              title: { type: Type.STRING },
                              data: { type: Type.OBJECT }
                            },
                            required: ['type', 'title', 'data']
                          }
                        }
                      },
                      required: ['title', 'activities']
                    }
                  }
                },
                required: ['title', 'lessons']
              }
            }
          },
          required: ['title', 'description', 'modules']
        }
      }
    });

    const text = response.text || '';
    return JSON.parse(text);
  }
};
