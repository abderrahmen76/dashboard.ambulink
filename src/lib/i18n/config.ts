export const locales = ["en", "fr", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeCookieName = "ambulink_clinic_locale";

export const localeStorageKey = "ambulink_clinic_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Executed before first paint so the shell is already LTR/RTL. */
export const localeBootScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${localeCookieName}=(en|fr|ar)/);var l=m?m[1]:(localStorage.getItem("${localeStorageKey}")||"${defaultLocale}");if(l!=="ar"&&l!=="fr"&&l!=="en")l="${defaultLocale}";var d=document.documentElement;d.lang=l;d.dir=l==="ar"?"rtl":"ltr";}catch(e){}})();`;
