/** Fill {placeholders} in a dictionary string. Dictionaries hold plain
 *  strings only, so they can be passed to client components. */
export const fmt = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
