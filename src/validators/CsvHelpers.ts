export const DRUG_UNITS = ["GR", "ME", "ML", "UN", "F2", "EA", "GM"];

export const BILLING_CODE_TYPES = [
  "CPT",
  "HCPCS",
  "ICD",
  "DRG",
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
  "TRIS-DRG",
];

export const STANDARD_CHARGE_METHODOLOGY = [
  "case rate",
  "fee schedule",
  "percent of total billed charges",
  "per diem",
  "other",
];

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
];

export function objectFromKeysValues(
  keys: (string | undefined)[],
  values: string[]
): { [key: string]: string } {
  return Object.fromEntries(
    keys.map((key, index) => [key, values[index]]).filter((entry) => entry)
  );
}

export function sepColumnsEqual(colA: string, colB: string) {
  const cleanA = colA.split("|").map((v) => v.trim().toUpperCase());
  const cleanB = colB.split("|").map((v) => v.trim().toUpperCase());
  return (
    cleanA.length === cleanB.length &&
    cleanA.every((a, idx: number) => a === cleanB[idx])
  );
}

export function matchesString(a: string, b: string): boolean {
  return a.toLocaleUpperCase() === b.toLocaleUpperCase();
}

export function isValidDate(value: string) {
  // required format is YYYY-MM-DD or MM/DD/YYYY or M/D/YYYY or MM/D/YYYY or M/DD/YYYY
  const dateMatch1 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const dateMatch2 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateMatch1 != null) {
    // UTC methods are used because "date-only forms are interpreted as a UTC time",
    // as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
    // check that the parsed date matches the input, to guard against e.g. February 31
    const matchYear = dateMatch1[3];
    const matchMonth = dateMatch1[1];
    const matchDate = dateMatch1[2];
    const expectedYear = parseInt(matchYear);
    const expectedMonth = parseInt(matchMonth) - 1;
    const expectedDate = parseInt(matchDate);
    const parsedDate = new Date(value);
    return (
      expectedYear === parsedDate.getUTCFullYear() &&
      expectedMonth === parsedDate.getUTCMonth() &&
      expectedDate === parsedDate.getUTCDate()
    );
  } else if (dateMatch2 != null) {
    const matchYear = dateMatch2[1];
    const matchMonth = dateMatch2[2];
    const matchDate = dateMatch2[3];
    const expectedYear = parseInt(matchYear);
    const expectedMonth = parseInt(matchMonth) - 1;
    const expectedDate = parseInt(matchDate);
    const parsedDate = new Date(value);
    return (
      expectedYear === parsedDate.getUTCFullYear() &&
      expectedMonth === parsedDate.getUTCMonth() &&
      expectedDate === parsedDate.getUTCDate()
    );
  }
  return false;
}
