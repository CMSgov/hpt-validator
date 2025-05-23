export function addErrorsToList<T extends { warning?: boolean | undefined }>(
  newErrors: T[],
  errorList: T[],
  maxErrors = 0,
  counts: { errors: number; warnings: number }
) {
  // if warning list is already full, don't add the new warnings
  if (maxErrors > 0 && counts.warnings >= maxErrors) {
    newErrors = newErrors.filter((error) => error.warning !== true)
    // only add enough to reach the limit
    if (counts.errors + newErrors.length > maxErrors) {
      newErrors = newErrors.slice(0, maxErrors - counts.errors)
    }
    errorList.push(...newErrors)
    counts.errors += newErrors.length
  } else {
    newErrors.forEach((error) => {
      if (error.warning) {
        if (maxErrors <= 0 || counts.warnings < maxErrors) {
          errorList.push(error)
          counts.warnings++
        }
      } else {
        if (maxErrors <= 0 || counts.errors < maxErrors) {
          errorList.push(error)
          counts.errors++
        }
      }
    })
  }
  return counts
}

export function addAlertsToList<T>(
  newAlerts: T[],
  alertList: T[],
  maxAlerts = 0,
  counts: { alerts: number }
) {
  if (maxAlerts > 0 && counts.alerts + newAlerts.length > maxAlerts) {
    newAlerts = newAlerts.slice(0, maxAlerts - counts.alerts)
  }
  alertList.push(...newAlerts)
  counts.alerts = alertList.length
  return counts
}

export function removeBOM(chunk: string): string {
  // strip utf-8 BOM: see https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
  const dataBuffer = Buffer.from(chunk)
  if (
    dataBuffer.length > 2 &&
    dataBuffer[0] === 0xef &&
    dataBuffer[1] === 0xbb &&
    dataBuffer[2] === 0xbf
  ) {
    chunk = chunk.trimStart()
  }
  return chunk
}
