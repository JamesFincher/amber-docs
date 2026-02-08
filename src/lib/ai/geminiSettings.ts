export const GEMINI_API_KEY_STORAGE_KEY = "amber-docs:ai:gemini:key:v1";
export const GEMINI_MODEL_STORAGE_KEY = "amber-docs:ai:gemini:model:v1";

export const DEFAULT_GEMINI_FLASH_MODEL = "gemini-3-flash";
export const DEFAULT_GEMINI_PRO_MODEL = "gemini-3-pro";

export const FALLBACK_GEMINI_MODEL = DEFAULT_GEMINI_FLASH_MODEL;

export const GEMINI_MODEL_PRESETS: string[] = [
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_PRO_MODEL,
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export function defaultGeminiModel(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL ?? "").trim();
  return fromEnv || FALLBACK_GEMINI_MODEL;
}

export function readGeminiSettings(): { apiKey: string; model: string } {
  try {
    const apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ?? "";
    const model = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) ?? "";
    return { apiKey, model };
  } catch {
    return { apiKey: "", model: "" };
  }
}

export function writeGeminiSettings(args: { apiKey: string; model: string }): boolean {
  try {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, args.apiKey);
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, args.model);
    return true;
  } catch {
    return false;
  }
}
