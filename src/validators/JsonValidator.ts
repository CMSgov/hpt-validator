import { Ajv } from "ajv";
import ajvFormats from "ajv-formats";
const addFormats = ajvFormats.default; // imports, let me tell ya
import { JSONParser } from "@streamparser/json";
import _ from "lodash";
const { bind } = _;
import { JsonValidationOptions, ValidationResult } from "../types.js";
import { BaseValidator } from "./BaseValidator.js";
import {
  addItemsWithLimit,
  errorObjectToValidationError,
  errorObjectToValidationAlert,
  removeBOM,
} from "../utils.js";
import { ValidationError } from "../errors/ValidationError.js";
import { InvalidJsonError } from "../errors/json/InvalidJsonError.js";
import { JsonNoPayerChargeAlert } from "../alerts/JsonNoPayerChargeAlert.js";

import v200schema from "../schemas/v2.0.0.json" with { type: "json" };
import v210schema from "../schemas/v2.1.0.json" with { type: "json" };
import v220schema from "../schemas/v2.2.0.json" with { type: "json" };
import v300schema from "../schemas/v3.0.0.json" with { type: "json" };
import v220alerts from "../alert-schemas/v2.2.0.json" with { type: "json" };
import v220payerCharge from "../alert-schemas/v2.2.0-payer-charge.json" with { type: "json" };
import semver from "semver";
import { JsonFileLevelValidator } from "./JsonFileLevelValidator.js";

export class JsonValidator extends BaseValidator {
  public fullSchema: any;
  public standardChargeSchema: any;
  public metadataSchema: any;
  public alertSchema: any;
  public fileLevelValidators: JsonFileLevelValidator[] = [];
  public fileLevelAlerters: JsonFileLevelValidator[] = [];
  public errors: ValidationError[] = [];
  public alerts: ValidationError[] = [];
  public dataCallback?: JsonValidationOptions["onValueCallback"];
  public metadataCallback?: JsonValidationOptions["onMetadataCallback"];

  static allowedVersions = ["2.0.0", "2.1.0", "2.2.0", "3.0.0"];

  constructor(public version: string) {
    super("json");
    this.version = semver.coerce(version)?.toString() ?? version;
    try {
      // TODO: try to enhance this
      switch (this.version) {
        case "2.0.0":
          this.fullSchema = v200schema;
          break;
        case "2.1.0":
          this.fullSchema = v210schema;
          break;
        case "2.2.0":
          this.fullSchema = v220schema;
          this.alertSchema = v220alerts;
          break;
        case "3.0.0":
          this.fullSchema = v300schema;
          break;
        default:
          throw new Error("unrecognized version");
      }
      this.buildStandardChargeSchema();
      this.buildMetadataSchema();
      this.buildFileLevelChecks();
    } catch {
      throw Error(`Could not load JSON schema with version: ${version}`);
    }
  }

  buildStandardChargeSchema() {
    this.standardChargeSchema = {
      $schema: this.fullSchema["$schema"],
      definitions: this.fullSchema.definitions,
      ...this.fullSchema.definitions.standard_charge_information,
    };
  }

  buildMetadataSchema() {
    this.metadataSchema = { ...this.fullSchema };
    delete this.metadataSchema.properties.standard_charge_information;
    this.metadataSchema.required = this.metadataSchema.required.filter(
      (propertyName: string) => propertyName !== "standard_charge_information"
    );
  }

  buildFileLevelChecks() {
    const fileLevelChecks: JsonFileLevelValidator[] = [
      {
        name: "at least one payer-specific charge",
        applicableVersion: ">=2.2.0",
        state: {
          hasCharge: false,
        },
        standardChargeSchema: v220payerCharge,
        standardChargeCheck: (_standardCharge, state, validatorErrors) => {
          if (!state.hasCharge) {
            state.hasCharge = validatorErrors?.length === 0;
          }
        },
        fileCheck: (_metadata, state) => {
          if (!state.hasCharge) {
            return [new JsonNoPayerChargeAlert()];
          }
          return [];
        },
      },
    ];
    this.fileLevelAlerters = fileLevelChecks.filter((val) =>
      semver.satisfies(this.version, val.applicableVersion)
    );
  }

