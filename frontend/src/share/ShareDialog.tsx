import { useEffect, useRef, useState } from 'react'
import { Copy, Download, X } from 'lucide-react'
import '../styles/share.css'
import { Button } from '../components/Button'
import { OverlayFrame } from '../components/OverlayFrame'
import { buildPostText, type ShareData } from './postText'
import { canvasToBlob, CARD_H, CARD_W, renderShareCard } from './renderShareCard'

export const IMAGE_ERROR = 'Could not create the image'
export const COPIED = 'Post text copied.'
export const COPY_FALLBACK = 'Could not copy automatically. Select the text below and copy it.'

export interface ShareDialogProps {
  data: ShareData
  onClose(): void
}

/**
 * Share dialog (Req 15): a preview of the 1200x630 card, Download (PNG through toBlob) and Copy post text. If the
 * clipboard write is rejected the text is shown in a readonly textarea and selected. If the browser cannot encode
 * the PNG, "Could not create the image" is shown. The card is drawn on a canvas from code and self-hosted fonts.
 */
export function ShareDialog({ data, onClose }: ShareDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const text = buildPostText(data)

  useEffect(() => {
    let live = true
    const canvas = canvasRef.current
    if (!canvas) return
    renderShareCard(data, canvas)
      .then(() => live && setDrawn(true))
      .catch(() => live && setError(IMAGE_ERROR))
    return () => {
      live = false
    }
  }, [data])

  useEffect(() => {
    if (fallback) areaRef.current?.select()
  }, [fallback])

  const download = async () => {
    setError(null)
    setStatus(null)
    const canvas = canvasRef.current
    const blob = canvas ? await canvasToBlob(canvas) : null
    if (!blob) {
      setError(IMAGE_ERROR)
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'studydungeon-share-card.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setStatus('Image saved.')
  }

  const copy = async () => {
    setError(null)
    setStatus(null)
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
      setFallback(false)
      setStatus(COPIED)
    } catch {
      setFallback(true)
      setStatus(COPY_FALLBACK)
    }
  }

  return (
    <OverlayFrame
      title="Share your run"
      titleId="share-title"
      initialFocus="button[data-share-download]"
      onEscape={onClose}
      widthClass="max-w-3xl"
      zClass="z-70"
    >
      <div className="sd-share" data-testid="share-dialog">
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className="sd-share__canvas"
          role="img"
          aria-label={`Share card preview. Score ${Math.round(data.score)}. ${data.dungeonName}.`}
          data-ready={drawn ? 'true' : 'false'}
        />
        <div className="sd-share__actions font-(family-name:--font-label)">
          <Button data-share-download onClick={() => void download()}>
            <Download aria-hidden="true" size={16} />
            Download PNG
          </Button>
          <Button variant="secondary" onClick={() => void copy()}>
            <Copy aria-hidden="true" size={16} />
            Copy post text
          </Button>
          <Button variant="secondary" onClick={onClose}>
            <X aria-hidden="true" size={16} />
            Close
          </Button>
        </div>
        <div role="status" aria-live="polite" className="sd-share__status" data-testid="share-status">
          {status}
        </div>
        {error && (
          <p role="alert" className="sd-share__error">
            {error}
          </p>
        )}
        {fallback && (
          <label className="sd-share__fallback">
            <span className="sd-share__fallback-label">Post text</span>
            <textarea ref={areaRef} readOnly rows={5} value={text} onFocus={(e) => e.currentTarget.select()} data-testid="share-fallback" />
          </label>
        )}
      </div>
    </OverlayFrame>
  )
}
