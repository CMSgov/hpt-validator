import semver from "semver";
import _ from "lodash";
const { partial } = _;
import {
  InvalidNumberError,
  CsvValidationError,
  RequiredValueError,
  AllowedValuesError,
} from "../errors/index.js";
import { DynaReadyValidator } from "./CsvFieldTypes.js";
import { matchesString } from "./CsvHelpers.js";

export class CsvValidationRule {
  constructor(
    public name: string,
    public applicableVersion: string,
    public validator: DynaReadyValidator
  ) {}

  public applicable(version: string): boolean {
    return semver.satisfies(version, this.applicableVersion);
  }
}

const descriptionRequired = {
  name: "description required",
  applicableVersion: ">=2.0.0",
  validator: partial(differentValidateRequiredField, "description", ""),
};

const settingRequired = {
  name: "setting required",
  applicableVersion: ">=2.0.0",
  validator: partial(
    differentValidateRequiredEnumField,
    "setting",
    ["inpatient", "outpatient", "both"],
    ""
  ),
};

export const formAndMannerRules = [descriptionRequired, settingRequired];

export function validateRequiredHeaderEnum(
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

export function differentValidateRequiredEnumField(
  field: string,
  allowedValues: string[],
  suffix: string = "",
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],

  dataRow: { [key: string]: string },
  row: number
) {
  const value = dataRow[field];
  const columnIndex = normalizedColumns.indexOf(field);
  if (!value) {
    return [
      new RequiredValueError(
        row,
        columnIndex,
        enteredColumns[columnIndex] ?? "",
        suffix
      ),
    ];
  } else if (
    !allowedValues.some((allowedValue) => matchesString(value, allowedValue))
  ) {
    return [
      new AllowedValuesError(
        row,
        columnIndex,
        enteredColumns[columnIndex] ?? "",
        value,
        allowedValues
      ),
    ];
  }
  return [];
}

export function differentValidateOptionalFloatField(
  field: string,
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],

  dataRow: { [key: string]: string },
  row: number
) {
  const value = dataRow[field];
  const columnIndex = normalizedColumns.indexOf(field);
  if (!value) {
    return [];
  }
  if (!/^(?:\d+|\d+\.\d+|\d+\.|\.\d+)$/.test(value) || parseFloat(value) <= 0) {
    return [
      new InvalidNumberError(
        row,
        columnIndex,
        enteredColumns[columnIndex] ?? "",
        value
      ),
    ];
  }
  return [];
}

export function differentValidateRequiredFloatField(
  field: string,
  suffix: string = "",
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],

  dataRow: { [key: string]: string },
  row: number
): CsvValidationError[] {
  const value = dataRow[field];
  const columnIndex = normalizedColumns.indexOf(field);
  if (!value) {
    return [
      new RequiredValueError(
        row,
        columnIndex,
        enteredColumns[columnIndex] ?? "",
        suffix
      ),
    ];
  } else {
    return differentValidateOptionalFloatField(
      field,
      normalizedColumns,
      enteredColumns,
      dataRow,
      row
    );
  }
}

export function differentValidateRequiredField(
  field: string,
  suffix: string = "",
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],

  dataRow: { [key: string]: string },
  row: number
): CsvValidationError[] {
  const value = dataRow[field];
  const columnIndex = normalizedColumns.indexOf(field);
  if (!value) {
    return [
      new RequiredValueError(
        row,
        columnIndex,
        enteredColumns[columnIndex] ?? "",
        suffix
      ),
    ];
  }
  return [];
}
