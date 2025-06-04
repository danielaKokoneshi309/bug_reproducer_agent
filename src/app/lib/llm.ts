import { OpenAI } from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeLogs(logs: string, prompt: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // or "gpt-3.5-turbo"
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: logs },
    ],
    max_tokens: 500,
  });
  console.log(response.choices[0].message.content);
  return response.choices[0].message.content;
}
