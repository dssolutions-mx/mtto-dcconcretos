import type { GapEvidencePhoto } from '@/lib/diesel/gap-email/load-gap-evidence'

export type MailPayload = {
  to: string[]
  cc?: string[]
  subject: string
  html: string
  evidencePhotos?: GapEvidencePhoto[]
}

type SendGridAttachment = {
  content: string
  type: string
  filename: string
  disposition: 'inline' | 'attachment'
  content_id?: string
}

function guessImageType(url: string, headerType: string | null): string {
  if (headerType?.startsWith('image/')) return headerType
  const lower = url.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export async function embedEvidenceInlineAttachments(
  html: string,
  photos: GapEvidencePhoto[],
): Promise<{ html: string; attachments: SendGridAttachment[] }> {
  const attachments: SendGridAttachment[] = []
  let nextHtml = html
  const seenUrls = new Map<string, string>()

  for (const photo of photos) {
    const url = photo.photoUrl?.trim()
    if (!url || seenUrls.has(url)) continue

    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length === 0) continue

      const contentId = `gap-evidence-${photo.id}`
      const type = guessImageType(url, res.headers.get('content-type'))
      attachments.push({
        content: buffer.toString('base64'),
        type,
        filename: `${photo.transactionCode}-${photo.id}.jpg`,
        disposition: 'inline',
        content_id: contentId,
      })
      seenUrls.set(url, contentId)
      nextHtml = nextHtml.split(url).join(`cid:${contentId}`)
    } catch {
      /* keep public URL fallback in HTML */
    }
  }

  return { html: nextHtml, attachments }
}

export async function sendDieselGapMail(payload: MailPayload): Promise<void> {
  const key = process.env.SENDGRID_API_KEY
  const from =
    process.env.DIESEL_GAP_FROM_EMAIL ||
    process.env.COMPLIANCE_FROM_EMAIL ||
    process.env.SENDGRID_FROM ||
    'juan.aguirre@dssolutions-mx.com'
  const fromName =
    process.env.DIESEL_GAP_FROM_NAME ||
    process.env.COMPLIANCE_FROM_NAME ||
    'Mantenimiento DC Concretos'

  if (!key) {
    throw new Error('SENDGRID_API_KEY is not configured')
  }

  const ccList = (payload.cc ?? []).filter((e) => e.includes('@'))
  const personalizations = [
    {
      to: payload.to.map((email) => ({ email })),
      ...(ccList.length > 0 ? { cc: ccList.map((email) => ({ email })) } : {}),
    },
  ]

  const { html, attachments } = payload.evidencePhotos?.length
    ? await embedEvidenceInlineAttachments(payload.html, payload.evidencePhotos)
    : { html: payload.html, attachments: [] as SendGridAttachment[] }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations,
      from: { email: from, name: fromName },
      subject: payload.subject,
      content: [{ type: 'text/html', value: html }],
      ...(attachments.length > 0 ? { attachments } : {}),
      tracking_settings: {
        click_tracking: { enable: false },
        open_tracking: { enable: false },
      },
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`SendGrid error: ${res.status} ${t.slice(0, 400)}`)
  }
}
