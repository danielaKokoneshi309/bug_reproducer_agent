import { NextRequest, NextResponse } from "next/server";
import { fetchPRs, fetchPRDetails, fetchIssues } from "@/app/lib/github";

export async function POST(req: NextRequest) {
  const { owner, repo, action, pull_number } = await req.json();

  if (action === "list_prs") {
    const prs = await fetchPRs(owner, repo);
    return NextResponse.json({ prs });
  }

  if (action === "pr_details" && pull_number) {
    const details = await fetchPRDetails(owner, repo, pull_number);
    return NextResponse.json({ details });
  }

  if (action === "list_issues") {
    const issues = await fetchIssues(owner, repo);
    return NextResponse.json({ issues });
  }

  return NextResponse.json(
    { error: "Invalid action or missing parameters" },
    { status: 400 },
  );
}
