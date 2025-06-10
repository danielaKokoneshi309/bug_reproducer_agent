/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from "@octokit/rest";
import { App } from "@octokit/app";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const app = new App({
  appId: process.env.APP_ID!,
  privateKey: process.env.PRIVATE_KEY!.replace(/\\n/g, "\n"),
  webhooks: {
    secret: process.env.WEBHOOK_SECRET!,
  },
});

export async function getInstallationOctokit(installationId: number) {
  const octokit = await app.getInstallationOctokit(installationId);
  return octokit;
}

export async function fetchPRs(owner: string, repo: string) {
  const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
  return data;
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

export async function fetchPRDetails(
  owner: string,
  repo: string,
  pull_number: number,
) {
  const [pr, files, reviewComments] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number }),
    octokit.pulls.listFiles({ owner, repo, pull_number }),
    octokit.pulls.listReviewComments({ owner, repo, pull_number }),
  ]);
  const allComments = [...reviewComments.data];
  const logs = [
    ...extractLogsFromText(pr.data.body || ""),
    ...allComments.flatMap((c: any) => extractLogsFromText(c.body || "")),
  ];

  console.log("logs", logs);
  console.log("reviewComments", reviewComments.data);
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
    comments: allComments
      .filter((c: any) => c && c.body)
      .map((c: any) => ({
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

// Fetch a single issue by number
export async function fetchIssue(
  owner: string,
  repo: string,
  issue_number: number,
) {
  const { data } = await octokit.issues.get({ owner, repo, issue_number });
  return data;
}

// Fetch comments for a specific issue
export async function fetchIssueComments(
  owner: string,
  repo: string,
  issue_number: number,
) {
  const { data } = await octokit.issues.listComments({
    owner,
    repo,
    issue_number,
  });
  return data;
}
