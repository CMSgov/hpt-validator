import { CsvValidationError, ValidationError } from "../../types.js"

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

export function cleanColumnNames(columns: string[]) {
  return columns.map((col) =>
    col
      .split("|")
      .map((v) => v.trim())
      .join(" | ")
  )
}

export function sepColumnsEqual(colA: string, colB: string) {
  const cleanA = colA.split("|").map((v) => v.trim().toUpperCase())
  const cleanB = colB.split("|").map((v) => v.trim().toUpperCase())
  return cleanA.every((a, idx: number) => a === cleanB[idx])
}

export const ASCII_UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export function csvCellName(row: number, column: number): string {
  return `${(column ?? -1) >= 0 ? csvColumnName(column) : "row "}${row + 1}`
}

export function csvColumnName(column: number): string {
  let name = ""
  while (column >= 0) {
    name = ASCII_UPPERCASE[column % 26] + name
    column = Math.floor(column / 26) - 1
  }
  return name
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
      .filter(
        (c) =>
          c[0] === "code" &&
          (c.length === 2 || (c.length === 3 && c[2] === "type"))
      )
      .map((c) => +c[1].replace(/\D/g, ""))
      .filter((v) => !isNaN(v))
  )
}

export function isEmptyString(value: string) {
  return value.trim().length === 0
}

export function isNonEmptyString(value: string) {
  return value.trim().length > 0
}

export function isValidDate(value: string) {
  // required format is YYYY-MM-DD or MM/DD/YYYY or M/D/YYYY or MM/D/YYYY or M/DD/YYYY
  //const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const dateMatch1 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const dateMatch2 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (dateMatch1 != null) {
    // UTC methods are used because "date-only forms are interpreted as a UTC time",
    // as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
    // check that the parsed date matches the input, to guard against e.g. February 31
    const matchYear = dateMatch1[3]
    const matchMonth = dateMatch1[1]
    const matchDate = dateMatch1[2]
    const expectedYear = parseInt(matchYear)
    const expectedMonth = parseInt(matchMonth) - 1
    const expectedDate = parseInt(matchDate)
    const parsedDate = new Date(value)
    return (
      expectedYear === parsedDate.getUTCFullYear() &&
      expectedMonth === parsedDate.getUTCMonth() &&
      expectedDate === parsedDate.getUTCDate()
    )
  } else if (dateMatch2 != null) {
    const matchYear = dateMatch2[1]
    const matchMonth = dateMatch2[2]
    const matchDate = dateMatch2[3]
    const expectedYear = parseInt(matchYear)
    const expectedMonth = parseInt(matchMonth) - 1
    const expectedDate = parseInt(matchDate)
    const parsedDate = new Date(value)
    return (
      expectedYear === parsedDate.getUTCFullYear() &&
      expectedMonth === parsedDate.getUTCMonth() &&
      expectedDate === parsedDate.getUTCDate()
    )
  }
  return false
}

export function matchesString(value: string, target: string) {
  return value.trim().toLocaleUpperCase() === target.trim().toLocaleUpperCase()
}
