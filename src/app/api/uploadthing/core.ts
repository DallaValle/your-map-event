import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/session";

const f = createUploadthing();

/**
 * Uploads are only accepted from team admins. The uploaded URL is associated
 * with a team/POI later via a server action, which runs its own requireAdmin
 * check — so this middleware only needs to gate *who may upload at all*.
 */
async function requireAdminUploader(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new UploadThingError("Sign in required");

  const ctx = await auth.$context;
  const members = await ctx.adapter.findMany<{ role: string }>({
    model: "member",
    where: [{ field: "userId", value: session.user.id }],
  });
  if (!members.some((m) => isAdminRole(m.role))) {
    throw new UploadThingError("Admin role required");
  }

  return { userId: session.user.id };
}

export const ourFileRouter = {
  teamLogo: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => requireAdminUploader(req))
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl })),

  poiImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => requireAdminUploader(req))
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
