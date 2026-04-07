import { ValidationError } from "../errors/ValidationError.js";
import { CsvValidationError } from "../errors/csv/index.js";

export class CsvVersionMismatchAlert extends CsvValidationError {
  constructor(column: number, version: string, expectedVersions: string[]) {
    const expectedPart =
      expectedVersions.length == 1
        ? `the expected template version "${expectedVersions[0]}"`
        : `an expected template version ${expectedVersions.map((ev) => `"${ev}"`).join(", ")}`;
    super(
      2,
      column,
      `The value in this MRF's version data element "${version}" does not match ${expectedPart} for the data dictionary requirements selected for validation.`
    );
  }
}

export class JsonVersionMismatchAlert extends ValidationError {
  constructor(version: string, expectedVersions: string[]) {
    const expectedPart =
      expectedVersions.length == 1
        ? `the expected template version "${expectedVersions[0]}"`
        : `an expected template version ${expectedVersions.map((ev) => `"${ev}"`).join(", ")}`;
    super(
      "/version",
      `The value in this MRF's version data element "${version}" does not match ${expectedPart} for the data dictionary requirements selected for validation.`
    );
  }
}
