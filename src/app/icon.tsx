import { brandIcon } from "@/lib/brand-icon";

// /icon/32 for browser tabs; /icon/192 and /icon/512 for the installed app.
export function generateImageMetadata() {
  return [32, 192, 512].map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return brandIcon(Number(await id));
}
