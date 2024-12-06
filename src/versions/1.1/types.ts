export const BILLING_CODE_TYPES = [
  "CPT",
  "HCPCS",
  "ICD",
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
] as const;
type BillingCodeTypeTuple = typeof BILLING_CODE_TYPES;
export type BillingCodeType = BillingCodeTypeTuple[number];

export const DRUG_UNITS = ["GR", "ME", "ML", "UN"];
type DrugUnitTuple = typeof DRUG_UNITS;
export type DrugUnit = DrugUnitTuple[number];

export const CHARGE_SETTINGS = ["inpatient", "outpatient", "both"] as const;
type ChargeSettingTuple = typeof CHARGE_SETTINGS;
export type ChargeSetting = ChargeSettingTuple[number];

export const CONTRACTING_METHODS = [
  "case rate",
  "fee schedule",
  "percent of total billed charges",
  "per diem",
  "other",
] as const;
type ContractingMethodTuple = typeof CONTRACTING_METHODS;
export type ContractingMethod = ContractingMethodTuple[number];
