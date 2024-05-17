import {
  ValidationResult,
  CsvValidationError,
  CsvValidatorVersion,
  CsvValidationOptions,
  SchemaVersion,
} from "./types.js"
import {
  csvErrorToValidationError,
  rowIsEmpty,
  csvCellName,
  objectFromKeysValues,
  cleanColumnNames,
} from "./versions/common/csv.js"
import { CsvValidatorOneOne } from "./versions/1.1/csv.js"
import { CsvValidatorTwoZero } from "./versions/2.0/csv.js"
import { addErrorsToList } from "./utils.js"

import Papa from "papaparse"

const ERRORS = {
  INVALID_VERSION: "Invalid version supplied",
  HEADER_ERRORS: "Errors were found in the headers or values in rows 1 through 3, so the remaining rows were not evaluated.",
  MIN_ROWS: "At least one row must be present",
  HEADER_BLANK: (row: number) =>
    `Required headers must be defined on rows 1 and 3. Row ${row} is blank`,
}

export function getValidator(
  version: SchemaVersion
): CsvValidatorVersion | null {
  if (version === "v1.1") {
    return CsvValidatorOneOne
  } else if (version === "v2.0" || version === "v2.0.0") {
    return CsvValidatorTwoZero
  }
  return null
}

/**
 *
 * @param input Browser File or ReadableStream for streaming file content
 * @param onValueCallback Callback function to process streamed CSV row object
 * @returns Promise that resolves with the result of validation
 */
export async function validateCsv(
  input: File | NodeJS.ReadableStream,
  version: SchemaVersion,
  options: CsvValidationOptions = {}
): Promise<ValidationResult> {
  let index = 0
  const errors: CsvValidationError[] = []
  const counts = {
    errors: 0,
    warnings: 0,
  }
  let headerColumns: string[]
  let dataColumns: string[]
  let tall = false
  let validator: CsvValidatorVersion

  const requestedValidator = getValidator(version)
  if (requestedValidator === null) {
    return new Promise((resolve) => {
      resolve({
        valid: false,
        errors: [
          {
            path: csvCellName(0, 0),
            message: ERRORS.INVALID_VERSION,
          },
        ],
      })
    })
  } else {
    validator = requestedValidator
  }

  const handleParseStep = (
    step: Papa.ParseStepResult<string[]>,
    resolve: (result: ValidationResult | PromiseLike<ValidationResult>) => void,
    parser: Papa.Parser
  ) => {
    const row: string[] = step.data.map((item) => item.toLowerCase())
    const isEmpty: boolean = rowIsEmpty(row)

    // Headers must be in the proper row, abort if not
    if (isEmpty && (index === 0 || index === 2)) {
      resolve({
        valid: false,
        errors: [
          {
            path: csvCellName(0, 0),
            message: ERRORS.HEADER_BLANK(index + 1),
          },
        ],
      })
      parser.abort()
    } else if (isEmpty) {
      ++index
      return
    }

    if (index === 0) {
      headerColumns = row
    } else if (index === 1) {
      addErrorsToList(
        validator.validateHeader(headerColumns, row),
        errors,
        options.maxErrors,
        counts
      )
    } else if (index === 2) {
      dataColumns = cleanColumnNames(row)
      addErrorsToList(
        validator.validateColumns(dataColumns),
        errors,
        options.maxErrors,
        counts
      )
      if (counts.errors > 0) {
        resolve({
          valid: false,
          errors: errors.map(csvErrorToValidationError).concat({
            path: csvCellName(0, 0),
            message: ERRORS.HEADER_ERRORS,
          }),
        })
        parser.abort()
      } else {
        tall = validator.isTall(dataColumns)
      }
    } else {
      const cleanRow = objectFromKeysValues(dataColumns, row)
      addErrorsToList(
        validator.validateRow(cleanRow, index, dataColumns, !tall),
        errors,
        options.maxErrors,
        counts
      )
      if (options.onValueCallback) {
        options.onValueCallback(cleanRow)
      }
    }

    if (
      options.maxErrors &&
      options.maxErrors > 0 &&
      counts.errors >= options.maxErrors
    ) {
      resolve({
        valid: false,
        errors: errors.map(csvErrorToValidationError),
      })
      parser.abort()
    }

    ++index
  }

  const handleParseEnd = (
    resolve: (result: ValidationResult | PromiseLike<ValidationResult>) => void
  ): void => {
    if (index < 4) {
      resolve({
        valid: false,
        errors: [
          {
            path: csvCellName(0, 0),
            message: ERRORS.MIN_ROWS,
          },
        ],
      })
    } else {
      resolve({
        valid: counts.errors === 0,
        errors: errors.map(csvErrorToValidationError),
      })
    }
  }

  return new Promise((resolve, reject) => {
    Papa.parse(input, {
      header: false,
      // chunkSize: 64 * 1024,
      step: (row: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
        try {
          handleParseStep(row, resolve, parser)
        } catch (e) {
          reject(e)
        }
      },
      complete: () => handleParseEnd(resolve),
      error: (error: Error) => reject(error),
    })
  })
}
