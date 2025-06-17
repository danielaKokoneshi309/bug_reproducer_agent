import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { extractLogsFromText } from "./github";
import { z } from "zod";

// Define our state schema using Zod
export const StateSchema = z.object({
  issue: z.object({
    title: z.string(),
    body: z.string(),
    comments: z.array(z.string()),
  }),
  parsed: z
    .object({
      logs: z.array(z.string()),
      reproSteps: z.array(z.string()),
      stackTrace: z.string().optional(),
    })
    .optional(),
  scripts: z
    .object({
      reproScript: z.string(),
      dockerfile: z.string(),
    })
    .optional(),
  results: z
    .object({
      stdout: z.string(),
      logs: z.string(),
      screenshots: z.array(z.string()).optional(),
    })
    .optional(),
  report: z.string().optional(),
});

type AgentState = z.infer<typeof StateSchema>;

// 1. Issue Parser Agent
const issueParserPrompt = PromptTemplate.fromTemplate(`
You are an expert at analyzing bug reports and extracting key information.
Given the following issue details, extract:
1. Relevant logs
2. Reproduction steps
3. Stack trace (if present)

Issue Title: {title}
Issue Body: {body}
Comments: {comments}

Return the information in this format:
LOGS:
<extracted logs>

REPRODUCTION STEPS:
<numbered steps>

STACK TRACE:
<stack trace if present>
`);

const issueParserChain = RunnableSequence.from([
  issueParserPrompt,
  new ChatOpenAI({ modelName: "gpt-4-turbo-preview" }),
]);

// 2. Script Generator Agent
const scriptGeneratorPrompt = PromptTemplate.fromTemplate(`
You are an expert at creating reproduction scripts and Dockerfiles.
Given the following parsed issue details, create:
1. A shell script (repro.sh) to reproduce the issue
2. A Dockerfile to set up the environment

Parsed Issue:
{parsed}

Return the files in this format:
REPRO_SCRIPT:
\`\`\`bash
<shell script content>
\`\`\`

DOCKERFILE:
\`\`\`dockerfile
<Dockerfile content>
\`\`\`
`);

const scriptGeneratorChain = RunnableSequence.from([
  scriptGeneratorPrompt,
  new ChatOpenAI({ modelName: "gpt-4-turbo-preview" }),
]);

// 3. Container Runner Agent
import { runContainer } from "./docker";

// 4. Report Generator Agent
const reportGeneratorPrompt = PromptTemplate.fromTemplate(`
You are an expert at analyzing test results and creating clear reports.
Given the following test results, create a comprehensive report:

Test Results:
{results}

Original Issue:
{issue}

Return a well-formatted report that includes:
1. Summary of findings
2. Confirmation of reproduction
3. Additional insights
4. Recommendations
`);

const reportGeneratorChain = RunnableSequence.from([
  reportGeneratorPrompt,
  new ChatOpenAI({ modelName: "gpt-4-turbo-preview" }),
]);

// Define the workflow
export async function createBugReproWorkflow() {
  const workflow = new StateGraph(StateSchema)
    .addNode("parse_issue", async (state: AgentState) => {
      const result = await issueParserChain.invoke({
        title: state.issue.title,
        body: state.issue.body,
        comments: state.issue.comments.join("\n"),
      });

      const content = result.content.toString();

      // Parse the result into structured data
      const parsed = {
        logs: extractLogsFromText(content),
        reproSteps: content
          .split("REPRODUCTION STEPS:")[1]
          ?.split("STACK TRACE:")[0]
          .trim()
          .split("\n"),
        stackTrace: content.split("STACK TRACE:")[1]?.trim(),
      };

      return { parsed };
    })
    .addNode("generate_scripts", async (state: AgentState) => {
      const result = await scriptGeneratorChain.invoke({
        parsed: JSON.stringify(state.parsed),
      });

      const content = result.content.toString();

      // Parse the result into structured data
      const reproScript = content
        .split("REPRO_SCRIPT:")[1]
        ?.split("DOCKERFILE:")[0]
        .trim();
      const dockerfile = content.split("DOCKERFILE:")[1]?.trim();

      return { scripts: { reproScript, dockerfile } };
    })
    .addNode("run_container", async (state: AgentState) => {
      if (!state.scripts) throw new Error("No scripts available");
      const results = await runContainer(state.scripts);
      return { results };
    })
    .addNode("generate_report", async (state: AgentState) => {
      const result = await reportGeneratorChain.invoke({
        results: JSON.stringify(state.results),
        issue: JSON.stringify(state.issue),
      });

      return { report: result.content.toString() };
    })
    .addEdge("__start__", "parse_issue")
    .addEdge("parse_issue", "generate_scripts")
    .addEdge("generate_scripts", "run_container")
    .addEdge("run_container", "generate_report")
    .addEdge("generate_report", END);

  return workflow.compile();
}

// Helper function to run the workflow
export async function runBugReproWorkflow(issue: {
  title: string;
  body: string;
  comments: string[];
}) {
  const workflow = await createBugReproWorkflow();
  const result = await workflow.invoke({
    issue,
  });
  return result;
}
