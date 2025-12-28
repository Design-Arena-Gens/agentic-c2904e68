'use client';

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { AgentState } from "@/lib/agent-state";
import type { JobMatchResult } from "@/lib/types";

type AgentClientProps = {
  action: (state: AgentState, formData: FormData) => Promise<AgentState>;
  initialState: AgentState;
};

function SubmitButton({
  onPending,
}: {
  onPending: (pending: boolean) => void;
}) {
  const status = useFormStatus();
  useEffect(() => {
    onPending(status.pending);
  }, [status.pending, onPending]);
  return (
    <button
      type="submit"
      className="primary"
      disabled={status.pending}
    >
      {status.pending ? "Running agent..." : "Run LinkedIn Auto-Apply"}
    </button>
  );
}

function JobCard({ job }: { job: JobMatchResult }) {
  const matchPercent = Math.round(job.matchScore * 100);
  return (
    <article className="job-card">
      <header className="job-card__header">
        <div>
          <h3>{job.title}</h3>
          <p className="job-card__company">
            {job.company} — {job.location}
          </p>
        </div>
        <div className="job-card__score">
          <span>{matchPercent}% match</span>
        </div>
      </header>

      <section className="job-card__section">
        <h4>Auto-filled profile snapshot</h4>
        <p className="job-card__headline">{job.autofillProfile.headline}</p>
        <p>{job.autofillProfile.summary}</p>
        {job.autofillProfile.keySkills.length > 0 && (
          <p>
            <strong>Skills:</strong> {job.autofillProfile.keySkills.join(", ")}
          </p>
        )}
        {job.autofillProfile.experienceBullets.length > 0 && (
          <ul>
            {job.autofillProfile.experienceBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="job-card__section">
        <h4>Tailored cover note</h4>
        <pre className="job-card__cover-note">{job.coverLetter}</pre>
      </section>

      {job.recommendedResponses.length > 0 && (
        <section className="job-card__section">
          <h4>Suggested quick responses</h4>
          <ul>
            {job.recommendedResponses.map((response) => (
              <li key={response.question}>
                <strong>{response.question}:</strong> {response.answer}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="job-card__footer">
        <a href={job.url} target="_blank" rel="noopener noreferrer">
          View job on LinkedIn
        </a>
        {job.matchedKeywords.length > 0 && (
          <p className="job-card__keywords">
            <strong>Matched keywords:</strong>{" "}
            {job.matchedKeywords.slice(0, 12).join(", ")}
          </p>
        )}
      </footer>
    </article>
  );
}

export default function AgentClient({
  action,
  initialState,
}: AgentClientProps) {
  const [state, formAction] = useFormState(action, initialState);
  const [pending, setPending] = useState(false);

  const jobs = useMemo(
    () => state.result?.jobs ?? [],
    [state.result?.jobs],
  );

  return (
    <div className="layout">
      <section className="panel panel--form">
        <header>
          <h1>LinkedIn Auto-Apply Agent</h1>
          <p>
            Upload your CV and let the agent surface the best-fit roles, prep
            autofill data, and generate tailored cover notes using only your CV.
          </p>
        </header>

        <form action={formAction}>
          <label className="field">
            <span>Resume / CV (PDF, DOCX, TXT)</span>
            <input name="cv" type="file" accept=".pdf,.docx,.txt" required />
          </label>

          <label className="field">
            <span>Role keywords</span>
            <input
              name="keywords"
              type="text"
              placeholder="e.g. Frontend Engineer React"
              required
            />
          </label>

          <label className="field">
            <span>Location (optional)</span>
            <input
              name="location"
              type="text"
              placeholder="e.g. San Francisco Bay Area"
            />
          </label>

          <label className="field">
            <span>Workplace preference</span>
            <select name="remoteFilter" defaultValue="any">
              <option value="any">No preference</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </label>

          <fieldset className="field">
            <legend>Experience focus</legend>
            <div className="field__checkboxes">
              {[
                ["entry", "Entry / New grad"],
                ["associate", "Associate"],
                ["mid", "Mid-level"],
                ["senior", "Senior"],
                ["director", "Director"],
              ].map(([value, label]) => (
                <label key={value} className="checkbox">
                  <input type="checkbox" name="experienceLevels" value={value} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton onPending={setPending} />

          {state.status === "error" && (
            <p className="error">{state.message}</p>
          )}
        </form>
      </section>

      <section className="panel panel--results">
        <header>
          <h2>Matched roles</h2>
          <p>
            {pending
              ? "Scanning LinkedIn job boards…"
              : state.status === "completed"
              ? `Top ${jobs.length} roles ranked by CV fit.`
              : "Results will appear here once the agent finishes."}
          </p>
        </header>

        <div className="results">
          {pending && <p className="loading">Running agent…</p>}
          {state.status === "completed" && jobs.length === 0 && (
            <p>No relevant roles found. Try broadening the search keywords.</p>
          )}
          {jobs.map((job) => (
            <JobCard key={job.jobId} job={job} />
          ))}
        </div>
      </section>
    </div>
  );
}
