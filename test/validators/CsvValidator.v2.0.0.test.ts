import _ from "lodash";
import {
  AFFIRMATION,
  CsvValidator,
} from "../../src/validators/CsvValidator.js";
import {
  AllowedValuesError,
  CodePairMissingError,
  ColumnMissingError,
  DuplicateHeaderColumnError,
  HeaderColumnMissingError,
  InvalidDateError,
  InvalidNumberError,
  InvalidStateCodeError,
  RequiredValueError,
} from "../../src/errors/csv/index.js";
import {
  BILLING_CODE_TYPES,
  STANDARD_CHARGE_METHODOLOGY,
} from "../../src/validators/CsvHelpers.js";

const { shuffle } = _;

describe("schema v2.0.0", () => {
  let validator: CsvValidator;

  beforeEach(() => {
    validator = new CsvValidator("v2.0.0");
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
      const result = validator.validateHeaderRow(["", "", "", "", "", "", ""]);
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
        "standard_charge | gross",
        "standard_charge | discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
        "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
        "standard_charge | Payer ABC | Plan 1 | negotiated_percentage",
        "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
        "standard_charge | Payer ABC | Plan 1 | methodology",
        "additional_payer_notes | Payer ABC | Plan 1",
        "additional_generic_notes",
      ]);
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(0);
      expect(validator.isTall).toBe(false);
      expect(validator.dataColumns).toEqual(columns);
    });

    it("should save the normalized form of the columns when validating wide columns", () => {
      // normalized means that the pipe separator will have one space on each side,
      // and anything other than payer-plan text will be lowercase.
      const columns = [
        "Description",
        "code | 1",
        "code | 1 | type",
        "setting",
        "standard_charge   | gross",
        "standard_charge |   discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
        "standard_charge |Payer ABC | Plan 1 | negotiated_dollar",
        "standard_charge |Payer ABC | Plan 1 | negotiated_percentage",
        "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
        "standard_charge | Payer ABC | Plan 1 | methodology",
        "additional_payer_notes | Payer ABC | Plan 1",
        "additional_generic_notes",
      ];
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(0);
      expect(validator.isTall).toBe(false);
      expect(validator.dataColumns).toEqual(columns);
      expect(validator.normalizedColumns).toEqual([
        "description",
        "code | 1",
        "code | 1 | type",
        "setting",
        "standard_charge | gross",
        "standard_charge | discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
        "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
        "standard_charge | Payer ABC | Plan 1 | negotiated_percentage",
        "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
        "standard_charge | Payer ABC | Plan 1 | methodology",
        "additional_payer_notes | Payer ABC | Plan 1",
        "additional_generic_notes",
      ]);
    });

    it("should save the normalized form of the columns when validating tall columns", () => {
      const columns = [
        "Description",
        "code | 1",
        "code | 1 | type",
        "setting",
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
      ]);
    });

    it("should return no errors when additional undefined columns are provided", () => {
      // modifiers, drug measurement, and estimated amount columns are not defined in v2.1.0
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
      ]);
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(0);
      expect(validator.isTall).toBe(true);
      expect(validator.dataColumns).toEqual(columns);
    });

    it("should return errors when some payer-plan specific columns are missing", () => {
      const columns = shuffle([
        "description",
        "code | 1",
        "code | 1 | type",
        "setting",
        "drug_unit_of_measurement",
        "drug_type_of_measurement",
        "standard_charge | gross",
        "standard_charge | discounted_cash",
        "standard_charge | min",
        "standard_charge | max",
        "standard_charge | Payer ABC | Plan 1 | methodology",
        "additional_generic_notes",
      ]);
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(4);
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
        new ColumnMissingError("additional_payer_notes | Payer ABC | Plan 1")
      );
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
    ];
    const normalizedColumns = [
      "description",
      "code | 1",
      "code | 1 | type",
      "code | 2",
      "code | 2 | type",
      "setting",
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

    it("should return an error when standard charge dollar is present, but not a positive number", () => {
      row["standard_charge | negotiated_dollar"] = "0";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidNumberError(
          validator.index,
          normalizedColumns.indexOf("standard_charge | negotiated_dollar"),
          "standard_charge | negotiated_dollar",
          "0"
        )
      );
    });

    it("should return an error when standard charge percentage is present, but not a positive number", () => {
      row["standard_charge | negotiated_percentage"] = "N/a";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidNumberError(
          validator.index,
          normalizedColumns.indexOf("standard_charge | negotiated_percentage"),
          "standard_charge |  negotiated_percentage",
          "N/a"
        )
      );
    });

    it("should return an error when standard charge methodology is present, but not one of the allowed values", () => {
      row["standard_charge | methodology"] = "something else";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new AllowedValuesError(
          validator.index,
          normalizedColumns.indexOf("standard_charge | methodology"),
          "standard_charge | methodology",
          "something else",
          STANDARD_CHARGE_METHODOLOGY
        )
      );
    });

    it("should return an error when no code pairs are present", () => {
      row["code | 1"] = "";
      row["code | 1 | type"] = "";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(new CodePairMissingError(validator.index));
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
  });

  describe("#validateDataRow wide", () => {
    const columns = [
      "description",
      "setting",
      "code | 1",
      "code | 1 | type",
      "code | 2",
      "code | 2 | type",
      "standard_charge | gross",
      "standard_charge | discounted_cash",
      "standard_charge | min",
      "standard_charge | max",
      "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
      "standard_charge | Payer ABC | Plan 1 | negotiated_percentage",
      "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
      "standard_charge | Payer ABC | Plan 1 | methodology",
      "additional_payer_notes | Payer ABC | Plan 1",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_dollar",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm",
      "standard_charge | Payer XYZ | Plan 2 | methodology",
      "additional_payer_notes | Payer XYZ | Plan 2",
      "additional_generic_notes",
    ];
    const normalizedColumns = [
      "description",
      "setting",
      "code | 1",
      "code | 1 | type",
      "code | 2",
      "code | 2 | type",
      "standard_charge | gross",
      "standard_charge | discounted_cash",
      "standard_charge | min",
      "standard_charge | max",
      "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
      "standard_charge | Payer ABC | Plan 1 | negotiated_percentage",
      "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm",
      "standard_charge | Payer ABC | Plan 1 | methodology",
      "additional_payer_notes | Payer ABC | Plan 1",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_dollar",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm",
      "standard_charge | Payer XYZ | Plan 2 | methodology",
      "additional_payer_notes | Payer XYZ | Plan 2",
      "additional_generic_notes",
    ];
    let row: { [key: string]: string } = {};

    beforeEach(() => {
      validator.index = Math.floor(Math.random() * 1000);
      validator.dataColumns = columns;
      validator.normalizedColumns = normalizedColumns;
      validator.isTall = false;
      validator.codeCount = validator.getCodeCount(columns);
      validator.payersPlans = validator.getPayersPlans(columns);
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
        "standard_charge | gross": "100",
        "standard_charge | discounted_cash": "",
        "standard_charge | min": "",
        "standard_charge | max": "",
        "standard_charge | Payer ABC | Plan 1 | negotiated_dollar": "",
        "standard_charge | Payer ABC | Plan 1 | negotiated_percentage": "",
        "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm": "",
        "standard_charge | Payer ABC | Plan 1 | methodology": "",
        "additional_payer_notes | Payer ABC | Plan 1": "",
        "standard_charge | Payer XYZ | Plan 2 | negotiated_dollar": "",
        "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage": "",
        "standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm": "",
        "standard_charge | Payer XYZ | Plan 2 | methodology": "",
        "additional_payer_notes | Payer XYZ | Plan 2": "",
        additional_generic_notes: "",
      };
    });

    it("should return no errors when a valid wide data row is provided", () => {
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    it("should return an error when standard charge dollar is present, but not a positive number", () => {
      row["standard_charge | Payer ABC | Plan 1 | negotiated_dollar"] = "$5";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidNumberError(
          validator.index,
          normalizedColumns.indexOf(
            "standard_charge | Payer ABC | Plan 1 | negotiated_dollar"
          ),
          "standard_charge | Payer ABC | Plan 1 | negotiated_dollar",
          "$5"
        )
      );
    });

    it("should return an error when standard charge percentage is present, but not a positive number", () => {
      row["standard_charge | Payer XYZ | Plan 2 | negotiated_percentage"] =
        "free";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidNumberError(
          validator.index,
          normalizedColumns.indexOf(
            "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage"
          ),
          "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage",
          "free"
        )
      );
    });

    it("should return an error when standard charge methodology is present, but not one of the allowed values", () => {
      row["standard_charge | Payer ABC | Plan 1 | methodology"] = "incorrect";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new AllowedValuesError(
          validator.index,
          normalizedColumns.indexOf(
            "standard_charge | Payer ABC | Plan 1 | methodology"
          ),
          "standard_charge | Payer ABC | Plan 1 | methodology",
          "incorrect",
          STANDARD_CHARGE_METHODOLOGY
        )
      );
    });
  });
});
