import Papa from "papaparse";
import semver from "semver";
import {
  // BILLING_CODE_TYPES,
  CsvValidationOptions,
  STATE_CODES,
  StateCode,
  ValidationResult,
} from "../types.js";
import { BaseValidator } from "./BaseValidator.js";
import { removeBOM } from "../utils.js";
import {
  AllowedValuesError,
  AmbiguousFormatError,
  CodePairMissingError,
  ColumnMissingError,
  CsvValidationError,
  DollarNeedsMinMaxError,
  DrugInformationRequiredError,
  DuplicateColumnError,
  DuplicateHeaderColumnError,
  HeaderBlankError,
  HeaderColumnMissingError,
  InvalidDateError,
  InvalidNumberError,
  InvalidStateCodeError,
  InvalidVersionError,
  ItemRequiresChargeError,
  MinRowsError,
  ModifierMissingInfoError,
  OtherMethodologyNotesError,
  PercentageAlgorithmEstimateError,
  ProblemsInHeaderError,
  RequiredValueError,
} from "../errors/csv/index.js";
import _ from "lodash";
const { range, partial } = _;
import { ToastyValidator } from "./CsvFieldTypes.js";

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

export type ColumnDefinition = {
  label: string;
  required: boolean;
  dataRequired?: boolean;
};

