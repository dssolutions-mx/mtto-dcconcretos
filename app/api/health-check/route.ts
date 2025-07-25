import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', timestamp: Date.now() })
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
} 