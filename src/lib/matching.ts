import type { JobMatchResult, JobPosting, ParsedCv } from "./types";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ");
}

function extractKeywords(text: string, existing: string[] = []) {
  const tokens = normalize(text)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  const set = new Set(existing);
  for (const token of tokens) {
    if (!set.has(token)) {
      set.add(token);
    }
  }
  return set;
}

function computeKeywordMatch(
  cvKeywords: string[],
  jobDescription: string,
) {
  const jobKeywords = Array.from(extractKeywords(jobDescription));
  const jobKeywordSet = new Set(jobKeywords);
  const matched = cvKeywords.filter((keyword) => jobKeywordSet.has(keyword));
  const score =
    matched.length > 0
      ? Math.min(1, matched.length / Math.max(jobKeywords.length, 1))
      : 0;
  return { matched, score };
}

function scoreDescriptionOverlap(cv: ParsedCv, job: JobPosting) {
  const cvLines = new Set(
    cv.experienceHighlights.map((line) => normalize(line)),
  );
  let overlap = 0;
  for (const line of job.description.split(/[\n.]+/)) {
    const normalized = normalize(line);
    if (normalized.length < 10) continue;
    for (const cvLine of cvLines) {
      if (cvLine && normalized.includes(cvLine.slice(0, 30))) {
        overlap += 1;
        break;
      }
    }
  }
  return Math.min(1, overlap / 10);
}

function buildAutofillProfile(cv: ParsedCv, job: JobPosting, matched: string[]) {
  const keySkills = matched.slice(0, 10);
  const experienceBullets =
    cv.experienceHighlights.slice(0, 5).map((line) => line.replace(/\.$/, ""));

  const headline =
    keySkills.length > 0 && cv.contact.name
      ? `${cv.contact.name} · ${keySkills.slice(0, 3).join(" · ")}`
      : cv.contact.name ?? keySkills.slice(0, 3).join(" · ");

  const summaryParts = [
    cv.summary,
    keySkills.length > 0
      ? `Core strengths: ${keySkills.slice(0, 6).join(", ")}.`
      : "",
    `Target role: ${job.title} at ${job.company}.`,
  ].filter(Boolean);

  return {
    headline,
    summary: summaryParts.join(" "),
    keySkills,
    experienceBullets,
  };
}

function buildRecommendedResponses(
  job: JobPosting,
  cv: ParsedCv,
  matched: string[],
) {
  const responses: { question: string; answer: string }[] = [];

  if (job.metadata["Employment type"]) {
    responses.push({
      question: "Preferred employment type",
      answer: job.metadata["Employment type"],
    });
  }

  if (job.metadata["Seniority level"]) {
    responses.push({
      question: "Seniority alignment",
      answer: `Aligned with ${job.metadata["Seniority level"]} roles based on ${cv.experienceHighlights.length} notable achievements.`,
    });
  }

  if (matched.length > 0) {
    responses.push({
      question: "Key skills fit",
      answer: `Direct experience with ${matched
        .slice(0, 6)
        .join(", ")} highlighted in CV.`,
    });
  }

  return responses;
}

export function scoreJob(
  cv: ParsedCv,
  job: JobPosting,
): JobMatchResult {
  const { matched, score: keywordScore } = computeKeywordMatch(
    cv.keywords,
    job.description || job.title,
  );
  const experienceScore = scoreDescriptionOverlap(cv, job);
  const recencyBoost = job.listedAt ? 0.1 : 0;

  const matchScore = Math.min(
    1,
    keywordScore * 0.6 + experienceScore * 0.3 + recencyBoost,
  );

  const autofillProfile = buildAutofillProfile(cv, job, matched);
  const recommendedResponses = buildRecommendedResponses(
    job,
    cv,
    matched,
  );

  return {
    ...job,
    matchScore: Number(matchScore.toFixed(3)),
    matchedKeywords: matched,
    coverLetter: "",
    autofillProfile,
    recommendedResponses,
  };
}
