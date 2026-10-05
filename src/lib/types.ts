export interface Category {
  name: string;
  grp: string;
}

interface Tracked {
  id: string;
  added_by: string;
  updated_by: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact extends Tracked {
  category: string;
  name: string;
  company: string;
  title: string;
  phone: string;
  phone_alt: string;
  email: string;
  website: string;
  address: string;
  territory: string;
  notes: string;
  connection: string;
  preferred: boolean;
  pays_referral: boolean;
  card_front: string | null;
}

export interface Comp extends Tracked {
  address: string;
  center_name: string;
  submarket: string;
  city: string;
  state: string;
  county: string;
  space_type: string;
  use_type: string;
  tenant: string;
  year_built: number | null;
  year_renovated: number | null;
  sign_date: string | null;
  start_date: string | null;
  sf: number | null;
  floor: string;
  rate_psf: number | null;
  term_months: number | null;
  lease_type: string;
  deal_type: string;
  escalations: string;
  options: string;
  ti: string;
  free_rent: string;
  notes: string;
}

export interface ExtraLink {
  label: string;
  url: string;
}

export interface LinkItem extends Tracked {
  section: string;
  jurisdiction: string;
  title: string;
  url: string;
  description: string;
  status: string;
  more: ExtraLink[];
  sort: number;
}

export interface Dataset {
  categories: Category[];
  contacts: Contact[];
  comps: Comp[];
  links: LinkItem[];
}

export type Table = "contacts" | "comps" | "links";
export type RowOf<T extends Table> = T extends "contacts" ? Contact : T extends "comps" ? Comp : LinkItem;
export type Draft<T> = Omit<T, keyof Tracked> & { id?: string };

/** The groups the Directory is organised into, in the order shown. */
export const GROUPS = [
  "Lending and 1031",
  "Legal, tax and title",
  "Brokers and agents",
  "Due diligence",
  "Property services",
  "Everything else",
] as const;

export const LINK_SECTIONS = ["Grants and incentives", "Tools and websites"] as const;

export const SPACE_TYPES = ["Office", "Retail", "Industrial", "Flex", "Medical", "Multifamily", "Other"];
export const LEASE_TYPES = ["Full Service", "NNN", "Modified Gross", "Gross", "Industrial Gross"];
