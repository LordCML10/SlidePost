import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

// Module-level cache — font is read once per cold start
let fontBase64: string | null = null

function loadFont(): string {
  if (fontBase64 !== null) return fontBase64
  try {
    const p = path.join(process.cwd(), 'public/fonts/TikTokSans-VariableFont_opsz_slnt_wdth_wght.ttf')
    fontBase64 = fs.readFileSync(p).toString('base64')
  } catch {
    // Font unavailable — Sharp will fall back to a system bold sans-serif.
    // The outline effect will still look correct.
    fontBase64 = ''
  }
  return fontBase64
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Word-wrap — respects explicit \n from textarea, wraps long lines at word boundaries
function wrapText(text: string, charsPerLine: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) continue
    const words = para.trim().split(/\s+/)
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= charsPerLine) {
        current = candidate
      } else {
        if (current) lines.push(current)
        current = word // single word longer than limit — push it anyway
      }
    }
    if (current) lines.push(current)
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
    const buf = Buffer.from(await file.arrayBuffer())
    const img = sharp(buf)
    const { width: imageWidth = 1080, height: imageHeight = 1920 } = await img.metadata()

    // Scale all values proportionally from the 270px CSS preview
    const scale = imageWidth / 270
    const fontSize = Math.round(22 * scale)
    const strokeWidth = Math.round(6 * scale)   // 3px * 2 → covers all 8 shadow directions
    const padding = Math.round(16 * scale)
    const lineHeight = Math.round(fontSize * 1.25)
    const letterSpacing = +(-0.3 * scale).toFixed(1)
    const cx = imageWidth / 2

    // Bold sans-serif chars are ≈ 0.55× font-size wide — approximate wrap point
    const charsPerLine = Math.max(1, Math.floor((imageWidth - padding * 2) / (fontSize * 0.55)))
    const lines = wrapText(text, charsPerLine)

    // Calculate baseline Y of first line
    const blockSpan = (lines.length - 1) * lineHeight // distance first→last baseline
    let firstY: number

    switch (position) {
      case 'top': {
        // Safe zone: 150px from top on a 1920px-tall image, scaled to actual height
        const safeTop = Math.round(150 * (imageHeight / 1920))
        firstY = safeTop + Math.round(fontSize * 0.8)
        break
      }
      case 'bottom': {
        // Safe zone: 200px from bottom on a 1920px-tall image, scaled to actual height
        const safeBottom = imageHeight - Math.round(200 * (imageHeight / 1920))
        // Anchor last baseline at safeBottom, step first baseline back up
        firstY = safeBottom - blockSpan - Math.round(fontSize * 0.25)
        break
      }
      default: { // center
        firstY = Math.round(imageHeight / 2) - Math.round(blockSpan / 2) + Math.round(fontSize * 0.3)
        break
      }
    }

    // tspan elements — shared between stroke pass and fill pass
    const tspans = lines
      .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
      .join('')

    const commonAttrs = `
      x="${cx}" y="${firstY}"
      text-anchor="middle"
      font-family="TikTokSans, 'Arial Black', sans-serif"
      font-weight="800"
      font-size="${fontSize}"
      letter-spacing="${letterSpacing}"
    `.trim()

    // Embed font as base64 so librsvg can use it — gracefully omitted if file missing
    const font64 = loadFont()
    const fontFace = font64
      ? `<defs><style>@font-face{font-family:'TikTokSans';src:url('data:font/truetype;base64,${font64}');font-weight:100 900;}</style></defs>`
      : ''

    // Double-render: stroke pass first (black outline), fill pass on top (white text).
    // This is more compatible than paint-order across librsvg versions.
    const svg = `<svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
  ${fontFace}
  <text ${commonAttrs}
    fill="rgba(0,0,0,0.95)"
    stroke="rgba(0,0,0,0.95)"
    stroke-width="${strokeWidth}"
    stroke-linejoin="round"
  >${tspans}</text>
  <text ${commonAttrs} fill="white">${tspans}</text>
</svg>`

    const output = await img
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .jpeg({ quality: 90 })
      .toBuffer()

    return NextResponse.json({ data: output.toString('base64') })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/overlay/process]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
