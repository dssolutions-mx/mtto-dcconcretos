import { format } from "date-fns"
import {
  generateDomSnapshotPdf,
  waitForImagesInContainer,
} from "@/lib/pdf/dom-snapshot-pdf"

export { waitForImagesInContainer }

const DEFAULT_FILENAME = () => `instantaneo-incidentes-${format(new Date(), "yyyy-MM-dd-HHmm")}`

/** Same pipeline as {@link generateDomSnapshotPdf} with a default incidentes filename. */
export async function generateIncidentSnapshotPdf(
  element: HTMLElement,
  filenameBase = DEFAULT_FILENAME(),
): Promise<void> {
  return generateDomSnapshotPdf(element, filenameBase)
}
