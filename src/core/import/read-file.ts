/**
 * One entry for every file a person can pick: .xlsx, old .xls (also the HTML / XML tables ERP systems save under that
 * name) and CSV in any common encoding. Each comes back as the same list of tabs the importer already understands.
 * The app and the demo both read files through here, so they accept the same things.
 */
import { decodeBytes } from "./encoding";
import type { ImportKind } from "./specs";
import { readCsvText, readWorkbook, type SheetGrid, type SheetRead } from "./workbook";

export async function readUploadedFile(name: string, source: Blob, allowed?: readonly ImportKind[]): Promise<SheetRead[]> {
  if (/\.xlsx$/i.test(name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    return readWorkbook((await readXlsxFile(source)) as SheetGrid[], allowed);
  }
  if (/\.xls$/i.test(name)) {
    const { readLegacyWorkbook } = await import("./legacy-workbook");
    return readWorkbook(readLegacyWorkbook(await source.arrayBuffer()), allowed);
  }
  // Arabic Windows exports are often Windows-1256: converted to UTF-8 here so names are not garbled.
  return [readCsvText(decodeBytes(new Uint8Array(await source.arrayBuffer())).text, allowed)];
}
