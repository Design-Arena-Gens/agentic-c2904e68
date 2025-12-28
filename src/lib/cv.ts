import path from "node:path";
import type { ParsedCv } from "./types";

const STOP_WORDS = new Set(
  [
    "the",
    "and",
    "for",
    "with",
    "that",
    "from",
    "this",
    "have",
    "your",
    "will",
    "about",
    "into",
    "able",
    "such",
    "over",
    "other",
    "their",
    "they",
    "them",
    "using",
    "skills",
    "experience",
    "professional",
    "summary",
    "work",
    "education",
    "company",
    "role",
    "responsible",
    "duties",
    "projects",
  ].map((word) => word.toLowerCase()),
);

async function bufferFromFile(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse =
    (pdfParseModule as unknown as {
      default?: (buffer: Buffer) => Promise<{ text?: string }>;
    }).default ??
    (pdfParseModule as unknown as (buffer: Buffer) => Promise<{ text?: string }>);

  const parsed = await pdfParse(buffer);
  return parsed.text ?? "";
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

function extractContactInfo(text: string) {
  const emailMatch = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/im,
  );
  const phoneMatch = text.match(
    /(\+\d{1,3}[-. ]?)?\(?\d{2,4}\)?[-. ]?\d{3,4}[-. ]?\d{3,4}/,
  );
  const urlMatches = Array.from(
    text.matchAll(
      /(https?:\/\/|www\.)[^\s]+/gi,
    ),
  ).map((m) => m[0]);

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const nameCandidate = lines.find(
    (line) =>
      /^[A-Z][A-Za-z' -]+$/.test(line) &&
      line.split(" ").length <= 4 &&
      line.length >= 5 &&
      !line.toLowerCase().includes("resume"),
  );

  const locationMatch = text.match(
    /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s?(?:[A-Z]{2}|[A-Z][a-z]+)\b/,
  );

  return {
    name: nameCandidate,
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    location: locationMatch?.[0],
    links: urlMatches.slice(0, 10),
  };
}

function extractSection(text: string, header: RegExp, stopHeaders: RegExp) {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(header);
  if (!match) return "";
  const startIndex = match.index ?? 0;
  const rest = normalized.slice(startIndex);
  const stopMatch = rest.slice(match[0].length).match(stopHeaders);
  const section = stopMatch
    ? rest.slice(0, match[0].length + (stopMatch.index ?? rest.length))
    : rest;
  return section.trim();
}

function extractHighlights(section: string): string[] {
  const lines = section
    .split(/\n+/)
    .map((line) => line.replace(/^[-•\u2022]\s*/, "").trim())
    .filter((line) => line.length >= 4);
  return lines.slice(0, 10);
}

function buildKeywordList(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+.# ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([token]) => token);
}

function summarizeCv(text: string): string {
  const sentences = text
    .replace(/\r\n/g, "\n")
    .split(/[\n.]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.split(" ").length >= 5);

  const topSentences = sentences.slice(0, 3);
  return topSentences.join(". ");
}

export async function parseCvFile(file: File): Promise<ParsedCv> {
  if (!file || file.size === 0) {
    throw new Error("Please provide a non-empty CV file.");
  }

  const buffer = await bufferFromFile(file);
  const ext = path.extname(file.name).toLowerCase();

  let rawText = "";
  if (ext === ".pdf") {
    rawText = await extractPdfText(buffer);
  } else if (ext === ".docx") {
    rawText = await extractDocxText(buffer);
  } else if (ext === ".txt") {
    rawText = buffer.toString("utf-8");
  } else {
    throw new Error("Unsupported CV format. Please upload PDF, DOCX, or TXT.");
  }

  const contact = extractContactInfo(rawText);
  const experienceSection = extractSection(
    rawText,
    /(professional\s+)?experience/i,
    /(education|skills|projects|certifications)/i,
  );
  const educationSection = extractSection(
    rawText,
    /education/i,
    /(experience|skills|projects|certifications)/i,
  );

  const experienceHighlights = extractHighlights(experienceSection);
  const educationHighlights = extractHighlights(educationSection);

  const keywords = buildKeywordList(rawText);
  const summary = summarizeCv(rawText);

  return {
    rawText,
    summary,
    keywords,
    experienceHighlights,
    educationHighlights,
    contact,
  };
}
