import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function fetchPRs(owner: string, repo: string) {
  const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
  return data;
}
