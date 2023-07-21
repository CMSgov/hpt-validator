const FILENAME_RE =
  /^(\d{2}\-?\d{7})(\-\d{10})?(_.+_)(standardcharges)\.(csv|json)$/i

/**
 *
 * @param filename
 * @returns boolean indicating whether the filename is valid
 */
export function validateFilename(filename: string): boolean {
  return FILENAME_RE.test(filename)
}
