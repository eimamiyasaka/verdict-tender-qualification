import { EmptyState } from "@/components/common/layout";
import { TaskCard } from "@/components/tender/task-card";
import { AddTaskForm } from "@/components/tender/add-task-form";
import { pluralise } from "@/lib/format";
import type { OrgRole, TenderDetail, User, WorkspaceTask } from "@/lib/types";

/**
 * Workspace (§10.2): renders only when status = bidding. ITT questions as
 * task cards with assignee, status, word limit, live word count and
 * Suggest from library.
 */
export function WorkspaceTab({
  detail,
  tasks,
  members,
  closed,
  now,
}: {
  detail: TenderDetail;
  tasks: WorkspaceTask[];
  members: Array<User & { role: OrgRole }>;
  closed: boolean;
  now: Date;
}) {
  const { tender } = detail;
  if (tender.status !== "bidding") {
    const canMark = tender.status === "assessed" && Boolean(detail.latestAssessment);
    return (
      <EmptyState
        title="This tender hasn't been marked as a bid yet."
        body={
          canMark
            ? "Use Mark as bid in the header to open the workspace. Every ITT question becomes a task with an owner, a status and a word-limited draft."
            : tender.status === "submitted" || tender.status === "won" || tender.status === "lost"
              ? "The bid has been submitted, so the workspace is closed."
              : "Run the assessment first. Once there is a verdict, Mark as bid opens the workspace."
        }
      />
    );
  }

  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const inReview = tasks.filter((t) => t.status === "in_review").length;
  const complete = tasks.filter((t) => t.status === "complete").length;
  const unassigned = tasks.filter((t) => !t.assigneeId).length;

  return (
    <div className="flex flex-col gap-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink/80">
        <span className="tabular">{pluralise(tasks.length, "task")}</span>
        <span aria-hidden className="font-mono text-ink/40">·</span>
        <span className="tabular">{inProgress} in progress</span>
        <span aria-hidden className="font-mono text-ink/40">·</span>
        <span className="tabular">{inReview} in review</span>
        <span aria-hidden className="font-mono text-ink/40">·</span>
        <span className="tabular">{complete} complete</span>
        {unassigned > 0 ? (
          <>
            <span aria-hidden className="font-mono text-ink/40">·</span>
            <span className="tabular text-pending">{unassigned} unassigned</span>
          </>
        ) : null}
      </p>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet."
          body="The pack had no ITT questions to turn into tasks. Add one below for anything else the bid needs."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} members={members} tenderId={tender.id} closed={closed} now={now} />
          ))}
        </ul>
      )}

      {!closed ? <AddTaskForm tenderId={tender.id} members={members} /> : null}
    </div>
  );
}
