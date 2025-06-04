import { NextRequest, NextResponse } from "next/server";
import { fetchPRs } from "@/app/lib/github";
import { analyzeLogs } from "@/app/lib/llm";

export async function POST(req: NextRequest) {
  const { owner, repo } = await req.json();
  const prs = await fetchPRs(owner, repo);

  // Example: Analyze the latest PR's body
  const latestPR = prs[0];
  const analysis = await analyzeLogs(
    latestPR.body || "",
    "Analyze this bug report and summarize the root cause.",
  );

  return NextResponse.json({ analysis });
}
