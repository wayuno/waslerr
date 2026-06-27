import { LANGS, setLang, useLang } from '../lib/i18n'
import { useT } from '../lib/i18n'

// Segmented language control — EN · RU · ZH.
// Used at the bottom of the mobile menu drawer and in the footer.
export default function LanguageSwitcher() {
  const t = useT()
  const code = useLang()

  return (
    <div className="wf-lang">
      <div className="wf-lang-label">{t('menu.language')}</div>
      <div className="wf-lang-seg" role="group" aria-label={t('menu.language')}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            aria-pressed={l.code === code}
            className={`wf-lang-pill${l.code === code ? ' active' : ''}`}
            onClick={() => setLang(l.code)}
          >
            {l.short}
          </button>
        ))}
      </div>
    </div>
  )
}
