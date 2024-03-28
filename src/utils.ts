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
