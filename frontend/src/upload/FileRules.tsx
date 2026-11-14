import { FORMAT_LABELS, PHOTO_HINT, UPLOAD_LIMITS, type UploadLimits } from './limits'

/** The rule lines, built from the limits module (the only place with numbers). */
export function ruleLines(limits: UploadLimits = UPLOAD_LIMITS): string[] {
  const n = (v: number) => v.toLocaleString('en-US')
  return [
    `Formats: ${FORMAT_LABELS.join(', ')}`,
    `Up to ${limits.maxMb} MB`,
    `PDF up to ${limits.maxPdfPages} pages`,
    `PPTX up to ${limits.maxSlides} slides`,
    `DOCX up to ${n(limits.maxDocxChars)} characters`,
    `At least ${limits.minTextChars} characters of text`,
  ]
}

/** Compact list of what the server accepts. Sits in the left column on desktop. */
export function FileRules() {
  return (
    <section className="sd-up__rules" aria-label="File rules" data-testid="file-rules">
      <h2 className="sd-up__rules-h">File rules</h2>
      <ul className="sd-up__rules-list">
        {ruleLines().map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="sd-up__rules-note">{PHOTO_HINT}</p>
    </section>
  )
}
