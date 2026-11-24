/** Public address of the site, used for absolute links in previews. */
export const SITE_URL = new URL(process.env.SITE_URL ?? "https://ma-jal.com");
export const SITE_NAME = "Majal · مجال";
export const ogLocale = (lang: string) => (lang === "ar" ? "ar_KW" : "en_GB");
