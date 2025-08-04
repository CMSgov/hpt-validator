import { ValidationError } from "../errors/ValidationError.js";
import { Ajv } from "ajv";
import { JsonTypes } from "@streamparser/json";

export type JsonFileLevelValidator = {
  name: string;
  applicableVersion: string;
  state: { [key: string]: any };
  standardChargeSchema?: any;
  fileSchema?: any;
  standardChargeCheck: (
    standardCharge: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct,
    state: JsonFileLevelValidator["state"],
    validatorErrors: Ajv["errors"]
  ) => void;
  fileCheck: (
    metadata: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct,
    state: JsonFileLevelValidator["state"],
    validatorErrors: Ajv["errors"]
  ) => ValidationError[];
};
