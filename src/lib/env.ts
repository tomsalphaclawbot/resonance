import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

const optionalNonEmptyString = z.string().trim().min(1).optional();

export const env = createEnv({
  server: {
    SELFHOST_MODE: z.coerce.boolean().default(false),
    DISABLE_AUTH: z.coerce.boolean().default(false),
    DISABLE_BILLING: z.coerce.boolean().default(false),

    POLAR_ACCESS_TOKEN: optionalNonEmptyString,
    POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_PRODUCT_ID: z.string().default("selfhost-default-product"),

    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().url().default("http://localhost:3000"),

    R2_ACCOUNT_ID: z.string().default("selfhost-local"),
    R2_ACCESS_KEY_ID: z.string().default("selfhost-local"),
    R2_SECRET_ACCESS_KEY: z.string().default("selfhost-local"),
    R2_BUCKET_NAME: z.string().default("resonance-audio"),
    S3_ENDPOINT: optionalNonEmptyString,
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

    CHATTERBOX_API_URL: z.string().url().default("http://localhost:8000"),
    CHATTERBOX_API_KEY: z.string().default("selfhost-local"),
  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
