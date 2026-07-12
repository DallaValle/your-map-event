/**
 * Shared result shape for form server actions (useActionState).
 * `null` is the initial state before the first submission.
 */
export type ActionState = { ok: true } | { ok: false; error: string } | null;
