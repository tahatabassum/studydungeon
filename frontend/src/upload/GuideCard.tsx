import { BookOpenCheck, Compass, ScanSearch, ScrollText, Upload } from 'lucide-react'

const STEPS = [
  { Icon: Upload, title: 'Upload', text: 'Send one file of your own study notes.' },
  { Icon: ScrollText, title: 'Read', text: 'The crypt keeper pulls the text out of it.' },
  { Icon: BookOpenCheck, title: 'Check relevance', text: 'Only real study material gets in.' },
  { Icon: ScanSearch, title: 'Detect topics', text: 'Two to six topics are found in your notes.' },
  { Icon: Compass, title: 'Summon floors', text: 'Each topic becomes a floor with monsters.' },
] as const

/** Static, decorative guide that fills the left column under the file rules. */
export function GuideCard() {
  return (
    <section className="sd-up__guide" data-testid="upload-guide" aria-label="How your dungeon is built">
      <h2 className="sd-up__guide-h">How your dungeon is built</h2>
      <ol className="sd-up__guide-list">
        {STEPS.map(({ Icon, title, text }) => (
          <li key={title}>
            <span className="sd-up__guide-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="sd-up__guide-copy">
              <strong>{title}</strong>
              <span className="sd-up__guide-text">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="sd-up__guide-tip">Tip: clear headings and one subject per file make the best floors.</p>
    </section>
  )
}
