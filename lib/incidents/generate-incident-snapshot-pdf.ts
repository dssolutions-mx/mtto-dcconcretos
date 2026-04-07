import { format } from "date-fns"
import jsPDF from "jspdf"
import { snapdom } from "@zumer/snapdom"

export async function waitForImagesInContainer(container: HTMLElement): Promise<void> {
  const imgs = [...container.querySelectorAll("img")]
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener("load", done, { once: true })
          img.addEventListener("error", done, { once: true })
          window.setTimeout(done, 15000)
        }),
    ),
  )
}

type SnapdomOpts = {
  scale?: number
  backgroundColor?: string
  embedFonts?: boolean
  width?: number
  height?: number
}

function appendCanvasAsPdfPages(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirstChunk: boolean,
  marginMm: number,
): void {
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()
  const contentW = pdfW - marginMm * 2
  const pageH = pdfH - marginMm * 2

  const imgData = canvas.toDataURL("image/png")
  const ratio = contentW / canvas.width
  const imgH = canvas.height * ratio
  const slicePages = Math.max(1, Math.ceil(imgH / pageH))

  if (!isFirstChunk) {
    pdf.addPage()
  }

  let position = marginMm
  pdf.addImage(imgData, "PNG", marginMm, position, contentW, imgH, undefined, "FAST")
  for (let i = 1; i < slicePages; i++) {
    position -= pageH
    pdf.addPage()
    pdf.addImage(imgData, "PNG", marginMm, position, contentW, imgH, undefined, "FAST")
  }
}

async function rasterizeElement(el: HTMLElement, opts?: SnapdomOpts): Promise<HTMLCanvasElement> {
  const result = await snapdom(el, {
    scale: opts?.scale ?? 2,
    backgroundColor: opts?.backgroundColor ?? "#ffffff",
    embedFonts: opts?.embedFonts ?? true,
    width: opts?.width ?? el.scrollWidth,
    height: opts?.height ?? el.scrollHeight,
  })
  return result.toCanvas()
}

const DEFAULT_FILENAME = () => `instantaneo-incidentes-${format(new Date(), "yyyy-MM-dd-HHmm")}`

/**
 * Rasters `element` to PDF. Optional `[data-pdf-chunk]` children capture as separate segments;
 * if none, one continuous document (dense list + thumbnail photos) — default for instantáneo.
 */
export async function generateIncidentSnapshotPdf(
  element: HTMLElement,
  filenameBase = DEFAULT_FILENAME(),
): Promise<void> {
  const noPrint = element.querySelector(".no-print-snapshot")
  noPrint?.classList.add("hidden")
  element.classList.add("pdf-snapshot-export-mode")
  element.scrollIntoView({ behavior: "instant" })
  await new Promise((r) => setTimeout(r, 120))

  const marginMm = 5

  try {
    const chunks = [...element.querySelectorAll<HTMLElement>("[data-pdf-chunk]")]

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    if (chunks.length > 0) {
      let first = true
      for (const chunk of chunks) {
        const canvas = await rasterizeElement(chunk)
        appendCanvasAsPdfPages(pdf, canvas, first, marginMm)
        first = false
      }
    } else {
      const canvas = await rasterizeElement(element, {
        width: element.scrollWidth,
        height: element.scrollHeight,
      })
      appendCanvasAsPdfPages(pdf, canvas, true, marginMm)
    }

    pdf.save(`${filenameBase}.pdf`)
  } finally {
    noPrint?.classList.remove("hidden")
    element.classList.remove("pdf-snapshot-export-mode")
  }
}
