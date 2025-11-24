import { CsvValidator } from "../../src/validators/CsvValidator.js";
import {
  HeaderBlankError,
  InvalidVersionError,
  MinRowsError,
  ProblemsInHeaderError,
} from "../../src/errors/csv/index.js";
import { createFixtureStream } from "test/testhelpers/createFixtureStream.js";

describe("CsvValidator", () => {
  describe("constructor", () => {
    it("should create a CsvValidator instance with a version", () => {
      const validator = new CsvValidator("v2.0.0");
      expect(validator.version).toBe("2.0.0");
      expect(validator.fileType).toBe("csv");
      expect(validator.maxErrors).toBe(0);
      expect(validator.dataCallback).toBeUndefined();
    });

    it("should create a CsvValidator instance with additional options", () => {
      const valueCallback = (value: { [key: string]: string }) => {
        value.changed = "true";
      };
      const options = {
        maxErrors: 50,
        onValueCallback: valueCallback,
      };
      const validator = new CsvValidator("v2.1.0", options);
      expect(validator.version).toBe("2.1.0");
      expect(validator.fileType).toBe("csv");
      expect(validator.maxErrors).toBe(50);
      expect(validator.dataCallback).toBe(valueCallback);
    });
  });

  describe("#validate", () => {
    it("should return an error when attempting to validate against an invalid version", async () => {
      const validator = new CsvValidator("x.y.z");
      const input = createFixtureStream("sample-tall-valid.csv");
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBeInstanceOf(InvalidVersionError);
    });

    it("should return an error when a header row is blank", async () => {
      const validator = new CsvValidator("v2.2.0");
      const input = createFixtureStream("sample-blank-header.csv");
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBeInstanceOf(HeaderBlankError);
    });

    it("should return an error when there are no data rows", async () => {
      const validator = new CsvValidator("v2.2.0");
      const input = createFixtureStream("sample-no-data.csv");
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBeInstanceOf(MinRowsError);
    });

    it("should stop validation when there are problems in the header", async () => {
      const validator = new CsvValidator("v2.2.0");
      const input = createFixtureStream("sample-bad-header.csv");
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(2);
      expect(results.errors[1]).toBeInstanceOf(ProblemsInHeaderError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      const validator = new CsvValidator("v2.2.0", {
        maxErrors: 5,
      });
      const input = createFixtureStream("sample-lots-of-errors.csv");
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(5);
    });

    it("should call a supplied data callback for each item or service row", async () => {
      const codeTypes = new Set<string>();
      function myDataCallback(
        this: CsvValidator,
        val: { [key: string]: string }
      ) {
        for (let codeIdx = 1; codeIdx <= this.codeCount; codeIdx++) {
          if (val[`code | ${codeIdx} | type`]) {
            codeTypes.add(val[`code | ${codeIdx} | type`].toLocaleUpperCase());
          }
        }
      }
      const input = createFixtureStream("sample-tall-valid.csv");
      const validator = new CsvValidator("v2.2.0", {
        onValueCallback: myDataCallback,
      });
      const result = await validator.validate(input);
      expect(result.errors).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
      expect(result.valid).toBe(true);
      expect(codeTypes).toEqual(
        new Set(["MS-DRG", "LOCAL", "CPT", "HCPCS", "RC"])
      );
    });
  });
});
