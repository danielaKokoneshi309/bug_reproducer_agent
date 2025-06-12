import { OpenAI } from "openai";
import { Agent, run } from "@openai/agents";
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const analyzeRootCause = async ({
  logs,
  diffs,
  code,
  comments,
  commentedLines,
}: {
  logs?: string;
  diffs?: string;
  code?: string;
  comments?: string;
  commentedLines?: string;
}) => {
  const agent = new Agent({
    name: "Assistant",
    instructions: `You are a senior software engineer and bug triage expert. Given the following information, analyze and summarize the most likely root cause of the bug. If possible, point to the relevant code or diff, and suggest a fix.

Logs:
${logs || "N/A"}

Diffs:
${diffs || "N/A"}

Code:
${code || "N/A"}

Comments:
${comments || "N/A"}

Commented Lines:
${commentedLines || "N/A"}

Return your answer in this format:
---
Root Cause: <short summary>
Evidence: <key log lines, code, or diff>
Suggested Fix: <if possible>
Severity: <low/medium/high>
---`,
  });
  const result = await run(
    agent,
    "You are a world-class bug root cause analyzer.",
  );
  console.log("result", result.output);
  return result.output;
};
