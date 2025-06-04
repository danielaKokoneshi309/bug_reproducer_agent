import { NextRequest, NextResponse } from "next/server";
import { fetchPRs } from "@/app/lib/github";

export async function POST(req: NextRequest) {
  const { owner, repo } = await req.json();
  const prs = await fetchPRs(owner, repo);
  return NextResponse.json({ prs });
}
