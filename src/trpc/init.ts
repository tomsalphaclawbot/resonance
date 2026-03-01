import * as Sentry from "@sentry/node";
import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { isAuthEnforced, isSelfHostMode } from "@/lib/runtime-flags";

const SELFHOST_DEFAULT_USER_ID = "selfhost-user";
const SELFHOST_DEFAULT_ORG_ID = "selfhost-org";

async function getAuthContext() {
  if (!isAuthEnforced || isSelfHostMode) {
    return {
      userId: SELFHOST_DEFAULT_USER_ID,
      orgId: SELFHOST_DEFAULT_ORG_ID,
    };
  }

  return auth();
}

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return {};
});

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput: true,
  }),
);

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(sentryMiddleware);

// Authenticated procedure - calls auth() only when needed
export const authProcedure = baseProcedure.use(async ({ next }) => {
  const { userId } = await getAuthContext();

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: { userId },
  });
});

// Organization procedure - requires userId and orgId
export const orgProcedure = baseProcedure.use(async ({ next }) => {
  const { userId, orgId } = await getAuthContext();

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization required",
    });
  }

  return next({ ctx: { userId, orgId } });
});
