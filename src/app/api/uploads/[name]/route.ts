import { repo } from "@/lib/repo";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/uploads/[name]">,
) {
  const { name } = await ctx.params;
  const photo = await repo.readPhoto(name);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      "Content-Type": photo.contentType,
      // File names are random and never reused, so they can be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
