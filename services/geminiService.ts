import { GoogleGenAI, Type } from "@google/genai";
import { Theme, Character, GameLogEntry, DMResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DM_MODEL = "gemini-3-pro-preview";
const CREATOR_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-2.5-flash-image";

export const generateCharacterImage = async (description: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [{ text: `A high quality digital painting character portrait for an RPG. Close up, expressive face. Style matching description: ${description}` }],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
};

export const generateCharacter = async (
  theme: Theme,
  prompt: string | undefined,
  options?: { races: string[]; classes: string[] }
): Promise<Partial<Character>> => {
  const userPrompt = prompt && prompt.trim() 
    ? prompt 
    : `Generate a completely random, unique, and interesting character for a ${theme} setting.`;

  const constraintText = options 
    ? `Please choose a Race from [${options.races.join(', ')}] and a Class from [${options.classes.join(', ')}].` 
    : '';

  const systemInstruction = `You are a helper for an RPG game. 
  Create a character based on the theme "${theme}" and the user prompt. 
  ${constraintText}
  Return JSON only. Attributes should be D&D 5e style (Base 8, point buy system preferred, max 18).`;

  try {
    const response = await ai.models.generateContent({
      model: CREATOR_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            class: { type: Type.STRING },
            race: { type: Type.STRING },
            backstory: { type: Type.STRING },
            hp: { type: Type.INTEGER },
            maxHp: { type: Type.INTEGER },
            stats: {
              type: Type.OBJECT,
              properties: {
                str: { type: Type.INTEGER },
                dex: { type: Type.INTEGER },
                int: { type: Type.INTEGER },
                wis: { type: Type.INTEGER },
                cha: { type: Type.INTEGER },
                con: { type: Type.INTEGER },
              },
              required: ["str", "dex", "int", "wis", "cha", "con"],
            },
            inventory: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["name", "class", "race", "backstory", "hp", "maxHp", "stats", "inventory", "skills"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Character generation failed:", error);
    throw error;
  }
};

export const generateCampaignOptions = async (theme: Theme): Promise<Array<{title: string, description: string}>> => {
    try {
        const response = await ai.models.generateContent({
            model: CREATOR_MODEL,
            contents: `List 3 famous, popular, or publicly available pre-made campaign modules or classic settings for a ${theme} RPG. 
            For example, if Fantasy, suggest famous modules like "Curse of Strahd" or "The Lost Mine of Phandelver". 
            If Sci-Fi, suggest classics like "Traveller: The Pirates of Drinax" or similar major modules.
            Return strictly JSON format.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                        required: ["title", "description"]
                    }
                }
            }
        });
        if(response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (e) {
        console.error("Campaign gen failed", e);
        return [{title: "The Default Adventure", description: "A standard journey begins."}];
    }
}

export const processTurn = async (
  campaignTitle: string,
  theme: Theme,
  characters: Character[],
  history: GameLogEntry[],
  newActions: { characterName: string; action: string }[]
): Promise<DMResponse> => {
  // Filter history to last 15 entries to save tokens, but keep context
  const recentHistory = history.slice(-15).map(h => `${h.author || 'Narrator'}: ${h.text}`).join('\n');
  
  const characterContext = characters.map(c => 
    `${c.name} (${c.race} ${c.class}): HP ${c.hp}/${c.maxHp}, Inventory: [${c.inventory.join(', ')}]`
  ).join('\n');

  const actionPrompt = newActions.map(a => `${a.characterName} attempts to: ${a.action}`).join('\n');

  const prompt = `
    Campaign: ${campaignTitle} (${theme})
    
    Current Party Status:
    ${characterContext}

    Recent History:
    ${recentHistory}

    New Player Actions:
    ${actionPrompt}

    Instructions:
    You are the Dungeon Master. Resolve the players' actions. 
    1. Describe the outcome dramatically.
    2. Update game state (HP damage, items found/used).
    3. Drive the plot forward.
    4. If combat, keep it tactical.
    
    Output strictly in JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DM_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            updates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    characterName: { type: Type.STRING },
                    hpChange: { type: Type.INTEGER },
                    itemAdded: { type: Type.STRING },
                    itemRemoved: { type: Type.STRING }
                },
                required: ["characterName"]
              }
            },
            suggestedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
          },
          required: ["narrative", "updates"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response from DM");
  } catch (error) {
    console.error("DM Logic failed:", error);
    return {
      narrative: "The Dungeon Master is silent (AI Error). Please try again.",
      updates: [],
    };
  }
};