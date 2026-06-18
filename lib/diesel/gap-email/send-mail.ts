import type { SupabaseClient } from '@supabase/supabase-js'
import {
  downloadGapEvidenceImageBytes,
  evidenceContentId,
  guessEvidenceImageType,
} from '@/lib/diesel/gap-email/evidence-image-bytes'
import type { GapEvidencePhoto } from '@/lib/diesel/gap-email/load-gap-evidence'

export type MailPayload = {
  to: string[]
  cc?: string[]
  subject: string
  html: string
  evidencePhotos?: GapEvidencePhoto[]
  admin?: SupabaseClient
}

type SendGridAttachment = {
  content: string
  type: string
  filename: string
  disposition: 'inline' | 'attachment'
  content_id?: string
}

function missingInlineImageMarkup(): string {
  return `<div style="margin-top:4px;font-size:11px;color:#78716C">Sin imagen</div>`
}

function inlineImageTagPattern(contentId: string): RegExp {
  const escaped = contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `<img src="cid:${escaped}" alt="[^"]*" width="120" style="[^"]*" />`,
    'g',
  )
}

export async function embedEvidenceInlineAttachments(
  html: string,
  photos: GapEvidencePhoto[],
  admin?: SupabaseClient,
): Promise<{ html: string; attachments: SendGridAttachment[] }> {
  const attachments: SendGridAttachment[] = []
  let nextHtml = html

  for (const photo of photos) {
    const contentId = evidenceContentId(photo.id)
    const cidRef = `cid:${contentId}`

    if (!nextHtml.includes(cidRef)) continue

    const downloaded = admin
      ? await downloadGapEvidenceImageBytes(admin, photo.photoUrl)
      : null

    if (!downloaded) {
      nextHtml = nextHtml.replace(inlineImageTagPattern(contentId), missingInlineImageMarkup())
      continue
    }

    const type = guessEvidenceImageType(photo.photoUrl, downloaded.contentType)
    attachments.push({
      content: downloaded.buffer.toString('base64'),
      type,
      filename: `${photo.transactionCode}-${photo.id}.jpg`,
      disposition: 'inline',
      content_id: contentId,
    })
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
    ? await embedEvidenceInlineAttachments(payload.html, payload.evidencePhotos, payload.admin)
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
