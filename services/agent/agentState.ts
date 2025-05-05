import logger from "../utils/logger.js";

interface AgentState {
  isIdle: boolean;
  currentActionDescription?: string;
}

// In-memory state for simplicity
let agentState: AgentState = {
  isIdle: true,
};

export function getAgentState(): Readonly<AgentState> {
  return { ...agentState };
}

export function setAgentState(newState: Partial<AgentState>): void {
  const previousIdle = agentState.isIdle;
  agentState = { ...agentState, ...newState };
  if (previousIdle !== agentState.isIdle) {
    logger.info(`Agent state changed: ${agentState.isIdle ? "Idle" : "Busy"}`);
  }
}

// Initialize state explicitly
setAgentState({ isIdle: true });
