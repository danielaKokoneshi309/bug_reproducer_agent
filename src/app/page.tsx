/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState } from "react";

type PR = { number: number; title: string };
type Issue = { number: number; title: string };
type PRDetails = any;
type IssueDetails = any;
type Comment = { user: { login: string }; body: string; created_at: string };

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        className="flex items-center gap-2 text-lg font-semibold text-blue-700 hover:text-blue-900 transition"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
        {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export default function CollectorPage() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [prs, setPRs] = useState<PR[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedPR, setSelectedPR] = useState<number | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const [prDetails, setPRDetails] = useState<PRDetails | null>(null);
  const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);
  const [issueComments, setIssueComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = async (body: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/collector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLoading(false);
      return data;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const loadPRs = async () => {
    const data = await api({ owner, repo, action: "list_prs" });
    setPRs(data?.prs || []);
    setSelectedPR(null);
    setPRDetails(null);
  };

  const loadIssues = async () => {
    const data = await api({ owner, repo, action: "list_issues" });
    setIssues(data?.issues || []);
    setSelectedIssue(null);
    setIssueDetails(null);
    setIssueComments([]);
  };

  const loadPRDetails = async (number: number) => {
    setSelectedPR(number);
    const data = await api({
      owner,
      repo,
      action: "pr_details",
      pull_number: number,
    });
    setPRDetails(data?.details || null);
  };

  const loadIssueDetails = async (number: number) => {
    setSelectedIssue(number);
    const details = await api({
      owner,
      repo,
      action: "issue_details",
      issue_number: number,
    });
    setIssueDetails(details?.issue || null);
    const comments = await api({
      owner,
      repo,
      action: "issue_comments",
      issue_number: number,
    });
    setIssueComments(comments?.comments || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 py-10 px-2">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-extrabold text-blue-800 mb-6 tracking-tight">
          Bug Details
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            className="border border-blue-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none transition w-full sm:w-1/3"
            placeholder="Owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
          <input
            className="border border-blue-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none transition w-full sm:w-1/3"
            placeholder="Repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition"
            onClick={loadPRs}
          >
            List PRs
          </button>
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition"
            onClick={loadIssues}
          >
            List Issues
          </button>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-blue-600 mb-4">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            Loading...
          </div>
        )}
        {error && <div className="text-red-500 mb-4">{error}</div>}

        {/* PRs */}
        {prs.length > 0 && (
          <div className="mb-8">
            <h2 className="font-bold text-xl text-blue-700 mb-2">
              Pull Requests
            </h2>
            <div className="flex flex-wrap gap-3">
              {prs.map((pr) => (
                <button
                  key={pr.number}
                  className={`rounded-lg px-4 py-2 border transition shadow-sm hover:shadow-md ${
                    selectedPR === pr.number
                      ? "bg-blue-100 border-blue-500 font-bold"
                      : "bg-white border-slate-200"
                  }`}
                  onClick={() => loadPRDetails(pr.number)}
                >
                  #{pr.number}: {pr.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PR Details */}
        {prDetails && (
          <div className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow">
              <h3 className="font-bold text-lg text-blue-800 mb-2">
                PR Details
              </h3>
              <div className="mb-2">
                <b>Title:</b> {prDetails.summary.title}
              </div>
              <div className="mb-2">
                <b>Author:</b> {prDetails.summary.author}
              </div>
              <div className="mb-2">
                <b>Labels:</b> {prDetails.summary.labels?.join(", ")}
              </div>
              <Section title="Diffs" defaultOpen>
                <ul>
                  {prDetails.diffs.map((diff: any, i: number) => (
                    <li key={i} className="mb-2">
                      <b>{diff.filename}</b>
                      <pre className="whitespace-pre-wrap text-xs bg-slate-200 p-2 rounded mt-1">
                        {diff.patch}
                      </pre>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Logs">
                <pre className="whitespace-pre-wrap text-xs bg-slate-200 p-2 rounded">
                  {prDetails.logs?.join("\n")}
                </pre>
              </Section>
              <Section title="Comments">
                <ul>
                  {prDetails.comments.map((c: any, i: number) => (
                    <li key={i} className="mb-1">
                      <span className="font-semibold text-blue-700">
                        {c.user}:
                      </span>{" "}
                      <span>{c.body}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </div>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div className="mb-8">
            <h2 className="font-bold text-xl text-green-700 mb-2">Issues</h2>
            <div className="flex flex-wrap gap-3">
              {issues.map((issue) => (
                <button
                  key={issue.number}
                  className={`rounded-lg px-4 py-2 border transition shadow-sm hover:shadow-md ${
                    selectedIssue === issue.number
                      ? "bg-green-100 border-green-500 font-bold"
                      : "bg-white border-slate-200"
                  }`}
                  onClick={() => loadIssueDetails(issue.number)}
                >
                  #{issue.number}: {issue.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Issue Details */}
        {issueDetails && (
          <div className="mb-8">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 shadow">
              <h3 className="font-bold text-lg text-green-800 mb-2">
                Issue Details
              </h3>
              <div className="mb-2">
                <b>Title:</b> {issueDetails.title}
              </div>
              <div className="mb-2">
                <b>Author:</b> {issueDetails.user?.login}
              </div>
              <div className="mb-2">
                <b>Labels:</b>{" "}
                {issueDetails.labels?.map((l: any) => l.name).join(", ")}
              </div>
              <div className="mb-2">
                <b>State:</b> {issueDetails.state}
              </div>
              <div className="mb-2">
                <b>Created:</b> {issueDetails.created_at}
              </div>
              <Section title="Comments" defaultOpen>
                <ul>
                  {issueComments.map((c, i) => (
                    <li key={i} className="mb-1">
                      <span className="font-semibold text-green-700">
                        {c.user?.login}:
                      </span>{" "}
                      <span>{c.body}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
