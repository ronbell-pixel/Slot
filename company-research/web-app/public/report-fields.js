// Report field definitions shared by the server (tool schema) and the browser (report view, PDF).
// [key, label, description for the model]

export const IDENTIFICATION_FIELDS = [
  ['legal_name', 'Legal Name', 'Exact legal entity name as registered.'],
  ['dba_names', 'DBA / Trade Names', 'Comma-separated assumed or trade names.'],
  ['entity_type', 'Entity Type', 'e.g. LLC, Corporation, Nonprofit Corporation, LP.'],
  ['entity_status', 'Entity Status', 'Registry status, e.g. Active, Good Standing, Dissolved.'],
  ['state_of_formation', 'State of Formation / Registration', 'Home state, plus foreign registrations if relevant.'],
  ['formation_date', 'Formation / Registration Date', 'YYYY-MM-DD when known.'],
  ['years_in_business', 'Years in Business', 'Calculated from formation date or earliest reliable source; say which.'],
  ['registered_agent', 'Registered Agent', 'Name and address of the registered agent.'],
  ['principal_address', 'Principal / HQ Address', 'Principal office or headquarters address.'],
  ['mailing_address', 'Mailing Address', 'Mailing address if different from principal.'],
  ['phone', 'Main Business Phone', 'Main published business phone number.'],
  ['website', 'Website', 'Official website URL.'],
  ['ein', 'Tax ID / EIN', 'Only if found in a public source (e.g. IRS nonprofit records, SEC filings).'],
];

export const PROFILE_FIELDS = [
  ['industry', 'Industry', 'Plain-language industry.'],
  ['naics', 'NAICS / SIC', 'Code and title when a source states one.'],
  ['ownership', 'Ownership', 'Private, public (ticker), nonprofit, subsidiary of ...'],
  ['employees', 'Employees (est.)', 'Estimate with source.'],
  ['revenue', 'Revenue (est.)', 'Estimate with source; null rather than guess.'],
  ['locations', 'Locations', 'Number or list of locations / service area.'],
];
