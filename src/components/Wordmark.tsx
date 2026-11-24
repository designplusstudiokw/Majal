/**
 * Typographic wordmark until the real logo arrives: the name in bold on a
 * steel plate, like a street sign or the project plaque. Swap this one file
 * for the logo later.
 */
export default function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md bg-steel px-2.5 py-1 font-bold leading-none text-background ${text}`}
    >
      <span lang="ar">مجال</span>
      <span aria-hidden className="h-[0.9em] w-px bg-background/40" />
      <span lang="en" className="tracking-wide">Majal</span>
    </span>
  );
}
