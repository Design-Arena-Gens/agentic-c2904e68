import type { JobPosting, ParsedCv } from "./types";

function firstNameFromFull(name?: string) {
  if (!name) return "Hello";
  const [first] = name.split(" ");
  return first;
}

function extractTopExperience(experience: string[]) {
  return experience.slice(0, 2).map((entry, index) => {
    const cleaned = entry.replace(/^(?:-|\u2022)\s*/, "").trim();
    return `${index + 1}. ${cleaned}`;
  });
}

export function generateCoverLetter(
  cv: ParsedCv,
  job: JobPosting,
): string {
  const greeting = `Hi ${job.company || "there"},`;
  const intro = `${firstNameFromFull(cv.contact.name)} here — an applicant for the ${job.title} role.`;
  const strengths =
    cv.keywords.slice(0, 4).length > 0
      ? `I bring hands-on strength in ${cv.keywords
          .slice(0, 4)
          .join(", ")} that map tightly to the scope outlined.`
      : "";

  const experienceLines = extractTopExperience(cv.experienceHighlights);
  const experienceBlock =
    experienceLines.length > 0
      ? `Recent highlights:\n${experienceLines.join("\n")}`
      : "";

  const closing = [
    job.workplaceType
      ? `Comfortable with the ${job.workplaceType.toLowerCase()} setup.`
      : "",
    "Ready to move quickly on next steps.",
    "Thanks for the consideration!",
  ]
    .filter(Boolean)
    .join(" ");

  return [greeting, intro, strengths, experienceBlock, closing]
    .filter((block) => block && block.trim().length > 0)
    .join("\n\n");
}
