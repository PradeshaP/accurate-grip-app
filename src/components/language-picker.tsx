import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";

export function LanguagePicker() {
  const { lang, setLang } = useI18n();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LangCode)}
        className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
