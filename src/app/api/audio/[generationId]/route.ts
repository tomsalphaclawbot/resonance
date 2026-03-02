import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getSignedAudioUrl } from "@/lib/r2";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  const { userId, orgId } = await getAuthContext();

  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { generationId } = await params;

  const generation = await prisma.generation.findUnique({
    where: { id: generationId, orgId },
  });

  if (!generation) {
    return new Response("Not found", { status: 404 });
  }

  if (!generation.r2ObjectKey) {
    return new Response("Audio is not available yet", { status: 409 });
  }

  const signedUrl = await getSignedAudioUrl(generation.r2ObjectKey);
  const range = request.headers.get("range");

  const audioResponse = await fetch(signedUrl, {
    headers: range ? { Range: range } : undefined,
  });

  if (!audioResponse.ok && audioResponse.status !== 206) {
    return new Response("Failed to fetch audio", { status: 502 });
  }

  const contentType =
    audioResponse.headers.get("content-type") || "audio/wav";
  const contentLength = audioResponse.headers.get("content-length");
  const acceptRanges = audioResponse.headers.get("accept-ranges");
  const contentRange = audioResponse.headers.get("content-range");

  return new Response(audioResponse.body, {
    status: audioResponse.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      ...(contentLength ? { "Content-Length": contentLength } : {}),
      ...(acceptRanges ? { "Accept-Ranges": acceptRanges } : {}),
      ...(contentRange ? { "Content-Range": contentRange } : {}),
    },
  });
};
