import { ValidationError } from "../errors/ValidationError.ts";
import { Ajv } from "ajv";
import { JsonTypes } from "@streamparser/json";

export type JsonFileLevelValidator = {
  name: string;
  applicableVersion: string;
  state: { [key: string]: any };
  standardChargeSchema?: any;
  metadataSchema?: any;
  standardChargeCheck?: (
    standardCharge: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct,
    state: JsonFileLevelValidator["state"],
    validatorErrors: NonNullable<Ajv["errors"]>
  ) => void;
  fileCheck: (
    metadata: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct,
    state: JsonFileLevelValidator["state"],
    validatorErrors: NonNullable<Ajv["errors"]>
  ) => ValidationError[];
};
