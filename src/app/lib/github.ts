/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function fetchPRs(owner: string, repo: string) {
  const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
  return data;
}

function extractLogsFromText(text: string): string[] {
  // Simple heuristic: extract code blocks (```) or lines containing "error", "exception", or "trace"
  if (!text) return [];
  const codeBlocks = Array.from(text.matchAll(/```([\s\S]*?)```/g)).map((m) =>
    m[1].trim(),
  );
  const errorLines = text
    .split("\n")
    .filter((line) => /error|exception|trace/i.test(line));
  return [...codeBlocks, ...errorLines];
}

export async function fetchPRDetails(
  owner: string,
  repo: string,
  pull_number: number,
) {
  const [pr, files, comments] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number }),
    octokit.pulls.listFiles({ owner, repo, pull_number }),
    octokit.pulls.listCommits({ owner, repo, pull_number }),
  ]);
  const logs = [
    ...extractLogsFromText(pr.data.body || ""),
    ...comments.data.flatMap((c: any) => extractLogsFromText(c.body || "")),
  ];
  console.log("logs", logs);
  return {
    summary: {
      number: pr.data.number,
      title: pr.data.title,
      body: pr.data.body,
      author: pr.data.user?.login,
      labels: pr.data.labels?.map((l: any) => l.name),
      created_at: pr.data.created_at,
      updated_at: pr.data.updated_at,
      state: pr.data.state,
      url: pr.data.html_url,
    },
    diffs: files.data.map((f: any) => ({
      filename: f.filename,
      status: f.status,
      patch: f.patch,
    })),
    logs,
    comments: comments.data.map((c: any) => ({
      user: c.user?.login,
      body: c.body,
      created_at: c.created_at,
    })),
  };
}

export async function fetchIssues(owner: string, repo: string) {
  const { data } = await octokit.issues.listForRepo({ owner, repo });
  return data;
}
