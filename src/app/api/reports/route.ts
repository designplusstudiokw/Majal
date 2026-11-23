import { MAX_PHOTOS, MAX_PHOTO_BYTES, reportSchema } from "@/lib/domain";
import { sniffImageType } from "@/lib/image-sniff";
import { repo } from "@/lib/repo";
import type { NewPhoto } from "@/lib/repo/types";

// POST /api/reports  (multipart/form-data)
// A plain HTTP endpoint on purpose: the future mobile app can call it too.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field.
  if (form.get("website")) {
    return Response.json({ error: "rejected" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse({
    lat: form.get("lat"),
    lng: form.get("lng"),
    problem: form.get("problem"),
    fix: form.get("fix") || undefined,
    title: form.get("title"),
    description: form.get("description"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "validation", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS) {
    return Response.json({ error: "too_many_photos" }, { status: 422 });
  }

  const photos: NewPhoto[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "photo_too_large" }, { status: 422 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = sniffImageType(bytes);
    if (!contentType) {
      return Response.json({ error: "photo_type" }, { status: 422 });
    }
    photos.push({ bytes, contentType });
  }

  const project = await repo.createProject(parsed.data, photos);
  return Response.json({ code: project.code }, { status: 201 });
}
