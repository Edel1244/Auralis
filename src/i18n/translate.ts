import type { Locale } from "./config";
import en from "./messages/en";
import tr from "./messages/tr";

export type Messages = typeof en;

/** Dotted key paths into the message tree, e.g. "nav.home". */
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Messages>;

export type TranslateParams = Record<string, string | number>;
export type TFunction = (key: MessageKey, params?: TranslateParams) => string;

const dictionaries: Record<Locale, Messages> = { en, tr };

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Creates a translator. Missing keys fall back to English, then to the key itself.
 * Supports `{name}` interpolation and simple plurals: `{count, plural, one {# track} other {# tracks}}`.
 */
export function createTranslator(locale: Locale): TFunction {
  const dict = dictionaries[locale] ?? en;
  return (key, params) => {
    let text = lookup(dict, key) ?? lookup(en, key) ?? key;
    if (!params) return text;
    text = text.replace(
      /\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g,
      (_m, name: string, one: string, other: string) => {
        const n = Number(params[name] ?? 0);
        return (n === 1 ? one : other).replace("#", String(n));
      },
    );
    return text.replace(/\{(\w+)\}/g, (m, name: string) =>
      params[name] !== undefined ? String(params[name]) : m,
    );
  };
}
