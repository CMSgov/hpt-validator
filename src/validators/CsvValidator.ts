import Papa from "papaparse";
import {
  CsvValidationOptions,
  STATE_CODES,
  StateCode,
  ValidationResult,
} from "../types";
import { BaseValidator } from "./BaseValidator";
import { removeBOM } from "../utils";
import {
  AllowedValuesError,
  AmbiguousFormatError,
  ColumnMissingError,
  CsvValidationError,
  DuplicateColumnError,
  DuplicateHeaderColumnError,
  HeaderBlankError,
  HeaderColumnMissingError,
  InvalidDateError,
  InvalidStateCodeError,
  InvalidVersionError,
  MinRowsError,
  ProblemsInHeaderError,
  RequiredValueError,
} from "../errors/csv";
import { range } from "lodash";

export const AFFIRMATION =
  "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated.";

export const HEADER_COLUMNS = [
  "hospital_name", // string
  "last_updated_on", // date
  "version", // string - maybe one of the known versions?
  "hospital_location", // string
  "hospital_address", // string
  "license_number | [state]", // string, check for valid postal code in header
  AFFIRMATION, // "true" or "false"
];

export type ColumnDefinition = {
  label: string;
  required: boolean;
  dataRequired?: boolean;
};

export function objectFromKeysValues(
  keys: string[],
  values: string[]
): { [key: string]: string } {
  return Object.fromEntries(
    keys.map((key, index) => [key, values[index]]).filter((entry) => entry)
  );
}

export function sepColumnsEqual(colA: string, colB: string) {
  const cleanA = colA.split("|").map((v) => v.trim().toUpperCase());
  const cleanB = colB.split("|").map((v) => v.trim().toUpperCase());
  return (
    cleanA.length === cleanB.length &&
    cleanA.every((a, idx: number) => a === cleanB[idx])
  );
}

export function matchesString(a: string, b: string): boolean {
  return a.toLocaleUpperCase() === b.toLocaleUpperCase();
}

export function isValidDate(value: string) {
  // required format is YYYY-MM-DD or MM/DD/YYYY or M/D/YYYY or MM/D/YYYY or M/DD/YYYY
  const dateMatch1 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const dateMatch2 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateMatch1 != null) {
    // UTC methods are used because "date-only forms are interpreted as a UTC time",
    // as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
    // check that the parsed date matches the input, to guard against e.g. February 31
    const matchYear = dateMatch1[3];
    const matchMonth = dateMatch1[1];
    const matchDate = dateMatch1[2];
    const expectedYear = parseInt(matchYear);
    const expectedMonth = parseInt(matchMonth) - 1;
    const expectedDate = parseInt(matchDate);
    const parsedDate = new Date(value);
    return (
      expectedYear === parsedDate.getUTCFullYear() &&
      expectedMonth === parsedDate.getUTCMonth() &&
      expectedDate === parsedDate.getUTCDate()
    );
  } else if (dateMatch2 != null) {
    const matchYear = dateMatch2[1];
    const matchMonth = dateMatch2[2];
    const matchDate = dateMatch2[3];
    const expectedYear = parseInt(matchYear);
    const expectedMonth = parseInt(matchMonth) - 1;
    const expectedDate = parseInt(matchDate);
    const parsedDate = new Date(value);
    return (
      expectedYear === parsedDate.getUTCFullYear() &&
      expectedMonth === parsedDate.getUTCMonth() &&
      expectedDate === parsedDate.getUTCDate()
    );
  }
  return false;
}

export function validateRequiredEnumField(
  row: number,
  column: number,
  columnName: string,
  value: string,
  allowedValues: string[],
  suffix: string = ""
) {
  if (!value) {
    return [new RequiredValueError(row, column, columnName, suffix)];
  } else if (
    !allowedValues.some((allowedValue) => matchesString(value, allowedValue))
  ) {
    return [
      new AllowedValuesError(row, column, columnName, value, allowedValues),
    ];
  } else {
    return [];
  }
}

