import { NextRequest, NextResponse } from "next/server";
import { analyzeRootCause } from "@/app/lib/llm";

export async function POST(req: NextRequest) {
  const { logs, diffs, code, comments } = await req.json();

  if (!logs && !diffs && !code) {
    return NextResponse.json(
      { error: "At least one of logs, diffs, or code must be provided." },
      { status: 400 },
    );
  }

  const analysis = await analyzeRootCause({ logs, diffs, code, comments });
  return NextResponse.json({ analysis });
}
