/**
 * Admin authorization helpers for destructive actions (deleting sales, expenses, ...).
 *
 * Kept free of React/Supabase imports so the decision logic can be unit-tested with `npm test`.
 *
 * Two authorization paths exist and they are NOT equivalent:
 *   1. SERVER path  - used for any sale that exists in the cloud. The Postgres function `admin_delete_transaction`
 *                     verifies the caller's session AND the admin secret (bcrypt, throttled). Cannot be bypassed from the
 *                     browser. See supabase-schema-v6-admin-authorization.sql.
 *   2. LOCAL path   - used only for records that never left this device (unsynced offline sales, gas/electronics/expense/
 *                     family records, or an install with no cloud account). The secret is compared with a value kept in
 *                     browser storage, so it only deters casual misuse; it is not a security boundary.
 */

export type DeleteFailureReason =
  | 'invalid_password'
  | 'password_required'
  | 'not_found'
  | 'forbidden'
  | 'locked'
  | 'offline'
  | 'not_configured'
  | 'not_deployed'
  | 'not_signed_in'
  | 'subscription_inactive'
  | 'server_error';

export interface DeleteOutcome {
  ok: boolean;
  reason?: DeleteFailureReason;
  /** Human-readable, safe to show in the UI. Never a generic "incorrect password" for a non-password failure. */
  message: string;
}

export const DELETE_OK: DeleteOutcome = { ok: true, message: 'Deleted.' };

const MESSAGES: Record<DeleteFailureReason, string> = {
  invalid_password: 'Incorrect administrator password.',
  password_required: 'Enter the administrator password to authorize deletion.',
  not_found: 'This record no longer exists on this device. Refresh and try again.',
  forbidden: 'This account is not allowed to delete records for this shop.',
  locked: 'Too many wrong attempts. Deletion is locked for 15 minutes.',
  offline: 'No connection to the server. Synced sales can only be deleted online so the server can verify the password. Try again when connected.',
  not_configured: 'No server admin password is set for this shop yet. The shop owner must set one in Settings before synced sales can be deleted.',
  not_deployed: 'The server is missing the admin-delete update (database migration v6). Ask your administrator to apply it.',
  not_signed_in: 'You are not signed in to the cloud account, so the server cannot authorize this deletion. Sign in and try again.',
  subscription_inactive: 'The subscription is no longer active, so changes are blocked by the server. Renew to delete records.',
  server_error: 'The server could not complete the deletion. Nothing was deleted. Please try again.',
};

export const failure = (reason: DeleteFailureReason, detail?: string): DeleteOutcome => ({
  ok: false,
  reason,
  message: detail ? `${MESSAGES[reason]} (${detail})` : MESSAGES[reason],
});

export interface RemoteDeleteResponse {
  status: string;
  deleted?: number;
  message?: string;
}

/** Maps the JSON returned by `admin_delete_transaction` (or a transport error) to a UI outcome. */
export function outcomeFromRemote(res: RemoteDeleteResponse): DeleteOutcome {
  switch (res.status) {
    case 'ok': return DELETE_OK;
    case 'invalid': return failure('invalid_password');
    case 'locked': return failure('locked');
    case 'not_configured': return failure('not_configured');
    case 'forbidden': return failure('forbidden');
    case 'subscription_inactive': return failure('subscription_inactive');
    case 'offline': return failure('offline');
    case 'not_deployed': return failure('not_deployed');
    case 'not_signed_in': return failure('not_signed_in');
    default: return failure('server_error', res.message);
  }
}

/** Classifies a Supabase/PostgREST/fetch error into a RemoteDeleteResponse status. */
export function classifyRpcError(err: { code?: string; message?: string } | null | undefined): RemoteDeleteResponse {
  if (!err) return { status: 'server_error' };
  const msg = String(err.message || '');
  // Function not found in the schema cache => migration v6 has not been applied to this project.
  if (err.code === 'PGRST202' || err.code === '42883') return { status: 'not_deployed', message: msg };
  // No HTTP status/code and a fetch-style message => the request never reached the server.
  if (!err.code && /failed to fetch|networkerror|network request failed|load failed|timeout|aborted/i.test(msg)) {
    return { status: 'offline', message: msg };
  }
  if (err.code === '42501') return { status: 'forbidden', message: msg };
  return { status: 'server_error', message: msg };
}

