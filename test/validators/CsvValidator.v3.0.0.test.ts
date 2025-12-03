import _ from "lodash";
import { CsvValidator } from "../../src/validators/CsvValidator.js";
import {
  AllowedCountZeroNotesError,
  AmbiguousFormatError,
  ChargeWithPayerPlanError,
  ColumnMissingError,
  InvalidCountNumberError,
  InvalidPositiveNumberError,
  PercentageAlgorithm10thError,
  PercentageAlgorithm90thError,
  PercentageAlgorithmCountError,
  PercentageAlgorithmMedianError,
  RequiredValueError,
} from "../../src/errors/csv/index.js";
import { ATTESTATION } from "../../src/validators/CsvHelpers.js";
import { CsvFalseAttestationAlert } from "../../src/alerts/FalseStatementAlert.js";

const { shuffle } = _;

describe("CsvValidator v3.0.0", () => {
  let validator: CsvValidator;

  beforeEach(() => {
    validator = new CsvValidator("v3.0.0");
  });

  describe("#validateHeaderColumns", () => {
    it("should return no errors when valid header columns are provided", () => {
      const columns = shuffle([
        "hospital_name",
        "last_updated_on",
        "version",
        "location_name",
        "hospital_address",
        "license_number | MD",
        ATTESTATION,
        "attester_name",
        "type_2_npi",
      ]);
      const result = validator.validateHeaderColumns(columns);
      expect(result).toHaveLength(0);
      expect(validator.headerColumns).toEqual(columns);
    });
  });

  describe("#validateHeaderRow", () => {
    const headerColumns = [
      "hospital_name",
      "last_updated_on",
      "version",
      "location_name",
      "hospital_address",
      "license_number | MD",
      ATTESTATION,
      "attester_name",
      "type_2_npi",
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
        "Alex Attester",
        "1122334455",
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
        "",
        "",
      ]);
      // expected length is 8 since license number is optional
      expect(result).toHaveLength(8);
      expect(result.every((csvErr) => csvErr instanceof RequiredValueError));
      const requiredValueHeaderColumns = [
        "hospital_name",
        "last_updated_on",
        "version",
        "location_name",
        "hospital_address",
        ATTESTATION,
        "attester_name",
        "type_2_npi",
      ];
      requiredValueHeaderColumns.forEach((headerColumn) => {
        expect(result).toContainEqual(
          expect.objectContaining({
            columnName: headerColumn,
          })
        );
      });
    });
  });

  describe("#alertHeaderRow", () => {
    const headerColumns = [
      "hospital_name",
      "last_updated_on",
      "version",
      "location_name",
      "hospital_address",
      "license_number | MD",
      ATTESTATION,
      "attester_name",
      "type_2_npi",
    ];

    beforeEach(() => {
      validator.headerColumns = [...headerColumns];
    });

    it("should return an alert when the attestation confirmation is false", () => {
      const result = validator.alertHeaderRow([
        "name",
        "2022-01-01",
        "1.0.0",
        "Woodlawn",
        "123 Address",
        "001 | MD",
        "false",
        "Alex Attester",
        "1122334455",
      ]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(new CsvFalseAttestationAlert(6));
    });

    it("should return no alerts when the attestation confirmation is anything other than false", () => {
      const result = validator.alertHeaderRow([
        "name",
        "2022-01-01",
        "1.0.0",
        "Woodlawn",
        "123 Address",
        "001 | MD",
        "I agree",
        "Alex Attester",
        "1122334455",
      ]);
      expect(result).toHaveLength(0);
    });

    it("should handle a case where a header column is blank", () => {
      validator.headerColumns = [
        "hospital_name",
        "last_updated_on",
        "version",
        "location_name",
        "this_one_is_deleted",
        "hospital_address",
        "license_number | MD",
        ATTESTATION,
        "attester_name",
        "type_2_npi",
      ];
      delete validator.headerColumns[4];
      const result = validator.alertHeaderRow([
        "name",
        "2022-01-01",
        "1.0.0",
        "Woodlawn",
        "",
        "123 Address",
        "001 | MD",
        "true",
        "Alex Attester",
        "1122334455",
      ]);
      expect(result).toHaveLength(0);
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
        "median_amount",
        "10th_percentile",
        "90th_percentile",
        "count",
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
        "median_amount |  Payer ABC | Plan 1",
        "10th_percentile |  Payer ABC | Plan 1",
        "90th_percentile |  Payer ABC | Plan 1",
        "additional_payer_notes | Payer ABC | Plan 1",
        "count | Payer ABC | Plan 1",
        "additional_generic_notes",
      ]);
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(0);
      expect(validator.isTall).toBe(false);
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
        "median_amount |  Payer ABC | Plan 1",
        "10th_percentile |  Payer ABC | Plan 1",
        "90th_percentile |  Payer ABC | Plan 1",
        "additional_payer_notes | Payer ABC | Plan 1",
        "count | Payer ABC | Plan 1",
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

    it("should return errors when newly required tall columns are missing", () => {
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
      ]);
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(4);
      expect(result).toContainEqual(new ColumnMissingError("median_amount"));
      expect(result).toContainEqual(new ColumnMissingError("10th_percentile"));
      expect(result).toContainEqual(new ColumnMissingError("90th_percentile"));
      expect(result).toContainEqual(new ColumnMissingError("count"));
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
        "10th_percentile |  Payer ABC | Plan 1",
        "90th_percentile |  Payer ABC | Plan 1",
        "additional_generic_notes",
      ]);
      const result = validator.validateColumns(columns);
      expect(result).toHaveLength(6);
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
        new ColumnMissingError("median_amount | Payer ABC | Plan 1")
      );
      expect(result).toContainEqual(
        new ColumnMissingError("additional_payer_notes | Payer ABC | Plan 1")
      );
      expect(result).toContainEqual(
        new ColumnMissingError("count | Payer ABC | Plan 1")
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
      "median_amount",
      "10th_percentile",
      "90th_percentile",
      "count",
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
      "median_amount",
      "10th_percentile",
      "90th_percentile",
      "count",
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
        median_amount: "",
        "10th_percentile": "",
        "90th_percentile": "",
        count: "",
      };
    });

    it("should return no errors when a valid tall data row with minimal data is provided", () => {
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    // CMG is a new allowed value for code type
    it("should return no errors when a CMG code is used", () => {
      row["code | 1 | type"] = "CMG";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    // count of allowed amounts, median, 10th percentile, and 90th percentile are new numeric fields
    // count of allowed amounts, unlike other numeric fields, may have a value of 0
    it("should return an error when count of allowed amounts is present, but not 0 or a postive number", () => {
      row.count = "None";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidCountNumberError(
          validator.index,
          normalizedColumns.indexOf("count"),
          "count",
          "None"
        )
      );
    });

    it("should return an error when median amount is present, but not a positive number", () => {
      row.median_amount = "XX";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidPositiveNumberError(
          validator.index,
          normalizedColumns.indexOf("median_amount"),
          "median_amount",
          "XX"
        )
      );
    });

    it("should return an error when 10th percentile is present, but not a positive number", () => {
      row["10th_percentile"] = "0";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidPositiveNumberError(
          validator.index,
          normalizedColumns.indexOf("10th_percentile"),
          "10th_percentile",
          "0"
        )
      );
    });

    it("should return an error when 90th percentile is present, but not a positive number", () => {
      row["90th_percentile"] = "Fifty-five";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidPositiveNumberError(
          validator.index,
          normalizedColumns.indexOf("90th_percentile"),
          "90th_percentile",
          "Fifty-five"
        )
      );
    });

    // If a "payer specific negotiated charge" is expressed as a percentage or algorithm,
    // then a count of allowed amounts must also be encoded.
    // If a "payer specific negotiated charge" is expressed as a percentage or algorithm, and count of allowed amounts is not 0,
    // then corresponding "Median", "10th percentile", and "90th percentile" must also be encoded. new in v3.0.0
    // Supersedes similar requirement from v2.2.0
    it("should return no errors when a payer-specific percentage or algorithm is encoded with a positive count of allowed amounts, median, 10th percentile, and 90th percentile", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "35";
      row.median_amount = "370";
      row["10th_percentile"] = "250";
      row["90th_percentile"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    it("should return no errors when a payer-specific percentage or algorithm is encoded with 1 through 10 count of allowed amounts, median, 10th percentile, and 90th percentile", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "1 through 10";
      row.median_amount = "370";
      row["10th_percentile"] = "250";
      row["90th_percentile"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    it("should return no errors when a payer-specific percentage or algorithm is encoded with count of allowed amounts of 0 and additional notes", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "0";
      row.additional_generic_notes = "explanation for 0 count";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with count of allowed amounts of 0 and no additional notes", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "0";
      row.additional_generic_notes = "";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new AllowedCountZeroNotesError(validator.index, 13)
      );
    });

    it("should return an error when count of allowed amounts is not 0, an integer 11 or greater, or the phrase 1 through 10", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "5";
      row.median_amount = "370";
      row["10th_percentile"] = "250";
      row["90th_percentile"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidCountNumberError(validator.index, 23, "count", "5")
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded without count of allowed amounts", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.median_amount = "370";
      row["10th_percentile"] = "250";
      row["90th_percentile"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithmCountError(validator.index, 23)
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with nonzero count and without median", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "45";
      row["10th_percentile"] = "250";
      row["90th_percentile"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithmMedianError(validator.index, 20)
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with nonzero count and without 10th percentile", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "55";
      row.median_amount = "370";
      row["90th_percentile"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithm10thError(validator.index, 21)
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with nonzero count and without 90th percentile", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      row["standard_charge | negotiated_percentage"] = "85";
      row["standard_charge | methodology"] = "fee schedule";
      row.count = "65";
      row["10th_percentile"] = "250";
      row.median_amount = "370";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithm90thError(validator.index, 22)
      );
    });

    it("should return an error when a payer and plan are listed, but no payer-specific charge is listed", () => {
      row.payer_name = "Payer Three";
      row.plan_name = "Plan W";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new ChargeWithPayerPlanError(validator.index, 14)
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
      "median_amount |  Payer ABC | Plan 1",
      "10th_percentile |  Payer ABC | Plan 1",
      "90th_percentile | Payer ABC | Plan 1",
      "count | Payer ABC | Plan 1",
      "additional_payer_notes | Payer ABC | Plan 1",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_dollar",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm",
      "standard_charge | Payer XYZ | Plan 2 | methodology",
      "median_amount | Payer XYZ | Plan 2",
      "10th_percentile | Payer XYZ | Plan 2",
      "90th_percentile | Payer XYZ | Plan 2",
      "count | Payer XYZ | Plan 2",
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
      "median_amount | Payer ABC | Plan 1",
      "10th_percentile | Payer ABC | Plan 1",
      "90th_percentile | Payer ABC | Plan 1",
      "count | Payer ABC | Plan 1",
      "additional_payer_notes | Payer ABC | Plan 1",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_dollar",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage",
      "standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm",
      "standard_charge | Payer XYZ | Plan 2 | methodology",
      "median_amount | Payer XYZ | Plan 2",
      "10th_percentile | Payer XYZ | Plan 2",
      "90th_percentile | Payer XYZ | Plan 2",
      "count | Payer XYZ | Plan 2",
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
        drug_unit_of_measurement: "",
        drug_type_of_measurement: "",
        modifiers: "",
        "standard_charge | gross": "100",
        "standard_charge | discounted_cash": "",
        "standard_charge | min": "",
        "standard_charge | max": "",
        "standard_charge | Payer ABC | Plan 1 | negotiated_dollar": "",
        "standard_charge | Payer ABC | Plan 1 | negotiated_percentage": "",
        "standard_charge | Payer ABC | Plan 1 | negotiated_algorithm": "",
        "standard_charge | Payer ABC | Plan 1 | methodology": "",
        "median_amount | Payer ABC | Plan 1": "",
        "10th_percentile | Payer ABC | Plan 1": "",
        "90th_percentile | Payer ABC | Plan 1": "",
        "count | Payer ABC | Plan 1": "",
        "additional_payer_notes | Payer ABC | Plan 1": "",
        "standard_charge | Payer XYZ | Plan 2 | negotiated_dollar": "",
        "standard_charge | Payer XYZ | Plan 2 | negotiated_percentage": "",
        "standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm": "",
        "standard_charge | Payer XYZ | Plan 2 | methodology": "",
        "median_amount | Payer XYZ | Plan 2": "",
        "10th_percentile | Payer XYZ | Plan 2": "",
        "90th_percentile | Payer XYZ | Plan 2": "",
        "count | Payer XYZ | Plan 2": "",
        "additional_payer_notes | Payer XYZ | Plan 2": "",
        additional_generic_notes: "",
      };
    });

    it("should return no errors when a valid wide data row is provided", () => {
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    // count of allowed amounts, median, 10th percentile, and 90th percentile are new numeric fields
    // count of allowed amounts, unlike other numeric fields, may have a value of 0
    it("should return an error when count of allowed amounts is present, but not 0 or a postive number", () => {
      row["count | Payer XYZ | Plan 2"] = "no claims";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidCountNumberError(
          validator.index,
          normalizedColumns.indexOf("count | Payer XYZ | Plan 2"),
          "count | Payer XYZ | Plan 2",
          "no claims"
        )
      );
    });

    it("should return an error when median amount is present, but not a positive number", () => {
      row["median_amount | Payer ABC | Plan 1"] = "N/A";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidPositiveNumberError(
          validator.index,
          normalizedColumns.indexOf("median_amount | Payer ABC | Plan 1"),
          "median_amount |  Payer ABC | Plan 1",
          "N/A"
        )
      );
    });

    it("should return an error when 10th percentile amount is present, but not a positive number", () => {
      row["10th_percentile | Payer XYZ | Plan 2"] = "0";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidPositiveNumberError(
          validator.index,
          normalizedColumns.indexOf("10th_percentile | Payer XYZ | Plan 2"),
          "10th_percentile | Payer XYZ | Plan 2",
          "0"
        )
      );
    });

    it("should return an error when median amount is present, but not a positive number", () => {
      row["90th_percentile | Payer ABC | Plan 1"] = "max allowed";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new InvalidPositiveNumberError(
          validator.index,
          normalizedColumns.indexOf("90th_percentile | Payer ABC | Plan 1"),
          "90th_percentile | Payer ABC | Plan 1",
          "max allowed"
        )
      );
    });

    // If a "payer specific negotiated charge" is expressed as a percentage or algorithm,
    // then a count of allowed amounts must also be encoded.
    // If a "payer specific negotiated charge" is expressed as a percentage or algorithm, and count of allowed amounts is not 0,
    // then corresponding "Median", "10th percentile", and "90th percentile" must also be encoded. new in v3.0.0
    // Supersedes similar requirement from v2.2.0
    it("should return no errors when a payer-specific percentage or algorithm is encoded with count of allowed amounts, median, 10th percentile, and 90th percentile", () => {
      row["standard_charge | Payer ABC | Plan 1 | negotiated_percentage"] =
        "85";
      row["standard_charge | Payer ABC | Plan 1 | methodology"] =
        "fee schedule";
      row["count | Payer ABC | Plan 1"] = "35";
      row["median_amount | Payer ABC | Plan 1"] = "370";
      row["10th_percentile | Payer ABC | Plan 1"] = "250";
      row["90th_percentile | Payer ABC | Plan 1"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    it("should return no errors when a payer-specific percentage or algorithm is encoded with count of allowed amounts of 0 and additional notes", () => {
      row["standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm"] =
        "An Algorithm";
      row["standard_charge | Payer XYZ | Plan 2 | methodology"] =
        "fee schedule";
      row["count | Payer XYZ | Plan 2"] = "0";
      row["additional_payer_notes | Payer XYZ | Plan 2"] =
        "sufficient explanation";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(0);
    });

    it("should return no errors when a payer-specific percentage or algorithm is encoded with count of allowed amounts of 0 and no additional notes", () => {
      row["standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm"] =
        "An Algorithm";
      row["standard_charge | Payer XYZ | Plan 2 | methodology"] =
        "fee schedule";
      row["count | Payer XYZ | Plan 2"] = "0";
      row["additional_payer_notes | Payer XYZ | Plan 2"] = "";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new AllowedCountZeroNotesError(validator.index, 30)
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded without count of allowed amounts", () => {
      row["standard_charge | Payer ABC | Plan 1 | negotiated_percentage"] =
        "85";
      row["standard_charge | Payer ABC | Plan 1 | methodology"] =
        "fee schedule";
      row["median_amount | Payer ABC | Plan 1"] = "370";
      row["10th_percentile | Payer ABC | Plan 1"] = "250";
      row["90th_percentile | Payer ABC | Plan 1"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithmCountError(
          validator.index,
          normalizedColumns.indexOf("count | Payer ABC | Plan 1")
        )
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with nonzero count and without median", () => {
      row["standard_charge | Payer XYZ | Plan 2 | negotiated_algorithm"] =
        "An Algorithm";
      row["standard_charge | Payer XYZ | Plan 2 | methodology"] =
        "fee schedule";
      row["count | Payer XYZ | Plan 2"] = "573";
      row["10th_percentile | Payer XYZ | Plan 2"] = "250";
      row["90th_percentile | Payer XYZ | Plan 2"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithmMedianError(
          validator.index,
          normalizedColumns.indexOf("median_amount | Payer XYZ | Plan 2")
        )
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with nonzero count and without 10th percentile", () => {
      row["standard_charge | Payer ABC | Plan 1 | negotiated_algorithm"] =
        "standard rate formula that we keep secret";
      row["standard_charge | Payer ABC | Plan 1 | methodology"] =
        "fee schedule";
      row["count | Payer ABC | Plan 1"] = "250";
      row["median_amount | Payer ABC | Plan 1"] = "370";
      row["90th_percentile | Payer ABC | Plan 1"] = "505";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithm10thError(
          validator.index,
          normalizedColumns.indexOf("10th_percentile | Payer ABC | Plan 1")
        )
      );
    });

    it("should return an error when a payer-specific percentage or algorithm is encoded with nonzero count and without 90th percentile", () => {
      row["standard_charge | Payer XYZ | Plan 2 | negotiated_percentage"] =
        "85";
      row["standard_charge | Payer XYZ | Plan 2 | methodology"] =
        "fee schedule";
      row["count | Payer XYZ | Plan 2"] = "573";
      row["median_amount | Payer XYZ | Plan 2"] = "505";
      row["10th_percentile | Payer XYZ | Plan 2"] = "250";
      const result = validator.validateDataRow(row);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new PercentageAlgorithm90thError(
          validator.index,
          normalizedColumns.indexOf("90th_percentile | Payer XYZ | Plan 2")
        )
      );
    });
  });
});
