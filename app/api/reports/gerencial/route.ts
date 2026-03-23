import { NextRequest, NextResponse } from 'next/server'
import {
  runGerencialReport,
  type GerencialReportBody,
} from '@/lib/reports/run-gerencial-report'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GerencialReportBody
    const data = await runGerencialReport(body, {
      requestHost: req.headers.get('host'),
    })
    return NextResponse.json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    console.error('Gerencial report route error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
