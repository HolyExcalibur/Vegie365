import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedItem {
  item_name: string;
  category_tag: string;
  predicted_shelf_life_days: number;
}

export interface RecalculatedExpiry {
  item_name: string;
  updated_shelf_life_days: number;
  reasoning: string;
}

export interface GeneratedRecipe {
  recipe_name: string;
  priority_ingredients_used: string[];
  other_ingredients_used: string[];
  instructions: string[];
}

export interface CommunityRecipeResult {
  is_food_verified: boolean;
  verification_message: string;
  formatted_recipe: {
    recipe_title: string;
    standardized_ingredients_original_yield: string[];
    standardized_ingredients_single_serving: string[];
    formatted_steps: string[];
  };
  suggested_tags: string[];
  estimated_savings_sgd: number;
  items_to_deplete: string[];
}

export const geminiService = {
  async extractFoodData(input: { image?: string; text?: string }, today: string): Promise<ExtractedItem[]> {
    const model = "gemini-3-flash-preview";
    const prompt = `
      [PAGE CONTEXT: HOME PAGE - INVENTORY LOGIC]
      task_type: "extraction"
      Today's Date: ${today}

      Input: Image of fridge/receipt, barcode, or text string.
      Action: Identify items, assign broad category tags, and predict shelf life (days from today).
      
      1. Look for a "Purchase Date" or "Transaction Date" on the receipt. Note: Singaporean receipts typically use the DD/MM/YY or DD/MM/YYYY format.
      2. For each item:
         a. Determine its standard shelf life (SSL) in days (e.g., milk = 7 days, bread = 5 days, fresh leafy greens = 3-5 days, sushi = 1 day).
         b. If a purchase date (PD) is found on the receipt:
            - Calculate the Expiry Date (ED) = PD + SSL.
            - Calculate the "predicted_shelf_life_days" = ED - Today.
            - If the result is negative, the item is already expired.
         c. If no purchase date is found, assume the purchase date is Today and return SSL as "predicted_shelf_life_days".
      3. Decode any abbreviated names commonly found on receipts.
      4. Ignore non-food items.
    `;
    
    const parts: any[] = [{ text: prompt }];
    if (input.image) {
      const mimeType = input.image.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
      parts.push({
        inlineData: {
          mimeType,
          data: input.image.split(",")[1] || input.image
        }
      });
    }
    if (input.text) {
      parts.push({ text: input.text });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: `You are the backend AI intelligence for a single-user household food tracking and community sharing application. 
        Important Constraints: 
        - Do NOT assume or apply any dietary restrictions or macro-nutrient goals unless explicitly stated by the user.
        - Output ONLY valid JSON. Do not include markdown formatting or conversational filler outside of the JSON structure.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extracted_items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item_name: { type: Type.STRING },
                  category_tag: { type: Type.STRING },
                  predicted_shelf_life_days: { type: Type.INTEGER }
                },
                required: ["item_name", "category_tag", "predicted_shelf_life_days"]
              }
            }
          },
          required: ["extracted_items"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"extracted_items": []}');
    return result.extracted_items;
  },

  async recalculateExpiry(itemName: string, currentExpiry: string, action: string): Promise<RecalculatedExpiry> {
    const model = "gemini-3-flash-preview";
    const prompt = `
      [PAGE CONTEXT: HOME PAGE - INVENTORY LOGIC]
      task_type: "recalculate_expiry"
      Input: Item name: ${itemName}, current expiry days: ${currentExpiry}, user action: ${action}.
      Action: Generate new estimated shelf life based on storage condition.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are the backend AI intelligence for a food tracking app. Output ONLY valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_name: { type: Type.STRING },
            updated_shelf_life_days: { type: Type.INTEGER },
            reasoning: { type: Type.STRING }
          },
          required: ["item_name", "updated_shelf_life_days", "reasoning"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  },

  async generateRecipe(inventory: any[]): Promise<GeneratedRecipe> {
    const model = "gemini-3-flash-preview";
    const inventoryJson = JSON.stringify(inventory);
    const prompt = `
      [PAGE CONTEXT: HOME PAGE - INVENTORY LOGIC]
      task_type: "recipe_generation"
      Input: ${inventoryJson}.
      Action: Create a recipe strongly prioritizing ingredients expiring in 2 days or less. 
      Prefer Singaporean or Asian-specific dishes.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are the backend AI intelligence for a food tracking app. Output ONLY valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipe_name: { type: Type.STRING },
            priority_ingredients_used: { type: Type.ARRAY, items: { type: Type.STRING } },
            other_ingredients_used: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["recipe_name", "priority_ingredients_used", "other_ingredients_used", "instructions"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  },

  async calculatePoints(input: { 
    items: string[], 
    category: string, 
    originalShelfLife: number, 
    daysRemaining: number, 
    actionTaken: "consumed_privately" | "shared_recipe_online" | "shared_physically" 
  }): Promise<any> {
    const model = "gemini-3-flash-preview";
    const prompt = `
      [PAGE CONTEXT: COMMUNITY SUBPAGE - SHARING & GAMIFICATION]
      task_type: "point_calculation"
      Input: ${JSON.stringify(input)}
      Action: Calculate a dynamic "Zero Waste" point score (1-150).
      Scoring Logic:
      - Base points by perishability and urgency (0-1 days remaining = higher points).
      - Multipliers: consumed_privately (1x), shared_recipe_online (1.5x), shared_physically (2x).
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are the backend AI intelligence for a food tracking app. Output ONLY valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items_saved: { type: Type.ARRAY, items: { type: Type.STRING } },
            action_logged: { type: Type.STRING },
            points_awarded: { type: Type.INTEGER },
            celebratory_message: { type: Type.STRING }
          },
          required: ["items_saved", "action_logged", "points_awarded", "celebratory_message"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  },

  async generateSharingListing(input: { description: string, daysToExpiry: number, location: string }): Promise<any> {
    const model = "gemini-3-flash-preview";
    const prompt = `
      [PAGE CONTEXT: COMMUNITY SUBPAGE - SHARING & GAMIFICATION]
      task_type: "generate_sharing_listing"
      Input: ${JSON.stringify(input)}
      Action: Generate a friendly listing for the neighborhood physical sharing feed. Include urgency.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are the backend AI intelligence for a food tracking app. Output ONLY valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            listing_title: { type: Type.STRING },
            listing_description: { type: Type.STRING },
            suggested_tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["listing_title", "listing_description", "suggested_tags"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  },

  async processCommunityRecipe(input: { image?: string; ingredients: string; steps: string }): Promise<CommunityRecipeResult> {
    const model = "gemini-3-flash-preview";
    const prompt = `
      [PAGE CONTEXT: COMMUNITY SUBPAGE - RECIPE PROCESSING]
      task_type: "process_community_recipe"
      Input: An image of the final dish, raw text of ingredients used, and raw text of cooking steps.
      Ingredients: ${input.ingredients}
      Steps: ${input.steps}

      Action: 
      1. Vision Verification: Confirm the image is actually of food.
      2. Standardization: Clean up the raw ingredient text into standard measurements and format the steps clearly.
      3. Scaling: Calculate a strict single-serving version of the ingredients.
      4. Auto-Tagging: Generate 3-5 relevant tags (e.g., dietary restrictions, main protein, prep time).
      5. Impact Metric: Estimate the financial value of the "rescued" ingredients used in this recipe in standard Singapore Dollars (SGD).
      6. Depletion Targeting: List the core ingredients used so the frontend can trigger the "recycle bin" verification pop-up for the user's inventory.
    `;

    const parts: any[] = [{ text: prompt }];
    if (input.image) {
      const mimeType = input.image.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
      parts.push({
        inlineData: {
          mimeType,
          data: input.image.split(",")[1] || input.image
        }
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: `You are the backend AI intelligence for a single-user household food tracking and community sharing application. 
        Important Constraints: 
        - Do NOT assume or apply any dietary restrictions or macro-nutrient goals unless explicitly stated by the user.
        - Output ONLY valid JSON. Do not include markdown formatting or conversational filler outside of the JSON structure.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_food_verified: { type: Type.BOOLEAN },
            verification_message: { type: Type.STRING },
            formatted_recipe: {
              type: Type.OBJECT,
              properties: {
                recipe_title: { type: Type.STRING },
                standardized_ingredients_original_yield: { type: Type.ARRAY, items: { type: Type.STRING } },
                standardized_ingredients_single_serving: { type: Type.ARRAY, items: { type: Type.STRING } },
                formatted_steps: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["recipe_title", "standardized_ingredients_original_yield", "standardized_ingredients_single_serving", "formatted_steps"]
            },
            suggested_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            estimated_savings_sgd: { type: Type.NUMBER },
            items_to_deplete: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["is_food_verified", "verification_message", "formatted_recipe", "suggested_tags", "estimated_savings_sgd", "items_to_deplete"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  }
};
