import * as fs from "fs";
import * as path from "path";
import {
  AFFIRMATION,
  BILLING_CODE_TYPES,
  CsvValidator,
  DRUG_UNITS,
} from "../../src/validators/CsvValidator";
import {
  AllowedValuesError,
  AmbiguousFormatError,
  CodePairMissingError,
  ColumnMissingError,
  DollarNeedsMinMaxError,
  DuplicateColumnError,
  DuplicateHeaderColumnError,
  HeaderColumnMissingError,
  InvalidDateError,
  InvalidNumberError,
  InvalidStateCodeError,
  ItemRequiresChargeError,
  OtherMethodologyNotesError,
  RequiredValueError,
} from "../../src/errors/csv";
import { shuffle } from "lodash";
// import { BILLING_CODE_TYPES } from "../../src/types";

describe("CsvValidator", () => {
  describe("constructor", () => {});

  describe("#reset", () => {});

  describe("schema v2.0.0", () => {});

  describe("schema v2.1.0", () => {});

  describe("schema v2.2.0", () => {
    let validator: CsvValidator;

    beforeEach(() => {
      validator = new CsvValidator("v2.2.0");
    });

    describe("#validate", () => {
      it.skip("should validate a valid tall CSV file", async () => {
        const input = fs.createReadStream(
          path.join(__dirname, "..", "fixtures", "sample-tall-valid.csv")
        );
        const result = await validator.validate(input);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it.skip("should validate a valid wide CSV file", async () => {
        const input = fs.createReadStream(
          path.join(__dirname, "..", "fixtures", "sample-wide-valid.csv")
        );
        const result = await validator.validate(input);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe("#validateHeaderColumns", () => {
      it("should return no errors when valid header columns are provided", () => {
        const columns = shuffle([
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          "license_number | MD",
          AFFIRMATION,
        ]);
        const result = validator.validateHeaderColumns(columns);
        expect(result).toHaveLength(0);
        expect(validator.headerColumns).toEqual(columns);
      });

      it("should return errors when required header columns are missing", () => {
        const result = validator.validateHeaderColumns([]);
        expect(result).toHaveLength(7);
        expect(result[0]).toBeInstanceOf(HeaderColumnMissingError);
        expect((result[0] as HeaderColumnMissingError).columnName).toBe(
          "hospital_name"
        );
      });

      it("should return errors and remove duplicates when a header column appears more than once", () => {
        const columns = [
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          "hospital_location",
          "license_number | MD",
          AFFIRMATION,
        ];
        const result = validator.validateHeaderColumns(columns);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(DuplicateHeaderColumnError);
        expect((result[0] as DuplicateHeaderColumnError).columnName).toBe(
          "hospital_location"
        );
        expect(validator.headerColumns).toEqual([
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          undefined,
          "license_number | MD",
          AFFIRMATION,
        ]);
      });

      it("should return an error when the license number column contains an invalid state abbreviation", () => {
        const columns = [
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          "license_number | XYZZY",
          AFFIRMATION,
        ];
        const result = validator.validateHeaderColumns(columns);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual(new InvalidStateCodeError(5, "XYZZY"));
        expect(result).toContainEqual(
          new HeaderColumnMissingError("license_number | [state]")
        );
        expect(validator.headerColumns).toEqual([
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          undefined,
          AFFIRMATION,
        ]);
      });

      it("should return an error when the license number column has the first part incorrect", () => {
        const columns = shuffle([
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          "licensing_number | MD",
          AFFIRMATION,
        ]);
        const result = validator.validateHeaderColumns(columns);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new HeaderColumnMissingError("license_number | [state]")
        );
      });
    });

    describe("#validateHeaderRow", () => {
      const headerColumns = [
        "hospital_name",
        "last_updated_on",
        "version",
        "hospital_location",
        "hospital_address",
        "license_number | MD",
        AFFIRMATION,
      ];

      beforeEach(() => {
        validator.headerColumns = [...headerColumns];
      });

      it("should return no errors for valid header row values", () => {
        const result = validator.validateHeaderRow([
          "name",
          "2022-01-01",
          "1.0.0",
          "Woodlawn",
          "123 Address",
          "001 | MD",
          "true",
        ]);
        expect(result).toHaveLength(0);
      });

      it("should return no errors for header row values regardless of capitalization for state code or affirmation value", () => {
        const result = validator.validateHeaderRow([
          "name",
          "2022-01-01",
          "1.0.0",
          "Woodlawn",
          "123 Address",
          "001 | md",
          "TRUE",
        ]);
        expect(result).toHaveLength(0);
      });

      it("should return no errors when the value of last_updated_on is formatted as MM/DD/YYYY", () => {
        const result = validator.validateHeaderRow([
          "name",
          "01/07/2024",
          "1.0.0",
          "Woodlawn",
          "123 Address",
          "001 | MD",
          "true",
        ]);
        expect(result).toHaveLength(0);
      });

      it("should return no errors when the value of last_updated_on is formatted as M/D/YYYY", () => {
        const result = validator.validateHeaderRow([
          "name",
          "1/7/2024",
          "1.0.0",
          "Woodlawn",
          "123 Address",
          "001 | MD",
          "true",
        ]);
        expect(result).toHaveLength(0);
      });

      it("should return a RequiredValueError error for any header row value that is empty", () => {
        const result = validator.validateHeaderRow([
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        // expected length is 6 since license number is optional
        expect(result).toHaveLength(6);
        expect(result.every((csvErr) => csvErr instanceof RequiredValueError));
        const requiredValueHeaderColumns = [
          "hospital_name",
          "last_updated_on",
          "version",
          "hospital_location",
          "hospital_address",
          AFFIRMATION,
        ];
        requiredValueHeaderColumns.forEach((headerColumn) => {
          expect(result).toContainEqual(
            expect.objectContaining({
              columnName: headerColumn,
            })
          );
        });
      });

      it("should return an InvalidDateError when the last_updated_on value is not a valid date", () => {
        const result = validator.validateHeaderRow([
          "name",
          "2022-14-01",
          "1.0.0",
          "Woodlawn",
          "123 Address",
          "001 | MD",
          "true",
        ]);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual<InvalidDateError>(
          new InvalidDateError(1, 1, "last_updated_on", "2022-14-01")
        );
      });

      it("should return an AllowedValuesError when the affirmation value is not true or false", () => {
        const result = validator.validateHeaderRow([
          "name",
          "2022-01-01",
          "1.0.0",
          "Woodlawn",
          "123 Address",
          "001 | MD",
          "yes",
        ]);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual<AllowedValuesError>(
          new AllowedValuesError(1, 6, AFFIRMATION, "yes", ["true", "false"])
        );
      });
    });

    describe("#validateColumns", () => {
      it("should return no errors when valid tall columns are provided", () => {
        // order of the columns does not matter
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge   | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(0);
        expect(validator.isTall).toBe(true);
        expect(validator.dataColumns).toEqual(columns);
      });

      it("should return no errors when valid wide columns are provided", () => {
        // order of the columns does not matter
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
          "standard_charge | Payer ABC | Plan 1 | negotiated_percentage",
          "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
          "standard_charge | Payer ABC | Plan 1 | methodology",
          "estimated_amount |  Payer ABC | Plan 1",
          "additional_payer_notes | Payer ABC | Plan 1",
          "additional_generic_notes",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(0);
        expect(validator.isTall).toBe(false);
        expect(validator.dataColumns).toEqual(columns);
      });

      it("should save the normalized form of the columns", () => {
        // normalized means that the pipe separator will have one space on each side
        const columns = [
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge   | gross",
          "standard_charge |   discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
        ];
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(0);
        expect(validator.isTall).toBe(true);
        expect(validator.dataColumns).toEqual(columns);
        expect(validator.normalizedColumns).toEqual([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
        ]);
      });

      it("should return no errors when additional undefined columns are provided", () => {
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
          "some_custom_column",
          "another undefined thing",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(0);
        expect(validator.isTall).toBe(true);
        expect(validator.dataColumns).toEqual(columns);
      });

      it("should return an error when both tall and wide columns are provided", () => {
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
          "standard_charge | Payer ABC | Plan 1 | negotiated_percentage",
          "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
          "standard_charge | Payer ABC | Plan 1 | methodology",
          "estimated_amount | Payer ABC | Plan 1",
          "additional_payer_notes | Payer ABC | Plan 1",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(AmbiguousFormatError);
        expect(validator.isTall).toBe(true);
        expect(validator.dataColumns).toEqual([]);
      });

      it("should return an error when neither tall nor wide columns are provided", () => {
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(AmbiguousFormatError);
        expect(validator.isTall).toBe(false);
        expect(validator.dataColumns).toEqual([]);
      });

      it("should return an error when there are no code or code type columns present", () => {
        const columns = shuffle([
          "description",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual(new ColumnMissingError("code | 1"));
        expect(result).toContainEqual(
          new ColumnMissingError("code | 1 | type")
        );
      });

      it("should return an error when a code column is present without a corresponding code type column", () => {
        const columns = shuffle([
          "description",
          "code | 1",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(new ColumnMissingError("code | 1 | type"));
      });

      it("should return an error when a code type column is present without a corresponding code column", () => {
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "code | 2 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(new ColumnMissingError("code | 2"));
      });

      it("should return errors when some payer-plan specific columns are missing", () => {
        const columns = shuffle([
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "standard_charge | Payer ABC | Plan 1 | methodology",
          "additional_generic_notes",
        ]);
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(5);
        expect(result).toContainEqual(
          new ColumnMissingError(
            "standard_charge | Payer ABC | Plan 1 | negotiated_dollar"
          )
        );
        expect(result).toContainEqual(
          new ColumnMissingError(
            "standard_charge | Payer ABC | Plan 1 | negotiated_percentage"
          )
        );
        expect(result).toContainEqual(
          new ColumnMissingError(
            "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm"
          )
        );
        expect(result).toContainEqual(
          new ColumnMissingError("estimated_amount | Payer ABC | Plan 1")
        );
        expect(result).toContainEqual(
          new ColumnMissingError("additional_payer_notes | Payer ABC | Plan 1")
        );
      });

      it("should return errors when columns are duplicated", () => {
        // not shuffling this time, since we want to know where the duplicates appear
        const columns = [
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          "setting", // duplicate!
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "estimated_amount",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
          "estimated_amount", // duplicate!
        ];
        const result = validator.validateColumns(columns);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual(new DuplicateColumnError(7, "setting"));
        expect(result).toContainEqual(
          new DuplicateColumnError(20, "estimated_amount")
        );
        expect(validator.isTall).toBe(true);
        const expectedColumns = [
          "description",
          "code | 1",
          "code | 1 | type",
          "setting",
          "drug_unit_of_measurement",
          "drug_type_of_measurement",
          "modifiers",
          undefined,
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | min",
          "standard_charge | max",
          "additional_generic_notes",
          "payer_name",
          "plan_name",
          "estimated_amount",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
          "standard_charge | methodology",
        ];
        expect(validator.dataColumns).toEqual(expectedColumns);
      });
    });

    describe("#validateDataRow tall", () => {
      const columns = [
        "description",
        "code |1",
        "code |1| type",
        "code |2",
        "code |2| type",
        "setting",
        "drug_unit_of_measurement",
        "drug_type_of_measurement",
        "modifiers",
        "standard_charge  | gross",
        "standard_charge | discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
        "additional_generic_notes",
        "payer_name",
        "plan_name",
        "standard_charge | negotiated_dollar",
        "standard_charge |  negotiated_percentage",
        "standard_charge | negotiated_algorithm",
        "standard_charge | methodology",
        "estimated_amount",
      ];
      const normalizedColumns = [
        "description",
        "code | 1",
        "code | 1 | type",
        "code | 2",
        "code | 2 | type",
        "setting",
        "drug_unit_of_measurement",
        "drug_type_of_measurement",
        "modifiers",
        "standard_charge | gross",
        "standard_charge | discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
        "additional_generic_notes",
        "payer_name",
        "plan_name",
        "standard_charge | negotiated_dollar",
        "standard_charge | negotiated_percentage",
        "standard_charge | negotiated_algorithm",
        "standard_charge | methodology",
        "estimated_amount",
      ];
      let row: { [key: string]: string } = {};

      beforeEach(() => {
        validator.index = Math.floor(Math.random() * 1000);
        validator.dataColumns = columns;
        validator.normalizedColumns = normalizedColumns;
        validator.isTall = true;
        validator.codeCount = validator.getCodeCount(columns);
        validator.rowValidators = [];
        validator.buildRowValidators();
        // start with the minimum amount of valid information
        row = {
          description: "basic description",
          setting: "inpatient",
          "code | 1": "12345",
          "code | 1 | type": "DRG",
          "code | 2": "",
          "code | 2 | type": "",
          drug_unit_of_measurement: "",
          drug_type_of_measurement: "",
          modifiers: "",
          "standard_charge | gross": "100",
          "standard_charge | discounted_cash": "",
          "standard_charge | min": "",
          "standard_charge | max": "",
          additional_generic_notes: "",
          payer_name: "",
          plan_name: "",
          "standard_charge | negotiated_dollar": "",
          "standard_charge | negotiated_percentage": "",
          "standard_charge | negotiated_algorithm": "",
          "standard_charge | methodology": "",
          estimated_amount: "",
        };
      });

      it("should return no errors when a valid tall data row with minimal data is provided", () => {
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return an error when no description is provided", () => {
        row.description = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new RequiredValueError(
            validator.index,
            normalizedColumns.indexOf("description"),
            "description"
          )
        );
      });

      it("should return an error when no setting is provided", () => {
        row.setting = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new RequiredValueError(
            validator.index,
            normalizedColumns.indexOf("setting"),
            "setting"
          )
        );
      });

      it("should return an error when setting is not one of the allowed values", () => {
        row.setting = "strange";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new AllowedValuesError(
            validator.index,
            normalizedColumns.indexOf("setting"),
            "setting",
            "strange",
            ["inpatient", "outpatient", "both"]
          )
        );
      });

      it("should return an error when both drug fields are present, but drug unit of measurement is not a positive number", () => {
        row.drug_type_of_measurement = "ML";
        row.drug_unit_of_measurement = "-4";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new InvalidNumberError(
            validator.index,
            normalizedColumns.indexOf("drug_unit_of_measurement"),
            "drug_unit_of_measurement",
            "-4"
          )
        );
      });

      it("should return an error when drug unit of measurement is missing and drug type of measurement is present", () => {
        row.drug_type_of_measurement = "ML";
        row.drug_unit_of_measurement = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new RequiredValueError(
            validator.index,
            normalizedColumns.indexOf("drug_unit_of_measurement"),
            "drug_unit_of_measurement",
            ' when "drug_type_of_measurement" is present'
          )
        );
      });

      it("should return an error when drug type of measurement is not one of the allowed values", () => {
        row.drug_type_of_measurement = "XYZ";
        row.drug_unit_of_measurement = "5";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new AllowedValuesError(
            validator.index,
            normalizedColumns.indexOf("drug_type_of_measurement"),
            "drug_type_of_measurement",
            "XYZ",
            DRUG_UNITS
          )
        );
      });

      it("should return an error when drug type of measurement is missing and drug unit of measurement is present", () => {
        row.drug_type_of_measurement = "";
        row.drug_unit_of_measurement = "5";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new RequiredValueError(
            validator.index,
            normalizedColumns.indexOf("drug_type_of_measurement"),
            "drug_type_of_measurement",
            ' when "drug_unit_of_measurement" is present'
          )
        );
      });

      it("should return an error when gross standard charge is present, but not a positive number", () => {
        row["standard_charge | gross"] = "$34";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new InvalidNumberError(
            validator.index,
            normalizedColumns.indexOf("standard_charge | gross"),
            "standard_charge  | gross",
            "$34"
          )
        );
      });

      it("should return an error when discounted cash standard charge is present, but not a positive number", () => {
        row["standard_charge | discounted_cash"] = "0.0";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new InvalidNumberError(
            validator.index,
            normalizedColumns.indexOf("standard_charge | discounted_cash"),
            "standard_charge | discounted_cash",
            "0.0"
          )
        );
      });

      it("should return an error when minimum standard charge is present, but not a positive number", () => {
        row["standard_charge | min"] = "NaN";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new InvalidNumberError(
            validator.index,
            normalizedColumns.indexOf("standard_charge | min"),
            "standard_charge | min",
            "NaN"
          )
        );
      });

      it("should return an error when maximum standard charge is present, but not a positive number", () => {
        row["standard_charge | max"] = "3,8";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new InvalidNumberError(
            validator.index,
            normalizedColumns.indexOf("standard_charge | max"),
            "standard_charge | max",
            "3,8"
          )
        );
      });

      it("should return an error when no code pairs are present", () => {
        row["code | 1"] = "";
        row["code | 1 | type"] = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new CodePairMissingError(validator.index, columns.length)
        );
      });

      it("should return no errors when the first code pair is empty, but another code pair is present", () => {
        row["code | 1"] = "";
        row["code | 1 | type"] = "";
        row["code | 2"] = "54321";
        row["code | 2 | type"] = "HCPCS";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return an error when a code is present without a code type", () => {
        row["code | 1 | type"] = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new RequiredValueError(
            validator.index,
            normalizedColumns.indexOf("code | 1 | type"),
            "code |1| type"
          )
        );
      });

      it("should return an error when a code type is present without a code", () => {
        row["code | 1"] = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new RequiredValueError(
            validator.index,
            normalizedColumns.indexOf("code | 1"),
            "code |1"
          )
        );
      });

      it("should return an error when a code type is not one of the allowed values", () => {
        row["code | 1 | type"] = "BOAT";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          new AllowedValuesError(
            validator.index,
            normalizedColumns.indexOf("code | 1 | type"),
            "code |1| type",
            "BOAT",
            BILLING_CODE_TYPES
          )
        );
      });

      // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
      // then a corresponding valid value for the payer name, plan name, and standard charge methodology must also be encoded.
      it("should return no errors when a payer specific negotiated charge is a dollar amount and valid values exist for payer name, plan name, and methodology", () => {
        row["standard_charge | negotiated_dollar"] = "300";
        row["standard_charge | min"] = "300";
        row["standard_charge | max"] = "300";
        row.payer_name = "Payer One";
        row.plan_name = "Plan A";
        row["standard_charge | methodology"] = "fee schedule";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return errors when a payer specific negotiated charge is a dollar amount, but no valid values exist for payer name, plan name, or methodology", () => {
        row["standard_charge | negotiated_dollar"] = "300";
        row["standard_charge | min"] = "300";
        row["standard_charge | max"] = "300";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(3);
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            14,
            "payer_name",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            15,
            "plan_name",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            19,
            "standard_charge | methodology",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
      });

      it("should return no errors when a payer specific negotiated charge is a percentage and valid values exist for payer name, plan name, and methodology", () => {
        row["standard_charge | negotiated_percentage"] = "80";
        row.payer_name = "Payer One";
        row.plan_name = "Plan B";
        row["standard_charge | methodology"] =
          "percent of total billed charges";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return errors when a payer specific negotiated charge is a percentage, but no valid values exist for payer name, plan name, or methodology", () => {
        row["standard_charge | negotiated_percentage"] = "80";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(3);
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            14,
            "payer_name",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            15,
            "plan_name",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            19,
            "standard_charge | methodology",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
      });

      it("should return no errors when a payer specific negotiated charge is an algorithm and valid values exist for payer name, plan name, and methodology", () => {
        row["standard_charge | negotiated_algorithm"] = "adjusted median scale";
        row.payer_name = "Payer One";
        row.plan_name = "Plan C";
        row["standard_charge | methodology"] = "case rate";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return errors when a payer specific negotiated charge is an algorithm, but no valid values exist for payer name, plan name, or methodology", () => {
        row["standard_charge | negotiated_algorithm"] = "adjusted median scale";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(3);
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            14,
            "payer_name",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            15,
            "plan_name",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
        expect(result).toContainEqual(
          new RequiredValueError(
            validator.index,
            19,
            "standard_charge | methodology",
            " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
          )
        );
      });

      // If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found
      // in the "additional notes" for the associated payer-specific negotiated charge.
      it("should return no errors when methodology is 'other' and additional notes are present", () => {
        row["standard_charge | negotiated_percentage"] = "85";
        row.payer_name = "Payer 2";
        row.plan_name = "Plan C";
        row["standard_charge | methodology"] = "other";
        row.additional_generic_notes = "explanation of the methodology";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return an error when methodology is 'other' and additional notes are missing", () => {
        row["standard_charge | negotiated_percentage"] = "85";
        row.payer_name = "Payer 2";
        row.plan_name = "Plan C";
        row["standard_charge | methodology"] = "other";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result).toContainEqual(
          new OtherMethodologyNotesError(validator.index, 13)
        );
      });

      // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
      // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
      // "Payer-Specific Negotiated Charge: Algorithm".
      it("should return an error when an item or service is encoded with no charges", () => {
        row["standard_charge | gross"] = "";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result).toContainEqual(
          new ItemRequiresChargeError(validator.index, 9)
        );
      });

      // a row with a gross charge is already covered by the "minimal data" test

      it("should return no errors when an item or service is encoded with a discounted cash price", () => {
        row["standard_charge | gross"] = "";
        row["standard_charge | discounted_cash"] = "300.50";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return no errors when an item or service is encoded with a payer-specific dollar amount", () => {
        row["standard_charge | gross"] = "";
        row["standard_charge | negotiated_dollar"] = "533";
        row["standard_charge | min"] = "533";
        row["standard_charge | max"] = "533";
        row.payer_name = "Payer 3";
        row.plan_name = "Regular plan";
        row["standard_charge | methodology"] = "fee schedule";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return no errors when an item or service is encoded with a payer-specific percentage", () => {
        row["standard_charge | gross"] = "";
        row["standard_charge | negotiated_percentage"] = "73.5";
        row.payer_name = "Payer 3";
        row.plan_name = "Regular plan";
        row["standard_charge | methodology"] = "case rate";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      it("should return no errors when an item or service is encoded with a payer-specific algorithm", () => {
        row["standard_charge | gross"] = "";
        row["standard_charge | negotiated_algorithm"] =
          "the compression function";
        row.payer_name = "Payer 3";
        row.plan_name = "Regular plan";
        row["standard_charge | methodology"] = "per diem";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(0);
      });

      // If there is a "payer specific negotiated charge" encoded as a dollar amount,
      // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
      it("should return an error when a payer-specific dollar amount is encoded without a min or max", () => {
        row["standard_charge | negotiated_dollar"] = "533";
        row.payer_name = "Payer 3";
        row.plan_name = "Regular plan";
        row["standard_charge | methodology"] = "fee schedule";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(DollarNeedsMinMaxError);
      });

      it("should return an error when a payer-specific dollar amount is encoded without a min", () => {
        row["standard_charge | negotiated_dollar"] = "533";
        row["standard_charge | max"] = "533";
        row.payer_name = "Payer 3";
        row.plan_name = "Regular plan";
        row["standard_charge | methodology"] = "fee schedule";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(DollarNeedsMinMaxError);
      });

      it("should return an error when a payer-specific dollar amount is encoded without a max", () => {
        row["standard_charge | negotiated_dollar"] = "533";
        row["standard_charge | min"] = "533";
        row.payer_name = "Payer 3";
        row.plan_name = "Regular plan";
        row["standard_charge | methodology"] = "fee schedule";
        const result = validator.validateDataRow(row);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(DollarNeedsMinMaxError);
      });

      // If a modifier is encoded without an item or service, then a description and one of the following
      // is the minimum information required:
      // additional_generic_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm
      it.todo(
        "should return an error when a modifier is encoded without an item or service, but none of the informational fields are present"
      );

      it.todo(
        "should return no errors when a modifier is encoded without an item or service and additional notes are provided"
      );

      it.todo(
        "should return no errors when a modifier is encoded without an item or service and a payer specific dollar amount is provided"
      );

      it.todo(
        "should return no errors when a modifier is encoded without an item or service and a payer specific percentage is provided"
      );

      it.todo(
        "should return no errors when a modifier is encoded without an item or service and a payer specific algorithm is provided"
      );

      // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
      // then a corresponding "Estimated Allowed Amount" must also be encoded. new in v2.2.0
      it.todo(
        "should return no errors when a payer-specific percentage is encoded with an estimated allowed amount"
      );

      it.todo(
        "should return an error when a payer-specific percentage is encoded without an estimated allowed amount"
      );

      it.todo(
        "should return no errors when a payer-specific algorithm is encoded with an estimated allowed amount"
      );

      it.todo(
        "should return an error when a payer-specific algorithm is encoded without an estimated allowed amount"
      );

      // If code type is NDC, then the corresponding drug unit of measure and
      // drug type of measure data elements must be encoded. new in v2.2.0
      it.todo(
        "should return an error when code type is NDC, but no drug information is present"
      );

      it.todo(
        "should return an error when more than one code is present, a code other than the first is NDC, but no drug information is present"
      );
    });

    describe("#validateDataRow wide", () => {
      it.todo("should return no errors when a valid wide data row is provided");

      // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
      // then a corresponding valid value for the payer name, plan name, and standard charge methodology must also be encoded.
      // Since the wide format incorporates payer name and plan name into the column name, only methodology is checked.
      it.todo(
        "should return no errors when a payer specific negotiated charge is a dollar amount and a valid value exists for methodology"
      );

      it.todo(
        "should return errors when a payer specific negotiated charge is a dollar amount, but no valid value exists for methodology"
      );

      it.todo(
        "should return no errors when a payer specific negotiated charge is a percentage and a valid value exists for methodology"
      );

      it.todo(
        "should return errors when a payer specific negotiated charge is a percentage, but no valid value exists for methodology"
      );

      it.todo(
        "should return no errors when a payer specific negotiated charge is an algorithm and a valid value exists for methodology"
      );

      it.todo(
        "should return errors when a payer specific negotiated charge is an algorithm, but no valid value exists for methodology"
      );

      // If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found
      // in the "additional notes" for the associated payer-specific negotiated charge.
      it.todo(
        "should return no errors when a methodology is 'other' and payer-specific notes are provided"
      );

      it.todo(
        "should return an error when a methodology is 'other' and payer-specific notes are not provided"
      );

      it.todo(
        "should return an error when a methodology is 'other' and payer-specific notes are provided for a different payer and plan"
      );

      // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
      // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
      // "Payer-Specific Negotiated Charge: Algorithm".
      it.todo(
        "should return an error when an item or service is encoded without any charges"
      );

      it.todo(
        "should return no errors when an item or service with only a gross charge"
      );

      it.todo(
        "should return no errors when an item or service with only a discounted cash price"
      );

      it.todo(
        "should return no errors when an item or service with only a payer-specific dollar amount"
      );

      it.todo(
        "should return no errors when an item or service with only a payer-specific percentage"
      );

      it.todo(
        "should return no errors when an item or service with only a payer-specific algorithm"
      );

      // If there is a "payer specific negotiated charge" encoded as a dollar amount,
      // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
      it.todo(
        "should return an error when a payer-specific dollar amount is encoded without a minimum or maximum"
      );

      it.todo(
        "should return no errors when a payer-specific percentage is encoded without a minimum or maximum"
      );

      it.todo(
        "should return no errors when a payer-specific algorithm is encoded without a minimum or maximum"
      );

      // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
      // then a corresponding "Estimated Allowed Amount" must also be encoded. new in v2.2.0
      it.todo(
        "should return no errors when a payer-specific percentage and an estimated allowed amount are provided"
      );

      it.todo(
        "should return an error when a payer-specific percentage but no estimated allowed amount are provided"
      );

      it.todo(
        "should return no errors when a payer-specific algorithm and an estimated allowed amount are provided"
      );

      it.todo(
        "should return an error when a payer-specific algorithm but no estimated allowed amount are provided"
      );

      it.todo(
        "should return an error when a payer-specific percentage is provided, but the estimated allowed amount is provided for a different payer and plan"
      );

      it.todo(
        "should return an error when a payer-specific algorithm is provided, but the estimated allowed amount is provided for a different payer and plan"
      );

      // If code type is NDC, then the corresponding drug unit of measure and
      // drug type of measure data elements must be encoded. new in v2.2.0
      it.todo(
        "should return an error when code type is NDC, but no drug information is present"
      );

      it.todo(
        "should return an error when more than one code is present, a code other than the first is NDC, but no drug information is present"
      );
    });
  });
});