export interface LocalAuthContext {
  /** profile.adminPassword (the shop-wide admin password kept in browser storage). */
  profileSecret?: string;
  staff: Array<{ role: string; active: boolean; password?: string }>;
  currentUser?: { role: string; password?: string } | null;
}

/**
 * LOCAL-only check (see file header). Both sides are trimmed so a stray space typed or stored earlier can never
 * produce a false "incorrect password". There is deliberately no hard-coded fallback other than the shipped default,
 * which the app forces new installs to change (SetAdminPasswordModal).
 */
export function checkLocalAdminSecret(input: string | undefined | null, ctx: LocalAuthContext): boolean {
  const typed = (input ?? '').trim();
  if (!typed) return false;
  const norm = (s?: string) => (s ?? '').trim();

  const configured = norm(ctx.profileSecret) || 'admin123';
  if (typed === configured) return true;

  if (ctx.staff.some((u) => u.role === 'admin' && u.active && norm(u.password) !== '' && norm(u.password) === typed)) return true;

  const cu = ctx.currentUser;
  if (cu && (cu.role === 'admin' || cu.role === 'manager') && norm(cu.password) !== '' && norm(cu.password) === typed) return true;

  return false;
}


export interface SaleDeletionDeps {
  /** Supabase credentials are configured for this build. */
  cloudConfigured: boolean;
  /** A Supabase session (signed-in shop member) exists. */
  hasSession: () => Promise<boolean>;
  /** Calls the server function `admin_delete_transaction`. Must not throw. */
  remoteDelete: (secret: string) => Promise<RemoteDeleteResponse>;
  /** True only when this sale exists solely on this device (still queued / never reached the cloud). */
  isLocalOnlySale: () => Promise<boolean>;
  /** Local (browser-storage) comparison; see checkLocalAdminSecret. */
  localCheck: (secret: string) => boolean;
}

/**
 * Decides who is allowed to delete a sale and returns the REAL reason when they are not.
 * ok === true means "authorized: the caller may now remove the sale from local state".
 *
 *  - cloud sale + session  -> the server verifies the secret (bcrypt, throttled) and performs + audits the delete.
 *  - local-only sale       -> browser-side check (not a security boundary, but nothing server-side exists to protect).
 *  - cloud sale, no session / offline / server unconfigured -> refused with an explicit reason (never "wrong password").
 */
export async function authorizeSaleDeletion(secret: string | undefined | null, deps: SaleDeletionDeps): Promise<DeleteOutcome> {
  const typed = (secret ?? '').trim();
  if (!typed) return failure('password_required');

  if (!deps.cloudConfigured) {
    return deps.localCheck(typed) ? DELETE_OK : failure('invalid_password');
  }

  const localOnly = await deps.isLocalOnlySale();
  const signedIn = await deps.hasSession();

  if (!signedIn) {
    if (localOnly) return deps.localCheck(typed) ? DELETE_OK : failure('invalid_password');
    return failure('not_signed_in');
  }

  const outcome = outcomeFromRemote(await deps.remoteDelete(typed));
  if (outcome.ok) return outcome;
  // The server could not be used (offline / no server password yet / migration missing): a sale that never left this
  // device is not on the server, so the local check may authorize removing it. A wrong password is never retried locally.
  const serverUnavailable = ['offline', 'not_configured', 'not_deployed'].includes(outcome.reason ?? '');
  if (serverUnavailable && localOnly) {
    return deps.localCheck(typed) ? DELETE_OK : failure('invalid_password');
  }
  return outcome;
}

const VOID_MESSAGES: Record<string, string> = {
  forbidden: 'Only the shop owner (signed in to the cloud account) can cancel a synced sale.',
  bad_request: 'A reason of at least 3 characters is required to cancel a sale.',
  subscription_inactive: MESSAGES.subscription_inactive,
  not_deployed: 'The server is missing the void update (database migration v7). Ask your administrator to apply it.',
  not_signed_in: MESSAGES.not_signed_in,
};

/** Human-readable text for a failed `admin_void_transaction` response. `offline` is handled by the caller (cancel locally). */
export function voidFailureMessage(res: RemoteDeleteResponse): string {
  return VOID_MESSAGES[res.status] || res.message || 'The server could not cancel this sale. Nothing was changed.';
}