export class CsvValidator extends BaseValidator {
  public index = 0;
  public isTall: boolean = false;
  public headerColumns: string[] = [];
  public dataColumns: string[] = [];
  public errors: CsvValidationError[] = [];
  public maxErrors: number;
  public dataCallback?: CsvValidationOptions["onValueCallback"];
  static allowedVersions = ["v2.0.0", "v2.1.0", "v2.2.0"];

  constructor(
    public version: string,
    options: CsvValidationOptions = {}
  ) {
    super("csv");
    this.maxErrors = options.maxErrors ?? 0;
    this.dataCallback = options.onValueCallback;
  }

  static isAllowedVersion(version: string): boolean {
    return CsvValidator.allowedVersions.includes(version);
  }

  reset() {
    this.index = 0;
    this.headerColumns = [];
    this.dataColumns = [];
    this.errors = [];
  }

  validate(input: File | NodeJS.ReadableStream): Promise<ValidationResult> {
    if (!CsvValidator.isAllowedVersion(this.version)) {
      return new Promise((resolve) => {
        resolve({
          valid: false,
          errors: [new InvalidVersionError()],
        });
      });
    }

    return new Promise((resolve, reject) => {
      Papa.parse(input, {
        header: false,
        beforeFirstChunk: (chunk) => {
          return removeBOM(chunk);
        },
        step: (row: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
          try {
            this.handleParseStep(row, resolve, parser);
          } catch (e) {
            reject(e);
          }
        },
        complete: () => this.handleParseEnd(resolve),
        error: (error: Error) => reject(error),
      });
    });
  }

  validateHeaderColumns(columns: string[]): CsvValidationError[] {
    const remainingColumns = [...HEADER_COLUMNS];
    const discoveredColumns: string[] = [];
    const errors: CsvValidationError[] = [];
    columns.forEach((column, index) => {
      const matchingColumnIndex = remainingColumns.findIndex(
        (requiredColumn) => {
          if (requiredColumn === "license_number | [state]") {
            // make a best guess as to when a header is meant to be the license_number header
            // if it has two parts, and the first part matches, then the second part ought to be valid
            const splitColumn = column.split("|").map((v) => v.trim());
            if (splitColumn.length !== 2) {
              return false;
            }
            if (sepColumnsEqual(splitColumn[0], "license_number")) {
              if (
                STATE_CODES.includes(splitColumn[1].toUpperCase() as StateCode)
              ) {
                return true;
              } else {
                errors.push(new InvalidStateCodeError(index, splitColumn[1]));
                return false;
              }
            } else {
              return false;
            }
          } else {
            return sepColumnsEqual(column, requiredColumn);
          }
        }
      );
      if (matchingColumnIndex > -1) {
        discoveredColumns[index] = column;
        remainingColumns.splice(matchingColumnIndex, 1);
      } else {
        // if we already found this column, it's a duplicate
        const existingColumn = discoveredColumns.find((discovered) => {
          return discovered != null && sepColumnsEqual(discovered, column);
        });
        if (existingColumn) {
          errors.push(new DuplicateHeaderColumnError(index, column));
        }
      }
    });

    errors.push(
      ...remainingColumns.map(
        (requiredColumn) => new HeaderColumnMissingError(requiredColumn)
      )
    );
    this.headerColumns = discoveredColumns;
    return errors;
  }

  validateHeaderRow(row: string[]): CsvValidationError[] {
    const errors: CsvValidationError[] = [];
    this.headerColumns.forEach((header, index) => {
      if (/^license_number\s*\|\s*.{2}$/.test(header)) {
        return;
      }
      if (header != null) {
        const value = row[index] ?? "";
        if (!value) {
          errors.push(new RequiredValueError(1, index, header));
        } else if (
          sepColumnsEqual(header, "last_updated_on") &&
          !isValidDate(value)
        ) {
          errors.push(new InvalidDateError(1, index, header, value));
        } else if (sepColumnsEqual(header, AFFIRMATION)) {
          errors.push(
            ...validateRequiredEnumField(1, index, header, value, [
              "true",
              "false",
            ])
          );
        }
      }
    });
    return errors;
  }

