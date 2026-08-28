import { redirect } from "next/navigation";

export type ActionResult = { ok: true } | { ok: false; message: string };

export function actionOk(): ActionResult {
  return { ok: true };
}

export function actionFail(message: string): ActionResult {
  return { ok: false, message };
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "object" && err && "code" in err) {
    const code = String((err as { code?: string }).code ?? "");
    if (code === "P2002") {
      return "A unique number (membership or allotment) is already in use. Retry to allocate the next free number.";
    }
  }
  if (err instanceof Error && err.message) {
    if (/unique constraint/i.test(err.message) && /membership|allotment/i.test(err.message)) {
      return "A unique number (membership or allotment) is already in use. Retry to allocate the next free number.";
    }
    return err.message;
  }
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

/** Next.js redirect/notFound throw special errors that must propagate. */
export function isNextNavigationError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("digest" in err)) return false;
  const digest = String((err as { digest?: string }).digest ?? "");
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

export function redirectWithError(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** Wrap a FormData action for useActionState. */
export function bindFormAction(
  action: (formData: FormData) => Promise<ActionResult | void>
): (prev: ActionResult | null, formData: FormData) => Promise<ActionResult> {
  return async (_prev, formData) => {
    try {
      const result = await action(formData);
      if (result && result.ok === false) return result;
      return actionOk();
    } catch (err) {
      if (isNextNavigationError(err)) throw err;
      return actionFail(getErrorMessage(err));
    }
  };
}

export async function runRedirectAction(returnPath: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
    throw new Error("runRedirectAction: expected redirect");
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}
