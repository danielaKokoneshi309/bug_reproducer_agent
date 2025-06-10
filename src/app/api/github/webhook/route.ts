/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { fetchIssueComments } from "@/app/lib/github";
import { analyzeRootCause } from "@/app/lib/llm";
import { getInstallationOctokit as getInstallationOctokitApp } from "@/app/lib/github";

export async function POST(req: NextRequest) {
  const event = req.headers.get("x-github-event");
  const body = await req.text();
  let payload: any = {};
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const installationId = payload.installation?.id;
  if (!installationId) {
    return NextResponse.json({ error: "No installation ID" }, { status: 400 });
  }
  const octokit = await getInstallationOctokitApp(installationId);

  let diffs = "",
    code = "",
    comments = "";

  const logs = "";

  if (event === "pull_request" && payload.action === "opened") {
    const { number } = payload.pull_request;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;

    setTimeout(async () => {
      const { data: files } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        {
          owner,
          repo,
          pull_number: number,
        },
      );
      diffs = (files || [])
        .map((d: any) => `File: ${d.filename}\n${d.patch || ""}`)
        .join("\n\n");
      const { data: commentsArr } = await octokit.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner,
          repo,
          issue_number: number,
        },
      );
      comments = (commentsArr || [])
        .map((c: any) => `${c.user?.login}: ${c.body}`)
        .join("\n\n");

      const { data: pr } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner,
          repo,
          pull_number: number,
        },
      );

      const logs = [
        ...extractLogsFromText(pr.body || ""),
        ...commentsArr.flatMap((c: any) => extractLogsFromText(c.body || "")),
      ].join("\n");

      await analyzeRootCause({ logs, diffs, code, comments });
      // Optionally: post result as a comment using octokit.issues.createComment
    }, 0);
    return NextResponse.json({ ok: true });
  } else if (event === "issue_comment" && payload.action === "created") {
    setTimeout(async () => {
      const issue_number = payload.issue.number;
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      const issueComments = await fetchIssueComments(owner, repo, issue_number);
      comments = (issueComments || [])
        .map((c: any) => `${c.user?.login}: ${c.body}`)
        .join("\n\n");
      await analyzeRootCause({ logs, diffs, code, comments });
    }, 0);
    return NextResponse.json({ ok: true });
  } else if (event === "issues" && payload.action === "opened") {
    setTimeout(async () => {
      const issue_number = payload.issue.number;
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      const issueComments = await fetchIssueComments(owner, repo, issue_number);
      comments = (issueComments || [])
        .map((c: any) => `${c.user?.login}: ${c.body}`)
        .join("\n\n");
      code = "";
      await analyzeRootCause({ logs, diffs, code, comments });
    }, 0);
    return NextResponse.json({ ok: true });
  } else if (
    event === "pull_request_review_comment" &&
    payload.action === "created"
  ) {
    setTimeout(async () => {
      const reviewComment = payload.comment.body;
      const comments = reviewComment;
      await analyzeRootCause({ logs, diffs, code, comments });
    }, 0);
    return NextResponse.json({ ok: true });
  } else {
    console.log("Event ignored is ...", event);
    return NextResponse.json({ message: "Event ignored" });
  }
}

// Extract logs from PR body and comments
function extractLogsFromText(text: string): string[] {
  if (!text) return [];

  const codeBlocks = Array.from(text.matchAll(/```([\s\S]*?)```/g)).map((m) =>
    m[1].trim(),
  );
  const errorLines = text
    .split("\n")
    .filter((line) => /error|exception|trace/i.test(line));
  return [...codeBlocks, ...errorLines];
}
