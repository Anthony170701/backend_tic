import { MOD_HANDLERS } from "./modHandlers.js";

export const buildAIRequestPayload = (mod, data_to_analyze) => {
  const MOD = mod.toLowerCase();
  const handler = MOD_HANDLERS[MOD];

  if (!handler) {
    throw new Error(`Modo desconocido: ${mod}`);
  }

  const systemPrompt = handler.system;
  const userPrompt = handler.user(data_to_analyze);
  const tokens = handler.tokens ?? 1000;

  return {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: tokens,
    temperature: 0.2,
    top_p: 0.1,
  };
};
