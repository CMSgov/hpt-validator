export interface CsvValidationError {
  row: number
  column: number
  field?: string
  message: string
  warning?: boolean
}

export interface ValidationError {
  path: string
  field?: string
  message: string
  warning?: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

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
] as const
type BillingCodeTypeTuple = typeof BILLING_CODE_TYPES
export type BillingCodeType = BillingCodeTypeTuple[number]

export const DRUG_UNITS = ["GR", "ME", "ML", "UN"]
type DrugUnitTuple = typeof DRUG_UNITS
export type DrugUnit = DrugUnitTuple[number]

export const CHARGE_SETTINGS = ["inpatient", "outpatient", "both"] as const
type ChargeSettingTuple = typeof CHARGE_SETTINGS
export type ChargeSetting = ChargeSettingTuple[number]

export const CHARGE_BILLING_CLASSES = ["professional", "facility"] as const
type ChargeBillingClassTuple = typeof CHARGE_BILLING_CLASSES
export type ChargeBillingClass = ChargeBillingClassTuple[number]

export const CONTRACTING_METHODS = [
  "case rate",
  "fee schedule",
  "percent of total billed charges",
  "per diem",
  "other",
] as const
type ContractingMethodTuple = typeof CONTRACTING_METHODS
export type ContractingMethod = ContractingMethodTuple[number]

export const STATE_CODES = [
  "AL",
  "AK",
  "AS",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FM",
  "FL",
  "GA",
  "GU",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MH",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "MP",
  "OH",
  "OK",
  "OR",
  "PW",
  "PA",
  "PR",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VI",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const
type StateCodeTuple = typeof STATE_CODES
export type StateCode = StateCodeTuple[number]
