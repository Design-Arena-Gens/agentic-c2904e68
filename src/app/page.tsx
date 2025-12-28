import AgentClient from "./agent-client";
import { initialAgentState, type AgentState } from "@/lib/agent-state";
import { parseCvFile } from "@/lib/cv";
import { fetchLinkedInJobs } from "@/lib/job-search";
import { scoreJob } from "@/lib/matching";
import { generateCoverLetter } from "@/lib/cover-letter";
import type { JobSearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";

async function runAgent(
  _prevState: AgentState,
  formData: FormData,
): Promise<AgentState> {
  "use server";

  try {
    const cvFile = formData.get("cv");
    if (!(cvFile instanceof File)) {
      throw new Error("Please attach your CV before running the agent.");
    }

    const keywords = (formData.get("keywords") ?? "").toString().trim();
    if (!keywords) {
      throw new Error("Enter a search keyword to target relevant roles.");
    }

    const location = (formData.get("location") ?? "").toString().trim();
    const remoteFilter = (formData.get("remoteFilter") ?? "any")
      .toString()
      .toLowerCase() as JobSearchParams["remoteFilter"];

    const experienceLevels = formData.getAll("experienceLevels").map((entry) =>
      entry.toString(),
    );

    const cv = await parseCvFile(cvFile);

    const searchParams: JobSearchParams = {
      keywords,
      location: location || undefined,
      remoteFilter: remoteFilter ?? "any",
      experienceLevels:
        experienceLevels.length > 0 ? experienceLevels : undefined,
    };

    const jobs = await fetchLinkedInJobs(searchParams, 12);
    const ranked = jobs
      .map((job) => {
        const scored = scoreJob(cv, job);
        return {
          ...scored,
          coverLetter: generateCoverLetter(cv, job),
        };
      })
      .filter((item) => item.matchScore > 0 || item.matchedKeywords.length > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    return {
      status: "completed",
      result: {
        cv,
        jobs: ranked,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while running the agent.";

    return {
      status: "error",
      message,
      result: null,
    };
  }
}

export default function Home() {
  return (
    <AgentClient action={runAgent} initialState={initialAgentState} />
  );
}