  async validate(
    input: File | NodeJS.ReadableStream,
    options: JsonValidationOptions = {}
  ): Promise<ValidationResult> {
    this.errors = [];
    this.alerts = [];
    const validator = new Ajv({ allErrors: true });
    addFormats(validator);
    let alertValidator: Ajv;
    if (this.alertSchema) {
      alertValidator = new Ajv({ allErrors: true, verbose: true });
      addFormats(alertValidator);
      alertValidator.addKeyword("$message");
    }
    const parser = new JSONParser({
      paths: [
        "$.hospital_name",
        "$.last_updated_on",
        "$.license_information",
        "$.version",
        "$.hospital_address",
        "$.hospital_location",
        "$.affirmation",
        "$.modifier_information",
        "$.standard_charge_information.*",
      ],
      keepStack: false,
    });
    const metadata: { [key: string]: any } = {};
    let hasCharges = false;
    if (options.onValueCallback) {
      this.dataCallback = options.onValueCallback;
      bind(this.dataCallback, this);
    }
    if (options.onMetadataCallback) {
      this.metadataCallback = options.onMetadataCallback;
      bind(this.metadataCallback, this);
    }

    return new Promise(async (resolve) => {
      const errors = this.errors;
      const alerts = this.alerts;
      parser.onValue = ({ value, key, stack }) => {
        if (stack.length > 2 || key === "standard_charge_information") return;
        if (typeof key === "string") {
          metadata[key] = value;
        } else {
          hasCharges = true;
          const pathPrefix = stack
            .filter((se) => se.key)
            .map((se) => se.key)
            .join("/");
          let newErrors: ValidationError[] = [];
          if (!validator.validate(this.standardChargeSchema, value)) {
            newErrors =
              validator.errors?.map(errorObjectToValidationError) ?? [];
            newErrors.forEach((error) => {
              error.path = `/${pathPrefix}/${key}${error.path}`;
            });
            addItemsWithLimit(newErrors, errors, options.maxErrors);
          }
          let newAlerts: ValidationError[] = [];
          if (alertValidator != null) {
            if (!alertValidator.validate(this.alertSchema, value)) {
              newAlerts =
                alertValidator.errors?.map(errorObjectToValidationAlert) ?? [];
              newAlerts.forEach((error) => {
                error.path = `/${pathPrefix}/${key}${error.path}`;
              });
              addItemsWithLimit(newAlerts, alerts, options.maxErrors);
            }
          }

          // other "run this on each standard charge object" functions go here
          this.fileLevelValidators.forEach((flv) => {
            if (value != null) {
              let validatorErrors: Ajv["errors"] = [];
              // if there is a standard charge schema, validate against it
              if (flv.standardChargeSchema != null) {
                validator.validate(flv.standardChargeSchema, value);
                validatorErrors = validator.errors ?? [];
              }
              flv.standardChargeCheck(value, flv.state, validatorErrors);
            }
          });
          this.fileLevelAlerters.forEach((fla) => {
            if (value != null) {
              let validatorErrors: Ajv["errors"] = [];
              // if there is a standard charge schema, validate against it
              if (fla.standardChargeSchema != null) {
                validator.validate(fla.standardChargeSchema, value);
                validatorErrors = validator.errors ?? [];
              }
              fla.standardChargeCheck(value, fla.state, validatorErrors);
            }
          });

          if (this.dataCallback && value != null) {
            this.dataCallback(
              value,
              pathPrefix,
              key as number,
              newErrors,
              newAlerts
            );
          }
          if (
            options.maxErrors &&
            options.maxErrors > 0 &&
            errors.length >= options.maxErrors
          ) {
            resolve({
              valid: false,
              errors: errors,
              alerts: alerts,
            });
            parser.end();
          }
        }
      };

      parser.onEnd = () => {
        // If no charges present, use the full schema to throw error for missing
        let metadataErrors: ValidationError[] = [];
        if (
          !validator.validate(
            hasCharges ? this.metadataSchema : this.fullSchema,
            metadata
          )
        ) {
          metadataErrors =
            validator.errors?.map(errorObjectToValidationError) ?? [];
          addItemsWithLimit(metadataErrors, errors, options.maxErrors);
        }
        // final run for file level checkers
        this.fileLevelValidators.forEach((flv) => {
          if (metadata != null) {
            let validatorErrors: Ajv["errors"] = [];
            if (flv.fileSchema != null) {
              validator.validate(flv.fileSchema, metadata);
              validatorErrors = validator.errors ?? [];
            }
            const bonusErrors = flv.fileCheck(
              metadata,
              flv.state,
              validatorErrors
            );
            addItemsWithLimit(bonusErrors, errors, options.maxErrors);
          }
        });
        this.fileLevelAlerters.forEach((fla) => {
          if (metadata != null) {
            let validatorErrors: Ajv["errors"] = [];
            if (fla.fileSchema != null) {
              validator.validate(fla.fileSchema, metadata);
              validatorErrors = validator.errors ?? [];
            }
            const bonusAlerts = fla.fileCheck(
              metadata,
              fla.state,
              validatorErrors
            );
            addItemsWithLimit(bonusAlerts, alerts, options.maxErrors);
          }
        });

        if (this.metadataCallback && metadata != null) {
          this.metadataCallback(metadata, metadataErrors, []);
        }
        resolve({
          valid: errors.length === 0,
          errors,
          alerts,
        });
      };

      parser.onError = (e) => {
        parser.onEnd = () => null;
        parser.onError = () => null;
        parser.end();
        resolve({
          valid: false,
          errors: [new InvalidJsonError(e)],
          alerts,
        });
      };

      parseJson(input, parser);
    });
  }
}

export async function parseJson(
  jsonInput: File | NodeJS.ReadableStream,
  parser: JSONParser
): Promise<void> {
  if (jsonInput instanceof File) {
    const stream = jsonInput.stream();
    const reader = stream.getReader();
    const textDecoder = new TextDecoder("utf-8");

    function readChunk() {
      return reader.read().then(({ done, value }) => {
        if (done) {
          parser.end();
          return;
        }

        parser.write(textDecoder.decode(value));
        readChunk();
      });
    }

    readChunk();
  } else {
    let firstChunk = true;
    const jsonStream = jsonInput as NodeJS.ReadableStream;
    jsonStream.on("end", () => parser.end());
    jsonStream.on("error", (e) => {
      throw e;
    });
    jsonStream.on("data", (data: string) => {
      // strip utf-8 BOM: see https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
      if (firstChunk) {
        data = removeBOM(data);
        firstChunk = false;
      }
      parser.write(data);
    });
  }
}
