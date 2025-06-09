/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { fetchPRDetails, fetchIssueComments } from "@/app/lib/github";
import { analyzeRootCause } from "@/app/lib/llm";

export async function POST(req: NextRequest) {
  const event = req.headers.get("x-github-event");
  const body = await req.text();
  let payload: any = {};
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let logs = "",
    diffs = "",
    code = "",
    comments = "";

  if (event === "pull_request" && payload.action === "opened") {
    const { number } = payload.pull_request;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const details = await fetchPRDetails(owner, repo, number);
    logs = (details.logs || []).join("\n");
    diffs = (details.diffs || [])
      .map((d: any) => `File: ${d.filename}\n${d.patch || ""}`)
      .join("\n\n");
    comments = (details.comments || [])
      .map((c: any) => `${c.user}: ${c.body}`)
      .join("\n\n");
  } else if (event === "issue_comment" && payload.action === "created") {
    const issue_number = payload.issue.number;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const issueComments = await fetchIssueComments(owner, repo, issue_number);

    comments = (issueComments || [])
      .map((c: any) => `${c.user?.login}: ${c.body}`)
      .join("\n\n");
  } else if (event === "issues" && payload.action === "opened") {
    const issue_number = payload.issue.number;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const issueComments = await fetchIssueComments(owner, repo, issue_number);

    comments = (issueComments || [])
      .map((c: any) => `${c.user?.login}: ${c.body}`)
      .join("\n\n");
    code = "";
  } else if (
    event === "pull_request_review_comment" &&
    payload.action === "created"
  ) {
    const reviewComment = payload.comment.body;

    const comments = reviewComment;
    const analysis = await analyzeRootCause({ logs, diffs, code, comments });

    return NextResponse.json({ analysis: analysis });
  } else {
    return NextResponse.json({ message: "Event ignored" });
  }

  const analysis = await analyzeRootCause({ logs, diffs, code, comments });

  // To do Post the analysis as a comment on the PR/issue using GitHub API use octokit.issues.createComment({ owner, repo, issue_number, body: analysis })

  return NextResponse.json({ analysis: analysis });
}
