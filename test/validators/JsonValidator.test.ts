import * as fs from "fs";
import * as path from "path";
import { ValidationError } from "../../src/errors/ValidationError.js";
import { InvalidJsonError } from "../../src/errors/json/InvalidJsonError.js";
import {
  JsonFalseAffirmationAlert,
  JsonFalseAttestationAlert,
} from "../../src/alerts/FalseStatementAlert.js";
import { JsonValidator } from "../../src/validators/JsonValidator.js";
import { createFixtureStream } from "../testhelpers/createFixtureStream.js";

describe("JsonValidator", () => {
  describe("constructor", () => {
    it("should create a new instace with defined schemas and subschemas", () => {
      const validator = new JsonValidator("v2.2.0");
      expect(validator.fullSchema).toBeDefined();
      expect(validator.standardChargeSchema).toBeDefined();
      expect(validator.metadataSchema).toBeDefined();
    });

    it("should throw an error when given a version that has no available schema", () => {
      expect(() => {
        new JsonValidator("x.y.z");
      }).toThrow("Could not load JSON schema with version: x.y.z");
    });
  });

  describe("schema v2.0.0", () => {
    // this is the earliest version of the schema supported by the validator.
    let validator: JsonValidator;

    beforeEach(() => {
      validator = new JsonValidator("v2.0.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a valid File object", async () => {
      const inputText = fs.readFileSync(
        new URL(
          path.join("..", "fixtures", "sample-valid.json"),
          import.meta.url
        ),
        {
          encoding: "utf-8",
        }
      );
      const input = new File([inputText], "sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should call a supplied data callback for each standard charge information object", async () => {
      const collectedCodes: any[] = [];
      function myDataCallback(val: any) {
        if (Array.isArray(val.code_information)) {
          collectedCodes.push(...val.code_information);
        }
      }
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input, {
        onValueCallback: myDataCallback,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(collectedCodes).toEqual([
        {
          code: "470",
          type: "MS-DRG",
        },
        {
          code: "175869",
          type: "LOCAL",
        },
        {
          code: "92626",
          type: "CPT",
        },
        {
          code: "H0017",
          type: "HCPCS",
        },
        {
          code: "762",
          type: "RC",
        },
      ]);
    });

    it("should call a supplied metadata callback once with the collected metadata", async () => {
      const hospitalInfo: any[] = [];
      function myMetadataCallback(metadata: { [key: string]: any }) {
        if (
          Array.isArray(metadata.hospital_location) &&
          Array.isArray(metadata.hospital_address)
        ) {
          metadata.hospital_location.forEach((location, idx) => {
            if (idx < metadata.hospital_address.length) {
              hospitalInfo.push({
                location: location,
                address: metadata.hospital_address[idx],
              });
            }
          });
        }
      }
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input, {
        onMetadataCallback: myMetadataCallback,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(hospitalInfo).toEqual([
        {
          location: "West Mercy Hospital",
          address: "12 Main Street, Fullerton, CA  92832",
        },
        {
          location: "West Mercy Surgical Center",
          address: "23 Ocean Ave, San Jose, CA 94088",
        },
      ]);
    });

    it("should validate a file that starts with a byte-order mark", async () => {
      const input = createFixtureStream("sample-valid-bom.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it("should validate an empty json file", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(8);
    });

    it("should validate a syntactically invalid JSON file", async () => {
      const input = createFixtureStream("sample-invalid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvalidJsonError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should validate a file where affirmation confirmation is false", async () => {
      const input = createFixtureStream(path.join("false-confirmation.json"));
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toEqual<ValidationError>(
        new JsonFalseAffirmationAlert()
      );
    });
  });

  describe("schema v2.1.0", () => {
    // this version adds several conditional requirements:
    // 1. If the "standard charge methodology" encoded value is "other", there must be a corresponding
    // explanation found in the "additional notes" for the associated payer-specific negotiated charge.
    // 2. If an item or service is encoded, a corresponding valid value must be encoded for at least one
    // of the following: "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount",
    // "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".
    // 3. If there is a "payer specific negotiated charge" encoded as a dollar amount, there must be a corresponding
    // valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
    let validator: JsonValidator;

    beforeEach(() => {
      validator = new JsonValidator("v2.1.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file that starts with a byte-order mark", async () => {
      const input = createFixtureStream("sample-valid-bom.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it("should validate an empty json file", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(8);
    });

    it("should validate a syntactically invalid JSON file", async () => {
      const input = createFixtureStream("sample-invalid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvalidJsonError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      // this file normally could produce 3 errors when not limited
      const input = createFixtureStream("sample-no-min-max.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should validate a file where a methodology is given as 'other', but no additional notes are provided", async () => {
      const input = createFixtureStream("sample-other-no-notes.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'additional_payer_notes'",
          path: "/standard_charge_information/0/standard_charges/0/payers_information/0",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/0/standard_charges/0/payers_information/0",
        })
      );
    });

    it("should validate a file where a standard charge object has none of the possible charges", async () => {
      const input = createFixtureStream("sample-no-charges.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      // this one's subschema has a lot of individual errors, so just check that the subschema failed
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must match a schema in anyOf",
          path: "/standard_charge_information/2/standard_charges/0",
        })
      );
    });

    it("should validate a file where there is a payer-specific dollar amount, but minimum and maximum are missing", async () => {
      const input = createFixtureStream("sample-no-min-max.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/1/standard_charges/0",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'minimum'",
          path: "/standard_charge_information/1/standard_charges/0",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'maximum'",
          path: "/standard_charge_information/1/standard_charges/0",
        })
      );
    });
  });

  describe("schema v2.2.0", () => {
    // this version adds drug information and modifier information to the schema.
    // there are two new conditional checks:
    // 4. If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then
    // a corresponding "Estimated Allowed Amount" must also be encoded.
    // 5. If code type is NDC, then the corresponding drug unit of measure and drug type of measure data elements must be encoded.
    let validator: JsonValidator;

    beforeEach(() => {
      validator = new JsonValidator("v2.2.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file that starts with a byte-order mark", async () => {
      const input = createFixtureStream("sample-valid-bom.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it("should validate an empty json file", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(8);
    });

    it("should validate a syntactically invalid JSON file", async () => {
      const input = createFixtureStream("sample-invalid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvalidJsonError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should limit the number of alerts returned when the maxErrors option is used", async () => {
      // this file would generate five alerts, but the option limits the output
      const input = createFixtureStream("sample-lots-of-alerts.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(true);
      expect(result.alerts).toHaveLength(2);
    });

    it("should validate a file that uses drug information correctly", async () => {
      const input = createFixtureStream("sample-valid-drug-info.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file with incorrectly formed drug information", async () => {
      const input = createFixtureStream("sample-wrong-drug-info.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must be string",
          path: "/standard_charge_information/4/drug_information/unit",
        })
      );
    });

    it("should validate a file that uses modifier information correctly", async () => {
      const input = createFixtureStream("sample-valid-modifier.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file with incorrectly formed modifier information", async () => {
      const input = createFixtureStream("sample-wrong-modifier.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must be string",
          path: "/modifier_information/0/code",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'plan_name'",
          path: "/modifier_information/0/modifier_payer_information/0",
        })
      );
    });

    it("should validate a file where a charge is expressed as a percentage or algorithm, but no estimated allowed amount is provided", async () => {
      const input = createFixtureStream("sample-missing-estimate.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
        })
      );
    });

    it("should validate a file with an NDC code but no drug information", async () => {
      const input = createFixtureStream("sample-ndc-no-drug-info.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.alerts).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/4",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'drug_information'",
          path: "/standard_charge_information/4",
        })
      );
    });

    it("should validate a file that uses nine 9s for an estimated amount", async () => {
      const input = createFixtureStream("sample-nine-nines.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toEqual(
        expect.objectContaining({
          message: "Nine 9s used for estimated amount.",
          path: "/standard_charge_information/0/standard_charges/0/payers_information/2/estimated_amount",
        })
      );
    });
  });

  describe("schema v3.0.0", () => {
    // this version removes the estimated_amount field and replaces it with median_amount,
    // 10th_percentile, and 90th_percentile fields.
    // several string fields that previously had no minimum length now have minimum length 1.
    // there are also some new conditionals.
    let validator: JsonValidator;

    beforeEach(() => {
      validator = new JsonValidator("v3.0.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream(path.join("3.0", "sample-valid.json"));
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // string elements with new minimum length requirements
    it("should validate a file with a hospital address that is an empty string", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-empty-address.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          message: "must NOT have fewer than 1 characters",
          path: "/hospital_address/1",
        })
      );
    });

    it("should validate a file with a location name that is an empty string", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-empty-location.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          message: "must NOT have fewer than 1 characters",
          path: "/location_name/0",
        })
      );
    });

    it("should validate a file with additional generic notes that are an empty string", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-empty-generic-notes.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          message: "must NOT have fewer than 1 characters",
          path: "/standard_charge_information/1/standard_charges/0/additional_generic_notes",
        })
      );
    });

    it("should validate a file with additional payer notes that are an empty string", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-empty-payer-notes.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          message: "must NOT have fewer than 1 characters",
          path: "/standard_charge_information/1/standard_charges/0/payers_information/0/additional_payer_notes",
        })
      );
    });

    it("should validate a file with a standard charge algorithm that is an empty string", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-empty-algorithm.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          message: "must NOT have fewer than 1 characters",
          path: "/standard_charge_information/0/standard_charges/0/payers_information/2/standard_charge_algorithm",
        })
      );
    });

    // drug_information.unit is now a number, not a string
    it("should validate a file that uses drug information correctly", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-valid-drug-info.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // modifier information now has an optional setting property with enum values
    it("should validate a file where a modifier setting is not one of the allowed values", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-modifier-invalid-setting.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          message: "must be equal to one of the allowed values",
          path: "/modifier_information/0/setting",
        })
      );
    });

    // count of allowed amounts is a new field in a payers_information object
    // it is required when there is a percentage or algorithm
    it("should validate a file where a count of allowed amounts is missing", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-missing-count-of-allowed-amounts.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'count'",
          path: "/standard_charge_information/1/standard_charges/0/payers_information/1",
        })
      );
    });

    // conditionals that previously required an estimated_amount now require
    // median_amount, 10th_percentile, and 90th_percentile
    it("should validate a file where a charge is expressed as a percentage or algorithm, and count of allowed amounts is greater than 0, but no median amount is provided", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-missing-median.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
        })
      );
    });

    it("should validate a file where a charge is expressed as a percentage or algorithm, and count of allowed amounts is greater than 0, but no 10th percentile amount is provided", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-missing-10th.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/1/standard_charges/0/payers_information/1",
        })
      );
    });

    it("should validate a file where a charge is expressed as a percentage or algorithm, and count of allowed amounts is greater than 0, but no 90th percentile amount is provided", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-missing-90th.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
        })
      );
    });

    it("should validate a file where a charge is expressed as a percentage or algorithm, count of allowed amounts is 0, and the allowed amount fields are omitted", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-valid-allowed-amount-zero.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // a payers_information object must have at least one standard charge in it
    it("should validate a file where a payers information object has no standard charge", async () => {
      const input = createFixtureStream(
        path.join("3.0", "sample-payer-no-charge.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
      // one error for the failed anyOf keyword, one error for each failed subschema
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must match a schema in anyOf",
          path: "/standard_charge_information/2/standard_charges/0/payers_information/1",
        })
      );
    });

    it("should validate a file where attestation confirmation is false", async () => {
      const input = createFixtureStream(
        path.join("3.0", "false-confirmation.json")
      );
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toEqual<ValidationError>(
        new JsonFalseAttestationAlert()
      );
    });
  });
});
