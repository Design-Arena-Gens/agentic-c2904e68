export interface ParsedCv {
  rawText: string;
  summary: string;
  keywords: string[];
  experienceHighlights: string[];
  educationHighlights: string[];
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    links: string[];
  };
}

export interface JobSearchParams {
  keywords: string;
  location?: string;
  remoteFilter?: "remote" | "onsite" | "hybrid" | "any";
  experienceLevels?: string[];
}

export interface JobPosting {
  jobId: string;
  title: string;
  company: string;
  location: string;
  listedAt?: string;
  url: string;
  workplaceType?: string;
  description: string;
  metadata: Record<string, string>;
}

export interface JobMatchResult extends JobPosting {
  matchScore: number;
  matchedKeywords: string[];
  coverLetter: string;
  autofillProfile: {
    headline: string;
    summary: string;
    keySkills: string[];
    experienceBullets: string[];
  };
  recommendedResponses: {
    question: string;
    answer: string;
  }[];
}

export interface AgentResult {
  cv: ParsedCv;
  jobs: JobMatchResult[];
}
