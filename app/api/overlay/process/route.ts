import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

// Font cached at module level — read once per cold start
let fontData: Buffer | null = null
function loadFont(): Buffer {
  if (fontData) return fontData
  // Satori cannot parse variable fonts — must use a static weight
  const p = path.join(process.cwd(), 'public/fonts/TikTokSans-ExtraBold.ttf')
  fontData = fs.readFileSync(p)
  return fontData
}

// Word-wrap by character count (proportional: bold sans ≈ 0.55× font-size per char)
function wrapText(text: string, charsPerLine: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) continue
    const words = para.trim().split(/\s+/)
    let cur = ''
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word
      if (test.length <= charsPerLine) {
        cur = test
      } else {
        if (cur) lines.push(cur)
        cur = word // oversized word gets its own line
      }
    }
    if (cur) lines.push(cur)
  }
  return lines.length > 0 ? lines : ['']
}

// Satori converts text to <path fill="white" d="..."/> elements.
// Clone each path as a black outline and insert the clones before the
// originals — outline renders behind the white fill, giving the TikTok look.
function addStroke(svg: string, strokeWidth: number): string {
  const strokes: string[] = []
  const re = /<path\b([^>]*)\/>/g
  let m
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1].replace(/\bfill="[^"]*"/, '')
    strokes.push(
      `<path${attrs} fill="rgba(0,0,0,0.95)" stroke="rgba(0,0,0,0.95)" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`
    )
  }
  if (!strokes.length) return svg
  // Insert before first <path> so stroke is drawn beneath the white fill
  const idx = svg.indexOf('<path')
  return svg.slice(0, idx) + strokes.join('') + svg.slice(idx)
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
    const font = loadFont()
    const buf = Buffer.from(await file.arrayBuffer())
    const img = sharp(buf)
    const { width: w = 1080, height: h = 1920 } = await img.metadata()

    // Size & position relative to the 9:16 region TikTok actually shows.
    // The preview mockup cover-crops to 9:16; sizing text off the raw image
    // width makes it balloon when the source isn't 9:16. Computing the visible
    // 9:16 crop keeps burned === preview === native for any aspect ratio.
    const taller = w / h < 9 / 16                     // narrower than 9:16 → full width visible
    const cropW = taller ? w : Math.round(h * 9 / 16)
    const cropH = taller ? Math.round(w * 16 / 9) : h
    const offsetX = Math.round((w - cropW) / 2)
    const offsetY = Math.round((h - cropH) / 2)

    const scale = cropW / 270
    const fontSize = Math.round(20 * scale)
    const strokeWidth = Math.round(4 * scale)  // ~2px visible outline (matches TikTok)
    const padding = Math.round(16 * scale)
    const lineGap = Math.round(fontSize * 0.25) // (lineHeight 1.25 - 1) × fontSize

    // Word-wrap within the visible crop
    const charsPerLine = Math.max(1, Math.floor((cropW - padding * 2) / (fontSize * 0.55)))
    const lines = wrapText(text, charsPerLine)

    // TikTok safe zones scaled from 1080×1920 reference, relative to visible crop
    const safeTop = Math.round(150 * (cropH / 1920))
    const safeBottom = Math.round(200 * (cropH / 1920))

    const justifyContent =
      position === 'top'    ? 'flex-start' :
      position === 'bottom' ? 'flex-end'   : 'center'

    // Build Satori element — each line as its own div for exact spacing control
    const lineElements = lines.map((line, i) => ({
      type: 'div',
      props: {
        style: {
          fontFamily: 'TikTokSans',
          fontWeight: 800,
          fontSize,
          color: 'white',
          textAlign: 'center' as const,
          lineHeight: 1,
          marginTop: i === 0 ? 0 : lineGap,
        },
        children: line,
      },
    }))

    const element = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent,
          width: cropW,
          height: cropH,
          paddingTop: safeTop,
          paddingBottom: safeBottom,
          paddingLeft: padding,
          paddingRight: padding,
        },
        children: lineElements,
      },
    }

    // Satori renders text as SVG <path> elements — no native deps, works on Vercel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const satoriSvg = await satori(element as any, {
      width: cropW,
      height: cropH,
      fonts: [{ name: 'TikTokSans', data: font, weight: 800, style: 'normal' }],
    })

    // Add black stroke paths behind the white fill paths
    const svgWithStroke = addStroke(satoriSvg, strokeWidth)

    // Composite text SVG onto original image and return as JPEG
    const output = await img
      // Place the crop-sized text layer over the centered 9:16 visible region
      .composite([{ input: Buffer.from(svgWithStroke), top: offsetY, left: offsetX, blend: 'over' }])
      .jpeg({ quality: 90 })
      .toBuffer()

    return NextResponse.json({ data: output.toString('base64') })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/overlay/process]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
