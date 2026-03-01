import { env } from "@/lib/env";

export const isSelfHostMode = env.SELFHOST_MODE;

export const isBillingEnabled = !env.DISABLE_BILLING;

export const isAuthEnforced = !env.DISABLE_AUTH;
