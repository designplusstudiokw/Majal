import type { Locale } from "./config";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import type { Dictionary } from "./dictionaries/en";

export type { Dictionary };
export const getDictionary = (lang: Locale): Dictionary =>
  lang === "ar" ? ar : en;
