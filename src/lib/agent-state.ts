import type { AgentResult } from "./types";

export interface AgentState {
  status: "idle" | "running" | "completed" | "error";
  message?: string;
  result: AgentResult | null;
}

export const initialAgentState: AgentState = {
  status: "idle",
  result: null,
};
