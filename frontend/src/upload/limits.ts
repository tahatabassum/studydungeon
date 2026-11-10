/**
 * Upload rules, worded as the README and the backend state them: PDF, DOCX, PPTX, TXT, PNG and JPEG,
 * at most 15 MB and 30 pages, at least 500 characters of text, at most 5 documents per account.
 * The browser checks here are HINTS to save a round trip. The server decides, and its answer wins.
 */
export const MAX_UPLOAD_MB = 15
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
export const MAX_PAGES = 30
export const MIN_CHARS = 500
export const MAX_DOCUMENTS = 5

export const FORMAT_LABELS = ['PDF', 'DOCX', 'PPTX', 'TXT', 'PNG', 'JPEG'] as const
/** File extensions the picker offers (JPEG covers .jpg and .jpeg). */
export const ACCEPT_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'png', 'jpg', 'jpeg'] as const
/**
 * MIME types next to the extensions: phone pickers use them (image types also offer the camera).
 * They list exactly the same six formats.
 */
export const ACCEPT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
] as const
export const ACCEPT_ATTR = [...ACCEPT_EXTENSIONS.map((e) => `.${e}`), ...ACCEPT_MIME_TYPES].join(',')

export const PHOTO_HINT = 'You can also take a photo of your notes (PNG or JPEG).'

export const FORMATS_TEXT = `Accepted formats: ${FORMAT_LABELS.join(', ')}.`
export const LIMITS_TEXT = `Up to ${MAX_UPLOAD_MB} MB and ${MAX_PAGES} pages, with at least ${MIN_CHARS} characters of text.`

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** A hint about a file the server would refuse, or null. The server stays the judge. */
export function fileHint(file: Pick<File, 'name' | 'size'>): string | null {
  if (!(ACCEPT_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return `That file type is not on the list. ${FORMATS_TEXT}`
  }
  if (file.size > MAX_UPLOAD_BYTES) return `That file is larger than ${MAX_UPLOAD_MB} MB.`
  if (file.size === 0) return 'That file is empty.'
  return null
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
