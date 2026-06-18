export type MailPayload = {
  to: string[]
  cc?: string[]
  subject: string
  html: string
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
      content: [{ type: 'text/html', value: payload.html }],
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