export function objectFromKeysValues(
  keys: (string | undefined)[],
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

export function sneakyValidateRequiredEnumField(
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

export class CsvValidator extends BaseValidator {
  public index = 0;
  public isTall: boolean = false;
  public headerColumns: string[] = [];
  // dataColumns are the columns as originally present in the CSV
  public dataColumns: (string | undefined)[] = [];
  // normalizedColumns are the columns after pipe separation, trim, and rejoining
  public normalizedColumns: (string | undefined)[] = [];
  public errors: CsvValidationError[] = [];
  public maxErrors: number;
  public dataCallback?: CsvValidationOptions["onValueCallback"];
  static allowedVersions = ["v2.0.0", "v2.1.0", "v2.2.0"];

  public rowValidators: ToastyValidator[] = [];
  public payersPlans: string[] = [];
  public codeCount: number = 0;

  constructor(
    private _version: string,
    options: CsvValidationOptions = {}
  ) {
    super("csv");
    this.maxErrors = options.maxErrors ?? 0;
    this.dataCallback = options.onValueCallback;
  }

  static isAllowedVersion(version: string): boolean {
    return CsvValidator.allowedVersions.includes(version);
  }

  get version() {
    return this._version;
  }

  set version(version: string) {
    if (this._version !== version) {
      this._version = version;
      this.rowValidators = [];
    }
  }

  buildRowValidators() {
    // there is currently only one major version: 2.
    // 2.1.0 and 2.2.0 add some additional requirements
    const modifierChecks: ToastyValidator[] = [];
    const codeChecks: ToastyValidator[] = [];
    // const standardChargeChecks: ToastyValidator[] = [];
    // do partial application on all dynamic validators, since they all use the same sets of columns
    const validateRequiredField = partial(
      dynaValidateRequiredField,
      this.normalizedColumns,
      this.dataColumns
    );
    const validateRequiredEnumField = partial(
      dynaValidateRequiredEnumField,
      this.normalizedColumns,
      this.dataColumns
    );
    const validateOptionalFloatField = partial(
      dynaValidateOptionalFloatField,
      this.normalizedColumns,
      this.dataColumns
    );
    const validateRequiredFloatField = partial(
      dynaValidateRequiredFloatField,
      this.normalizedColumns,
      this.dataColumns
    );
    // now set up validators based on version
    if (semver.gte(this.version, "2.0.0")) {
      // description is always required
      this.rowValidators.push({
        name: "description",
        validator: partial(validateRequiredField, "description", ""),
      });
      // setting is always required
      this.rowValidators.push({
        name: "setting",
        validator: partial(
          validateRequiredEnumField,
          "setting",
          ["inpatient", "outpatient", "both"],
          ""
        ),
      });

      // if code | 1 is not null, code | 1 | type is requiredEnum
      // if code | 1 | type is not null, code | 1 is required
      range(1, this.codeCount + 1).forEach((codeIndex) => {
        codeChecks.push(
          {
            name: `code | ${codeIndex}`,
            validator: partial(
              validateRequiredField,
              `code | ${codeIndex}`,
              ""
            ),
            predicate: (row) => Boolean(row[`code | ${codeIndex} | type`]),
          },
          {
            name: `code | ${codeIndex} | type`,
            validator: partial(
              validateRequiredEnumField,
              `code | ${codeIndex} | type`,
              BILLING_CODE_TYPES,
              ""
            ),
            predicate: (row) => Boolean(row[`code | ${codeIndex}`]),
          }
        );
      });

      this.rowValidators.push(...codeChecks);

      // standard charges must be numeric if present
      [
        "standard_charge | gross",
        "standard_charge | discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
      ].forEach((chargeColumn) => {
        this.rowValidators.push({
          name: chargeColumn,
          validator: partial(validateOptionalFloatField, chargeColumn),
        });
      });

      const nonModifierChecks: ToastyValidator[] = [];

      if (semver.gte(this.version, "2.1.0")) {
        const payerSpecificSuffix =
          " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm";
        if (this.isTall) {
          // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
          // then a corresponding valid value for the payer name, plan name, and standard charge methodology must also be encoded.
          nonModifierChecks.push({
            name: "conditional for payer specific negotiated charge",
            predicate: (row) => {
              return Boolean(
                row["standard_charge | negotiated_dollar"] ||
                  row["standard_charge | negotiated_percentage"] ||
                  row["standard_charge | negotiated_algorithm"]
              );
            },
            toastyChildren: [
              {
                name: "payer_name",
                validator: partial(
                  validateRequiredField,
                  "payer_name",
                  payerSpecificSuffix
                ),
              },
              {
                name: "plan_name",
                validator: partial(
                  validateRequiredField,
                  "plan_name",
                  payerSpecificSuffix
                ),
              },
              {
                name: "standard_charge | methodology",
                validator: partial(
                  validateRequiredEnumField,
                  "standard_charge | methodology",
                  STANDARD_CHARGE_METHODOLOGY,
                  payerSpecificSuffix
                ),
              },
            ],
          });
          // If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found
          // in the "additional notes" for the associated payer-specific negotiated charge.
          // i don't like the implementation here. revisit this.
          nonModifierChecks.push({
            name: "other methodology requires notes",
            predicate: (row) => {
              return matchesString(
                row["standard_charge | methodology"],
                "other"
              );
            },
            validator: (dataRow, row) => {
              if (!dataRow.additional_generic_notes) {
                const columnIndex = this.normalizedColumns.indexOf(
                  "additional_generic_notes"
                );
                return [new OtherMethodologyNotesError(row, columnIndex)];
              }
              return [];
            },
          });
          // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
          // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
          // "Payer-Specific Negotiated Charge: Algorithm".
          // similar awkward implementation here, where the predicate is asking the real question
          const chargeFields = [
            "standard_charge | gross",
            "standard_charge | discounted_cash",
            "standard_charge | negotiated_dollar",
            "standard_charge | negotiated_percentage",
            "standard_charge | negotiated_algorithm",
          ];
          nonModifierChecks.push({
            name: "item requires charge",
            predicate: (row) => {
              return !chargeFields.some((chargeField) => row[chargeField]);
            },
            validator: (_dataRow, row) => {
              const columnIndex = this.normalizedColumns.indexOf(
                "standard_charge | gross"
              );
              return [new ItemRequiresChargeError(row, columnIndex)];
            },
          });
          // If there is a "payer specific negotiated charge" encoded as a dollar amount,
          // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
          nonModifierChecks.push({
            name: "dollar requires min and max",
            predicate: (row) => {
              return Boolean(row["standard_charge | negotiated_dollar"]);
            },
            validator: (dataRow, row) => {
              const missingBounds = [
                "standard_charge | min",
                "standard_charge | max",
              ].filter((bound) => !Boolean(dataRow[bound]));
              if (missingBounds.length > 0) {
                const columnIndex = this.normalizedColumns.indexOf(
                  missingBounds[0]
                );
                return [new DollarNeedsMinMaxError(row, columnIndex)];
              }
              return [];
            },
          });
        } else {
          // For the wide format, a set of columns will be repeated for each payer and plan.
          // So, some conditional checks are repeated for each of those payers and plans.
          // Other conditional checks apply to all payers and plans together.

          // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
          // then a corresponding valid value for the payer name, plan name, and standard charge methodology must also be encoded.
          nonModifierChecks.push(
            ...this.payersPlans.map<ToastyValidator>((payerPlan) => {
              return {
                name: `conditional for ${payerPlan} negotiated charge methodology`,
                predicate: (row) => {
                  return Boolean(
                    row[`standard_charge | ${payerPlan} | negotiated_dollar`] ||
                      row[
                        `standard_charge | ${payerPlan} | negotiated_percentage`
                      ] ||
                      row[
                        `standard_charge | ${payerPlan} | negotiated_algorithm`
                      ]
                  );
                },
                validator: partial(
                  validateRequiredEnumField,
                  `standard_charge | ${payerPlan} | methodology`,
                  STANDARD_CHARGE_METHODOLOGY,
                  payerSpecificSuffix
                ),
              };
            })
          );
          // If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found
          // in the "additional notes" for the associated payer-specific negotiated charge.
          nonModifierChecks.push(
            ...this.payersPlans.map<ToastyValidator>((payerPlan) => {
              return {
                name: `${payerPlan} other methodology requires notes`,
                predicate: (row) => {
                  return matchesString(
                    row[`standard_charge | ${payerPlan} | methodology`] ?? "",
                    "other"
                  );
                },
                validator: (dataRow, row) => {
                  const columnName = `additional_payer_notes | ${payerPlan}`;
                  if (!dataRow[columnName]) {
                    const columnIndex =
                      this.normalizedColumns.indexOf(columnName);
                    return [new OtherMethodologyNotesError(row, columnIndex)];
                  }
                  return [];
                },
              };
            })
          );
          // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
          // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
          // "Payer-Specific Negotiated Charge: Algorithm".
          const chargeFields = [
            "standard_charge | gross",
            "standard_charge | discounted_cash",
          ];
          this.payersPlans.forEach((payerPlan) => {
            chargeFields.push(
              `standard_charge | ${payerPlan} | negotiated_dollar`,
              `standard_charge | ${payerPlan} | negotiated_percentage`,
              `standard_charge | ${payerPlan} | negotiated_algorithm`,
              `standard_charge | ${payerPlan} | methodology`,
              `estimated_amount | ${payerPlan}`,
              `additional_payer_notes | ${payerPlan}`
            );
          });
          nonModifierChecks.push({
            name: "item requires charge",
            predicate: (row) => {
              return !chargeFields.some((chargeField) => row[chargeField]);
            },
            validator: (_dataRow, row) => {
              const columnIndex = this.normalizedColumns.indexOf(
                "standard_charge | gross"
              );
              return [new ItemRequiresChargeError(row, columnIndex)];
            },
          });
          // If there is a "payer specific negotiated charge" encoded as a dollar amount,
          // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
          nonModifierChecks.push({
            name: "dollar requires min and max",
            predicate: (row) => {
              return this.payersPlans.some((payerPlan) => {
                return Boolean(
                  row[`standard_charge | ${payerPlan} | negotiated_dollar`]
                );
              });
            },
            validator: (dataRow, row) => {
              const missingBounds = [
                "standard_charge | min",
                "standard_charge | max",
              ].filter((bound) => !Boolean(dataRow[bound]));
              if (missingBounds.length > 0) {
                const columnIndex = this.normalizedColumns.indexOf(
                  missingBounds[0]
                );
                return [new DollarNeedsMinMaxError(row, columnIndex)];
              }
              return [];
            },
          });
        }
      }

      if (semver.gte(this.version, "2.2.0")) {
        this.rowValidators.push(
          {
            name: "drug_unit_of_measurement",
            validator: partial(
              validateRequiredFloatField,
              "drug_unit_of_measurement",
              ' when "drug_type_of_measurement" is present'
            ),
            predicate: (row) =>
              Boolean(
                row["drug_unit_of_measurement"] ||
                  row["drug_type_of_measurement"]
              ),
          },
          {
            name: "drug_type_of_measurement",
            validator: partial(
              validateRequiredEnumField,
              "drug_type_of_measurement",
              DRUG_UNITS,
              ' when "drug_unit_of_measurement" is present'
            ),
            predicate: (row) =>
              Boolean(
                row["drug_unit_of_measurement"] ||
                  row["drug_type_of_measurement"]
              ),
          }
        );
        // If code type is NDC, then the corresponding drug unit of measure and
        // drug type of measure data elements must be encoded. new in v2.2.0
        this.rowValidators.push({
          name: "NDC code requires drug information",
          validator: (dataRow, row) => {
            const hasNDC = range(1, this.codeCount + 1).some((codeIndex) => {
              return matchesString(
                dataRow[`code | ${codeIndex} | type`],
                "NDC"
              );
            });
            if (hasNDC) {
              const missingDrugFields = [
                "drug_unit_of_measurement",
                "drug_type_of_measurement",
              ].filter((field) => !Boolean(dataRow[field]));
              if (missingDrugFields.length > 0) {
                return [
                  new DrugInformationRequiredError(
                    row,
                    this.normalizedColumns.indexOf(missingDrugFields[0])
                  ),
                ];
              }
            }
            return [];
          },
        });

        if (this.isTall) {
          // some checks diverge based on whether this is a modifier row
          // If a modifier is encoded without an item or service, then a description and one of the following
          // is the minimum information required:
          // additional_generic_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm
          modifierChecks.push({
            name: "extra info for modifier row",
            validator: (dataRow, row) => {
              if (
                ![
                  "additional_generic_notes",
                  "standard_charge | negotiated_dollar",
                  "standard_charge | negotiated_percentage",
                  "standard_charge | negotiated_algorithm",
                ].some((field) => Boolean(dataRow[field]))
              ) {
                return [
                  new ModifierMissingInfoError(
                    row,
                    this.normalizedColumns.indexOf("additional_generic_notes")
                  ),
                ];
              }
              return [];
            },
          });
          // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
          // then a corresponding "Estimated Allowed Amount" must also be encoded. new in v2.2.0
          nonModifierChecks.push({
            name: "estimated allowed amount required when charge is only percentage or algorithm",
            validator: (dataRow, row) => {
              if (
                !dataRow["standard_charge | negotiated_dollar"] &&
                (dataRow["standard_charge | negotiated_percentage"] ||
                  dataRow["standard_charge | negotiated_algorithm"]) &&
                !dataRow.estimated_amount
              ) {
                return [
                  new PercentageAlgorithmEstimateError(
                    row,
                    this.normalizedColumns.indexOf("estimated_amount")
                  ),
                ];
              }
              return [];
            },
          });
        } else {
          // some checks diverge based on whether this is a modifier row
          // If a modifier is encoded without an item or service, then a description and one of the following
          // is the minimum information required:
          // additional_generic_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm
          const extraInfoFields = ["additional_generic_notes"];
          this.payersPlans.forEach((payerPlan) => {
            extraInfoFields.push(
              `standard_charge | ${payerPlan} | negotiated_dollar`,
              `standard_charge | ${payerPlan} | negotiated_percentage`,
              `standard_charge | ${payerPlan} | negotiated_algorithm`,
              `additional_payer_notes | ${payerPlan}`
            );
          });
          modifierChecks.push({
            name: "extra info for modifier row",
            validator: (dataRow, row) => {
              if (!extraInfoFields.some((field) => Boolean(dataRow[field]))) {
                return [
                  new ModifierMissingInfoError(
                    row,
                    this.normalizedColumns.indexOf("additional_generic_notes")
                  ),
                ];
              }
              return [];
            },
          });
          // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
          // then a corresponding "Estimated Allowed Amount" must also be encoded. new in v2.2.0
          nonModifierChecks.push(
            ...this.payersPlans.map<ToastyValidator>((payerPlan) => {
              return {
                name: `estimated allowed amount for ${payerPlan} required when charge is only percentage or algorithm`,
                validator: (dataRow, row) => {
                  if (
                    !dataRow[
                      `standard_charge | ${payerPlan} | negotiated_dollar`
                    ] &&
                    (dataRow[
                      `standard_charge | ${payerPlan} | negotiated_percentage`
                    ] ||
                      dataRow[
                        `standard_charge | ${payerPlan} | negotiated_algorithm`
                      ]) &&
                    !dataRow[`estimated_amount | ${payerPlan}`]
                  ) {
                    return [
                      new PercentageAlgorithmEstimateError(
                        row,
                        this.normalizedColumns.indexOf(
                          `estimated_amount | ${payerPlan}`
                        )
                      ),
                    ];
                  }
                  return [];
                },
              };
            })
          );
          nonModifierChecks.push({
            name: "estimated allowed amount required when charge is only percentage or algorithm",
            validator: (dataRow, row) => {
              if (
                !dataRow["standard_charge | negotiated_dollar"] &&
                (dataRow["standard_charge | negotiated_percentage"] ||
                  dataRow["standard_charge | negotiated_algorithm"]) &&
                !dataRow.estimated_amount
              ) {
                return [
                  new PercentageAlgorithmEstimateError(
                    row,
                    this.normalizedColumns.indexOf("estimated_amount")
                  ),
                ];
              }
              return [];
            },
          });
        }

        // that's all for the conditional checks. so now build the tree out, branching on whether
        // the row is modifier-only.
        const isModifierPresent: ToastyValidator = {
          name: "is a modifier present",
          predicate: (row) => {
            return row["modifiers"].length > 0;
          },
          toastyChildren: modifierChecks, // validate modifier row,
          negativeValidator: (_dataRow, row) => {
            return [new CodePairMissingError(row, this.dataColumns.length)];
          },
          negativeChildren: nonModifierChecks, // non-modifier row
        };
        const containsCode: ToastyValidator = {
          name: "found at least one code",
          predicate: (row) => {
            return range(1, this.codeCount + 1).some((codeIndex) => {
              return (
                row[`code | ${codeIndex}`] || row[`code | ${codeIndex} | type`]
              );
            });
          },
          toastyChildren: nonModifierChecks, // non-modifier row
          negativeChildren: [isModifierPresent], // possibly modifier row
        };
        this.rowValidators.push(containsCode);
      } else {
        // for older versions, there is no notion of a "modifier row"
        // therefore, some code information is always required.
        // if only half of the pair is present, a different check accounts for that.
        this.rowValidators.push({
          name: "found at least one code",
          validator: (dataRow, row) => {
            const hasCodeInfo = range(1, this.codeCount + 1).some(
              (codeIndex) => {
                return (
                  dataRow[`code | ${codeIndex}`] ||
                  dataRow[`code | ${codeIndex} | type`]
                );
              }
            );
            if (!hasCodeInfo) {
              return [new CodePairMissingError(row, this.dataColumns.length)];
            }
            return [];
          },
        });
        this.rowValidators.push(...nonModifierChecks);
      }
    }
  }

  validate(input: File | NodeJS.ReadableStream): Promise<ValidationResult> {
    if (!CsvValidator.isAllowedVersion(this.version)) {
      return new Promise((resolve) => {
        resolve({
          valid: false,
          errors: [new InvalidVersionError(CsvValidator.allowedVersions)],
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
            ...sneakyValidateRequiredEnumField(1, index, header, value, [
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
    this.payersPlans = CsvValidator.getPayersPlans(columns);
    if (this.isTall === this.payersPlans.length > 0) {
      return [new AmbiguousFormatError()];
    }
    this.dataColumns = [];
    this.normalizedColumns = [];
    const errors: CsvValidationError[] = [];
    this.codeCount = this.getCodeCount(columns);
    const expectedDataColumns = CsvValidator.getExpectedDataColumns(
      this.version,
      this.codeCount,
      this.payersPlans
    );
    columns.forEach((column, index) => {
      const matchingColumnIndex = expectedDataColumns.findIndex((expected) => {
        return sepColumnsEqual(column, expected.label);
      });
      if (matchingColumnIndex > -1) {
        this.dataColumns[index] = column;
        this.normalizedColumns[index] =
          expectedDataColumns[matchingColumnIndex].label;
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
    this.normalizedColumns = this.normalizedColumns.map((column) => {
      if (column) {
        return column
          .split("|")
          .map((x) => x.trim())
          .join(" | ");
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
    range(1, Math.max(1, codeCount) + 1).forEach((i) => {
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

    if (semver.gte(version, "v2.2.0")) {
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

  static getPayersPlans(columns: string[]): string[] {
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

  validateDataRow(row: { [key: string]: string }): CsvValidationError[] {
    const errors: CsvValidationError[] = [];
    const validatorsToRun = [...this.rowValidators];
    while (validatorsToRun.length > 0) {
      const currentValidator = validatorsToRun.shift() as ToastyValidator;
      if (
        currentValidator.predicate == null ||
        currentValidator.predicate(row)
      ) {
        if (currentValidator.validator) {
          errors.push(...currentValidator.validator(row, this.index));
        }
        if (currentValidator.toastyChildren) {
          validatorsToRun.unshift(...currentValidator.toastyChildren);
        }
      } else {
        if (currentValidator.negativeValidator) {
          errors.push(...currentValidator.negativeValidator(row, this.index));
        }
        if (currentValidator.negativeChildren) {
          validatorsToRun.unshift(...currentValidator.negativeChildren);
        }
      }
    }
    return errors;
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
      } else {
        this.buildRowValidators();
      }
    } else {
      // regular data row
      const rowRecord = objectFromKeysValues(this.normalizedColumns, row);
      this.errors.push(...this.validateDataRow(rowRecord));
      if (this.dataCallback) {
        this.dataCallback(rowRecord);
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
