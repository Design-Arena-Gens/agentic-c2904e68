import { load } from "cheerio";
import type { JobPosting, JobSearchParams } from "./types";

const LINKEDIN_BASE = "https://www.linkedin.com";

const workplaceMap: Record<
  NonNullable<JobSearchParams["remoteFilter"]>,
  string | undefined
> = {
  remote: "2",
  onsite: "1",
  hybrid: "3",
  any: undefined,
};

const experienceLevelMap: Record<string, string> = {
  internship: "1",
  entry: "2",
  associate: "3",
  mid: "4",
  senior: "5",
  director: "6",
  executive: "7",
};

function buildSearchUrl(params: JobSearchParams, start = 0) {
  const searchParams = new URLSearchParams();
  searchParams.set("keywords", params.keywords);
  if (params.location) {
    searchParams.set("location", params.location);
  }
  searchParams.set("start", start.toString());
  searchParams.set("refresh", "true");

  const workplaceFilter = params.remoteFilter
    ? workplaceMap[params.remoteFilter]
    : undefined;
  if (workplaceFilter) {
    searchParams.set("f_WT", workplaceFilter);
  }

  if (params.experienceLevels && params.experienceLevels.length > 0) {
    const codes = params.experienceLevels
      .map((level) => experienceLevelMap[level.toLowerCase()] ?? "")
      .filter(Boolean);
    if (codes.length > 0) {
      searchParams.set("f_E", codes.join(","));
    }
  }

  return `${LINKEDIN_BASE}/jobs-guest/jobs/api/seeMoreJobPostings/search?${searchParams.toString()}`;
}

function sanitizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function fetchJobDetails(url: string): Promise<{
  description: string;
  metadata: Record<string, string>;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to load job details (${response.status})`);
    }

    const html = await response.text();
    const $ = load(html);
    let description = sanitizeText(
      $(".decorated-job-posting__details-content")
        .text()
        .replace(/Show more/gi, ""),
    );

    if (!description) {
      description = sanitizeText(
        $("#job-details").text().replace(/Show more/gi, ""),
      );
    }

    if (!description) {
      description = sanitizeText(
        $("meta[name='description']").attr("content") ?? "",
      );
    }

    const metadata: Record<string, string> = {};
    $(".description__job-criteria-item")
      .each((_, element) => {
        const label = sanitizeText(
          $(element).find(".description__job-criteria-subheader").text(),
        );
        const value = sanitizeText(
          $(element).find(".description__job-criteria-text").text(),
        );
        if (label && value) {
          metadata[label] = value;
        }
      });

    return { description, metadata };
  } catch {
    return {
      description: "",
      metadata: {},
    };
  }
}

export async function fetchLinkedInJobs(
  params: JobSearchParams,
  limit = 15,
): Promise<JobPosting[]> {
  const results: JobPosting[] = [];

  for (let start = 0; start < limit; start += 25) {
    const url = buildSearchUrl(params, start);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      break;
    }

    const html = await response.text();
    if (!html.trim()) {
      break;
    }

    const $ = load(html);
    const jobCards = $("li");

    if (jobCards.length === 0) {
      break;
    }

    jobCards.each((_, element) => {
      if (results.length >= limit) {
        return false;
      }
      const jobId = $(element).attr("data-occludable-job-id") ?? "";
      const title = sanitizeText($(element).find("h3").text());
      const company = sanitizeText(
        $(element).find(".base-search-card__subtitle").text(),
      );
      const location = sanitizeText(
        $(element).find(".job-search-card__location").text(),
      );
      const listedAt = sanitizeText(
        $(element).find("time").attr("datetime") ?? "",
      );
      const workplaceType = sanitizeText(
        $(element).find(".job-search-card__workplace-type").text(),
      );

      let jobUrl = $(element).find("a.base-card__full-link").attr("href") ?? "";
      if (jobUrl.startsWith("/")) {
        jobUrl = `${LINKEDIN_BASE}${jobUrl}`;
      }
      jobUrl = jobUrl.split("?")[0];

      if (!jobId || !title || !jobUrl) {
        return;
      }

      results.push({
        jobId,
        title,
        company,
        location,
        listedAt,
        url: jobUrl,
        workplaceType,
        description: "",
        metadata: {},
      });
    });
  }

  for (let i = 0; i < results.length; i += 1) {
    const job = results[i];
    const details = await fetchJobDetails(job.url);
    results[i] = {
      ...job,
      description: details.description,
      metadata: details.metadata,
    };
  }

  return results;
}