  validateHeader(row: string[]): CsvValidationError[] {
    return [
      ...this.validateHeaderColumns(this.headerColumns),
      ...this.validateHeaderRow(row),
    ];
  }

  validateColumns(columns: string[]): CsvValidationError[] {
    this.isTall = this.areMyColumnsTall(columns);
    const payersPlans = this.getPayersPlans(columns);
    if (this.isTall === payersPlans.length > 0) {
      return [new AmbiguousFormatError()];
    }
    this.dataColumns = [];
    const errors: CsvValidationError[] = [];
    const codeCount = this.getCodeCount(columns);
    const expectedDataColumns = CsvValidator.getExpectedDataColumns(
      this.version,
      codeCount,
      payersPlans
    );
    columns.forEach((column, index) => {
      const matchingColumnIndex = expectedDataColumns.findIndex((expected) => {
        return sepColumnsEqual(column, expected.label);
      });
      if (matchingColumnIndex > -1) {
        this.dataColumns[index] = column;
        expectedDataColumns.splice(matchingColumnIndex, 1);
      } else {
        const isDuplicate = this.dataColumns.some((dataColumn) => {
          return dataColumn != null && sepColumnsEqual(dataColumn, column);
        });
        if (isDuplicate) {
          errors.push(new DuplicateColumnError(index, column));
        } else {
          this.dataColumns[index] = column;
        }
      }
    });
    expectedDataColumns
      .filter((expectedColumn) => expectedColumn.required)
      .forEach((expectedColumn) => {
        errors.push(new ColumnMissingError(expectedColumn.label));
      });
    return errors;
  }

