import {
  AllowedValuesError,
  CsvValidationError,
  InvalidPositiveNumberError,
  RequiredValueError,
} from "../errors/index.js";
import semver from "semver";

export const DRUG_UNITS = ["GR", "ME", "ML", "UN", "F2", "EA", "GM"];

export const BILLING_CODE_TYPES = [
  "CPT",
  "HCPCS",
  "ICD",
  "DRG",
  "MS-DRG",
  "R-DRG",
  "S-DRG",
  "APS-DRG",
  "AP-DRG",
  "APR-DRG",
  "APC",
  "NDC",
  "HIPPS",
  "LOCAL",
  "EAPG",
  "CDT",
  "RC",
  "CDM",
  "TRIS-DRG",
];

export const STANDARD_CHARGE_METHODOLOGY = [
  "case rate",
  "fee schedule",
  "percent of total billed charges",
  "per diem",
  "other",
];

export const STATE_CODES = [
  "AL",
  "AK",
  "AS",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "GU",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "MP",
  "OH",
  "OK",
  "OR",
  "PA",
  "PR",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VI",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

export const AFFIRMATION =
  "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated.";

export const ATTESTATION =
  "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated.";
const SHARED_HEADER_COLUMNS = [
  "hospital_name", // string
  "last_updated_on", // date
  "version", // string - maybe one of the known versions?
  "hospital_address", // string
  "license_number | [state]", // string, check for valid postal code in header
  // AFFIRMATION, // "true" or "false"
];

export function objectFromKeysValues(
  keys: (string | undefined)[],
  values: string[]
): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  keys.forEach((key, index) => {
    if (key) {
      result[key] = values[index];
    }
  });
  return result;
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

export function dynaValidateOptionalEnumField(
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],
  field: string,
  allowedValues: string[],
  dataRow: { [key: string]: string },
  row: number
) {
  const value = dataRow[field];
  const columnIndex = normalizedColumns.indexOf(field);
  if (!value) {
    return [];
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

export function dynaValidateRequiredEnumField(
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],
  field: string,
  allowedValues: string[],
  suffix: string = "",
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
  } else {
    return dynaValidateOptionalEnumField(
      normalizedColumns,
      enteredColumns,
      field,
      allowedValues,
      dataRow,
      row
    );
  }
}

export function dynaValidateOptionalFloatField(
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],
  field: string,
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
      new InvalidPositiveNumberError(
        row,
        columnIndex,
        enteredColumns[columnIndex] ?? "",
        value
      ),
    ];
  }
  return [];
}

export function dynaValidateRequiredFloatField(
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],
  field: string,
  suffix: string = "",
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
    return dynaValidateOptionalFloatField(
      normalizedColumns,
      enteredColumns,
      field,
      dataRow,
      row
    );
  }
}

export function dynaValidateRequiredField(
  normalizedColumns: (string | undefined)[],
  enteredColumns: (string | undefined)[],
  field: string,
  suffix: string = "",
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
export function getBillingCodesByVersion(version: string): string[] {
  const extraCodes: string[] = [];
  if (semver.satisfies(version, ">=3.0.0")) {
    extraCodes.push("CMG");
  }
  return [...BILLING_CODE_TYPES, ...extraCodes];
}

export function getHeaderColumnsByVersion(version: string): string[] {
  const extraColumns: string[] = [];
  if (semver.satisfies(version, ">=3.0.0")) {
    extraColumns.push(
      "location_name",
      "type_2_npi",
      ATTESTATION,
      "attester_name"
    );
  } else {
    extraColumns.push("hospital_location", AFFIRMATION);
  }
  return [...SHARED_HEADER_COLUMNS, ...extraColumns];
}
