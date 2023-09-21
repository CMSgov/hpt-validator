import { CsvValidationError, ValidationError } from "../../types"

export function csvErrorToValidationError(
  err: CsvValidationError
): ValidationError {
  return {
    path: csvCellName(err.row, err.column),
    field: err.field,
    message: err.message,
    ...(err.warning ? { warning: err.warning } : {}),
  }
}

// Helper to reduce boilerplate
export function csvErr(
  row: number,
  column: number,
  field: string | undefined,
  message: string,
  warning?: boolean
): CsvValidationError {
  return { row, column, field, message, warning }
}

export function cleanRowFields(row: { [key: string]: string }): {
  [key: string]: string
} {
  const newRow: { [key: string]: string } = {}
  Object.entries(row).forEach(([key, value]: string[]) => {
    newRow[
      key
        .split("|")
        .map((v) => v.trim())
        .join(" | ")
    ] = value
  })
  return newRow
}

export function sepColumnsEqual(colA: string, colB: string) {
  const cleanA = colA.split("|").map((v) => v.trim())
  const cleanB = colB.split("|").map((v) => v.trim())
  return cleanA.every((a, idx: number) => a === cleanB[idx])
}

export const ASCII_UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export function csvCellName(row: number, column: number): string {
  return `${csvColumnName(column)}${row + 1}`
}

export function csvColumnName(column: number): string {
  if (column < ASCII_UPPERCASE.length) return ASCII_UPPERCASE[column]

  return (
    ASCII_UPPERCASE[Math.floor(column / ASCII_UPPERCASE.length)] +
    csvColumnName(column % ASCII_UPPERCASE.length)
  )
}

export function objectFromKeysValues(
  keys: string[],
  values: string[]
): { [key: string]: string } {
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
}

export function rowIsEmpty(row: string[]): boolean {
  return row.every((value) => !value.trim())
}

export function parseSepField(field: string): string[] {
  return field.split("|").map((v) => v.trim())
}

export function getCodeCount(columns: string[]): number {
  return Math.max(
    0,
    ...columns
      .map((c) =>
        c
          .split("|")
          .map((v) => v.trim())
          .filter((v) => !!v)
      )
      .filter((c) => c[0] === "code" && c.length === 2)
      .map((c) => +c[1].replace(/\D/g, ""))
      .filter((v) => !isNaN(v))
  )
}
