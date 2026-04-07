/**
 * Greedy packing of measured row heights into PDF raster chunks so jsPDF's vertical
 * slicing (per chunk) tends to fall *between* incidents instead of through them.
 * CSS break-inside / paged media don't apply to canvas→PDF raster pipelines.
 */

/** Must match print template width */
export const PDF_LAYOUT_WIDTH_PX = 794

/** Tailwind gap-4 between stacked incidents inside a chunk */
export const PDF_INCIDENT_STACK_GAP_PX = 16

/** p-6 top + bottom inside each data-pdf-chunk wrapper */
export const PDF_CHUNK_VERTICAL_PADDING_PX = 48

/**
 * A4 portrait, 5mm margins (same as generate-incident-snapshot-pdf).
 * Approximate max layout height (px) for one raster page at width PDF_LAYOUT_WIDTH_PX.
 */
export function maxSingleChunkLayoutHeightPx(): number {
  const pageHmm = 297
  const marginMm = 5
  const contentHmm = pageHmm - 2 * marginMm
  const pageWmm = 210
  const contentWmm = pageWmm - 2 * marginMm
  const maxH = (contentHmm * PDF_LAYOUT_WIDTH_PX) / contentWmm - PDF_CHUNK_VERTICAL_PADDING_PX - 12
  return Math.max(400, Math.floor(maxH))
}

/** Max sum of incident row heights + internal gaps per chunk (before outer chunk padding). */
export function maxPackedIncidentContentPx(): number {
  return maxSingleChunkLayoutHeightPx() - PDF_CHUNK_VERTICAL_PADDING_PX
}

/**
 * Groups consecutive row indices into chunks where (sum of heights + gaps) <= maxContentPx.
 * Oversized single rows get their own chunk.
 */
export function packIncidentRowIndices(
  heightsPx: number[],
  gapPx: number,
  maxContentPx: number,
): number[][] {
  if (heightsPx.length === 0) return []

  const chunks: number[][] = []
  let current: number[] = []
  let sum = 0

  for (let i = 0; i < heightsPx.length; i++) {
    const h = heightsPx[i]

    if (h > maxContentPx) {
      if (current.length) {
        chunks.push(current)
        current = []
        sum = 0
      }
      chunks.push([i])
      continue
    }

    const nextSum = current.length === 0 ? h : sum + gapPx + h
    if (nextSum <= maxContentPx) {
      current.push(i)
      sum = nextSum
    } else {
      if (current.length) chunks.push(current)
      current = [i]
      sum = h
    }
  }

  if (current.length) chunks.push(current)
  return chunks
}
