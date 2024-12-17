import { CsvValidator } from "../../src/validators/CsvValidator.js";

describe("CsvValidator", () => {
  describe("constructor", () => {
    it("should create a CsvValidator instance with a version", () => {
      const validator = new CsvValidator("v2.0.0");
      expect(validator.version).toBe("v2.0.0");
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
      expect(validator.version).toBe("v2.1.0");
      expect(validator.fileType).toBe("csv");
      expect(validator.maxErrors).toBe(50);
      expect(validator.dataCallback).toBe(valueCallback);
    });
  });
});
