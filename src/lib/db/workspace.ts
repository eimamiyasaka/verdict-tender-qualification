/**
 * Compatibility surface for the workspace screens on `main`.
 *
 * `tasks.ts` and `responses.ts` are canonical — the workspace was one module
 * while the data layer was an in-memory store, and `/tenders/[id]` and
 * `src/lib/actions/workspace.ts` import from here. Nothing new belongs in this
 * file; it re-exports and nothing else, so there is one implementation of each
 * function rather than two that can drift.
 */

export { createTask, getTask, listWorkspaceTasks, updateTask, toBidTask } from "./tasks";
export type { NewTaskInput, TaskPatch } from "./tasks";

export { getResponse, listResponses, saveResponse, toResponse } from "./responses";
