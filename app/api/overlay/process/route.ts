import { NextRequest, NextResponse } from 'next/server'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import path from 'path'

export const dynamic = 'force-dynamic'

// Register font once per cold start
let fontRegistered = false
function ensureFont() {
  if (fontRegistered) return
  try {
    const fontPath = path.join(process.cwd(), 'public/fonts/TikTokSans-VariableFont_opsz_slnt_wdth_wght.ttf')
    GlobalFonts.registerFromPath(fontPath, 'TikTokSans')
    fontRegistered = true
  } catch {
    // Falls back to system font — outline effect still renders correctly
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Word-wrap using actual canvas text metrics — much more accurate than char-count
function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) continue
    const words = para.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
      } else {
        if (line) lines.push(line)
        line = word // push oversized single word as-is
      }
    }
    if (line) lines.push(line)
  }
  return lines.length > 0 ? lines : ['']
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image') as File | null
  const text = (formData.get('text') as string) ?? ''
  const position = (formData.get('position') as string) ?? 'center'

  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  if (!text.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

  try {
    ensureFont()

    const buf = Buffer.from(await file.arrayBuffer())
    const img = sharp(buf)
    const { width: imageWidth = 1080, height: imageHeight = 1920 } = await img.metadata()

    // Scale from the 270px CSS preview reference
    const scale = imageWidth / 270
    const fontSize = Math.round(22 * scale)
    // Stroke: 6px at preview = 6 * scale at full res. Half is inside letter (covered by fill),
    // so ~3 * scale px of visible outline — matches the CSS -webkit-text-stroke: 6px approach.
    const strokeWidth = Math.round(6 * scale)
    const padding = Math.round(16 * scale)
    const lineHeight = Math.round(fontSize * 1.25)
    const cx = imageWidth / 2

    // Create canvas the same size as the image — transparent background
    const canvas = createCanvas(imageWidth, imageHeight)
    const ctx = canvas.getContext('2d')

    ctx.font = `800 ${fontSize}px TikTokSans, Arial Black, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.letterSpacing = `${(-0.3 * scale).toFixed(1)}px`

    const maxWidth = imageWidth - padding * 2
    const lines = wrapText(ctx, text, maxWidth)

    // Calculate Y of first line baseline
    const blockSpan = (lines.length - 1) * lineHeight
    let firstY: number

    switch (position) {
      case 'top': {
        const safeTop = Math.round(150 * (imageHeight / 1920))
        firstY = safeTop + Math.round(fontSize * 0.8)
        break
      }
      case 'bottom': {
        const safeBottom = imageHeight - Math.round(200 * (imageHeight / 1920))
        firstY = safeBottom - blockSpan - Math.round(fontSize * 0.25)
        break
      }
      default: { // center
        firstY = Math.round(imageHeight / 2) - Math.round(blockSpan / 2) + Math.round(fontSize * 0.3)
        break
      }
    }

    // Draw each line: stroke pass first (black outline), then fill pass (white text).
    // lineJoin 'round' prevents sharp spikes at letter corners.
    ctx.lineJoin = 'round'
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = 'rgba(0,0,0,0.95)'
    ctx.fillStyle = 'white'

    lines.forEach((line, i) => {
      const y = firstY + i * lineHeight
      ctx.strokeText(line, cx, y)
      ctx.fillText(line, cx, y)
    })

    // Composite canvas (PNG) onto original image, output as JPEG
    const textLayer = canvas.toBuffer('image/png')
    const output = await img
      .composite([{ input: textLayer, blend: 'over' }])
      .jpeg({ quality: 90 })
      .toBuffer()

    return NextResponse.json({ data: output.toString('base64') })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/overlay/process]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
