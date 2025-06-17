/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchIssueComments,
  getInstallationOctokit as getInstallationOctokitApp,
} from "@/app/lib/agents/analyzer/github";
import { runBugReproWorkflow } from "@/app/lib/agents/analyzer/agents";
import { analyzeRootCause } from "@/app/lib/llm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // Verify GitHub webhook signature
  const signature = req.headers.get("x-hub-signature-256");
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 401 });
  }

  const hmac = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET || "");
  const digest = `sha256=${hmac.update(body).digest("hex")}`;

  if (signature !== digest) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  if (!event) {
    return NextResponse.json({ error: "No event type" }, { status: 400 });
  }

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

  console.log("Processing event:", event);
  const octokit = await getInstallationOctokitApp(installationId);

  try {
    if (event === "pull_request" && payload.action === "opened") {
      const { number } = payload.pull_request;
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;

      const { data: files } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        {
          owner,
          repo,
          pull_number: number,
        },
      );
      const diffs = (files || [])
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
      const comments = (commentsArr || [])
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

      const analysis = await analyzeRootCause({
        logs,
        diffs,
        code: "",
        comments,
      });
      return NextResponse.json({ analysis });
    } else if (event === "issues" && payload.action === "opened") {
      const issue_number = payload.issue.number;
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;

      // Get all comments on the issue
      const issueComments = await fetchIssueComments(owner, repo, issue_number);
      const comments = (issueComments || [])
        .map((c: any) => `${c.user?.login}: ${c.body}`)
        .join("\n\n");

      // Run the bug reproduction workflow
      const result = await runBugReproWorkflow({
        title: payload.issue.title,
        body: payload.issue.body,
        comments: [comments],
      });

      // Post the analysis as a comment on the issue
      await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner,
          repo,
          issue_number,
          body: result.report || "",
        },
      );

      return NextResponse.json({ ok: true });
    } else if (
      event === "pull_request_review_comment" &&
      payload.action === "created"
    ) {
      if (
        payload.sender?.type === "Bot" &&
        payload.sender?.login === "bug-agent[bot]"
      ) {
        return NextResponse.json(
          { message: "Bot comment ignored" },
          { status: 200 },
        );
      }

      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      const number = payload.pull_request.number;

      // Run the bug reproduction workflow
      const result = await runBugReproWorkflow({
        title: `PR Review Comment on ${payload.pull_request.title}`,
        body: payload.comment.body,
        comments: [],
      });

      // Post the analysis as a reply to the review comment
      await octokit.request(
        "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        {
          owner,
          repo,
          pull_number: number,
          body: result.report || "",
          commit_id: payload.comment.commit_id,
          path: payload.comment.path,
          in_reply_to: payload.comment.id,
        },
      );

      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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