  getCodeCount(columns: string[]): number {
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
    );
  }

  static getExpectedDataColumns(
    version: string,
    codeCount: number,
    payersPlans: string[]
  ): ColumnDefinition[] {
    const columns: ColumnDefinition[] = [
      { label: "description", required: true },
      { label: "setting", required: true },
      { label: "standard_charge | gross", required: true },
      { label: "standard_charge | discounted_cash", required: true },
      { label: "standard_charge | min", required: true },
      { label: "standard_charge | max", required: true },
      { label: "additional_generic_notes", required: true },
    ];
    range(1, Math.max(1, codeCount)).forEach((i) => {
      columns.push(
        { label: `code | ${i}`, required: true },
        { label: `code | ${i} | type`, required: true }
      );
    });

    if (payersPlans.length > 0) {
      payersPlans.forEach((payerPlan) => {
        columns.push(
          {
            label: `standard_charge | ${payerPlan} | negotiated_dollar`,
            required: true,
          },
          {
            label: `standard_charge | ${payerPlan} | negotiated_percentage`,
            required: true,
          },
          {
            label: `standard_charge | ${payerPlan} | negotiated_algorithm`,
            required: true,
          },
          {
            label: `standard_charge | ${payerPlan} | methodology`,
            required: true,
          },
          {
            label: `additional_payer_notes | ${payerPlan}`,
            required: true,
          }
        );
      });
    } else {
      columns.push(
        { label: "payer_name", required: true },
        { label: "plan_name", required: true },
        { label: "standard_charge | negotiated_dollar", required: true },
        { label: "standard_charge | negotiated_percentage", required: true },
        { label: "standard_charge | negotiated_algorithm", required: true },
        { label: "standard_charge | methodology", required: true }
      );
    }

    switch (version) {
      case "v2.0.0":
        // do we want to add these?
        // it sort of depends on how other parts of the implement shake out.
        // columns.push(
        //   { label: "drug_unit_of_measurement", required: false },
        //   { label: "drug_type_of_measurement", required: false }
        // );
        break;
      case "v2.2.0":
        columns.push(
          { label: "drug_unit_of_measurement", required: true },
          { label: "drug_type_of_measurement", required: true },
          { label: "modifiers", required: true }
        );
        if (payersPlans.length > 0) {
          columns.push(
            ...payersPlans.map((payerPlan) => {
              return {
                label: `estimated_amount | ${payerPlan}`,
                required: true,
              };
            })
          );
        } else {
          columns.push({ label: "estimated_amount", required: true });
        }
        break;
    }
    return columns;
  }

  areMyColumnsTall(columns: string[]): boolean {
    // "payer_name" and "plan_name" are required for the tall format,
    // so if they are present, the columns are probably tall
    return ["payer_name", "plan_name"].every((tallColumn) => {
      return columns.some((column) => matchesString(column, tallColumn));
    });
  }

  getPayersPlans(columns: string[]): string[] {
    // standard_charge | Payer ABC | Plan 1 | negotiated_dollar
    // standard_charge | Payer ABC | Plan 1 | negotiated_percentage
    // standard_charge | Payer ABC | Plan 1 | negotiated_algorithm
    // standard_charge | Payer ABC | Plan 1 | methodology
    // estimated_amount | Payer ABC | Plan 1
    // additional_payer_notes | Payer ABC | Plan 1
    const payersPlans = new Set<string>();
    columns.forEach((column) => {
      const splitColumn = column.split("|").map((p) => p.trim());
      if (splitColumn.length === 4) {
        if (
          matchesString(splitColumn[0], "standard_charge") &&
          [
            "negotiated_dollar",
            "negotiated_percentage",
            "negotiated_algorithm",
            "methodology",
          ].some((p) => matchesString(p, splitColumn[3]))
        ) {
          payersPlans.add(splitColumn.slice(1, 3).join(" | "));
        }
      } else if (
        splitColumn.length === 3 &&
        ["estimated_amount", "additional_payer_notes"].some((p) =>
          matchesString(p, splitColumn[0])
        )
      ) {
        payersPlans.add(splitColumn.slice(1, 3).join(" | "));
      }
    });
    return Array.from(payersPlans);
  }

  validateDataRow(row: string[]): CsvValidationError[] {
    // how do we want to manage this, because the requirements are going to change over time
    // there may be newly required things, or un-required things
    throw new Error("not implemented yet");
  }

  handleParseStep(
    step: Papa.ParseStepResult<string[]>,
    resolve: (value: ValidationResult | PromiseLike<ValidationResult>) => void,
    parser: Papa.Parser
  ) {
    const row: string[] = step.data.map((value) => value.trim());
    const isEmpty = row.every((value) => value === "");
    if (isEmpty && (this.index === 0 || this.index === 2)) {
      resolve({
        valid: false,
        errors: [new HeaderBlankError(this.index)],
      });
      parser.abort();
    } else if (isEmpty && this.index !== 1) {
      this.index++;
      return;
    }

    if (this.index === 0) {
      this.headerColumns = row;
    } else if (this.index === 1) {
      this.errors.push(...this.validateHeader(row));
    } else if (this.index === 2) {
      this.errors.push(...this.validateColumns(row));
      if (this.errors.length > 0) {
        resolve({
          valid: false,
          errors: [...this.errors, new ProblemsInHeaderError()],
        });
        parser.abort();
      }
    } else {
      // regular data row
      this.errors.push(...this.validateDataRow(row));
      if (this.dataCallback) {
        const cleanRow = objectFromKeysValues(this.dataColumns, row);
        this.dataCallback(cleanRow);
      }
    }

    if (this.maxErrors > 0 && this.errors.length >= this.maxErrors) {
      resolve({
        valid: false,
        errors: this.errors,
      });
      parser.abort();
    }
    this.index++;
  }

  handleParseEnd(
    resolve: (value: ValidationResult | PromiseLike<ValidationResult>) => void
  ): void {
    if (this.index < 4) {
      resolve({
        valid: false,
        errors: [new MinRowsError()],
      });
    } else {
      resolve({
        valid: this.errors.length === 0,
        errors: this.errors,
      });
    }
  }
}
