// Made-up records for demo mode when no real data is available. Nothing here
// is a real person or deal.
import type { Comp, Contact, Dataset, LinkItem } from "./types";

const at = "2026-10-01T12:00:00Z";
const base = { added_by: "Sample", updated_by: "", archived: false, created_at: at, updated_at: at };

const person = (id: string, p: Partial<Contact>): Contact => ({
  id, category: "", name: "", company: "", title: "", phone: "", phone_alt: "", email: "", website: "",
  address: "", territory: "DMV", notes: "", connection: "", preferred: false, pays_referral: false,
  card_front: null, ...base, ...p,
});

const comp = (id: string, c: Partial<Comp>): Comp => ({
  id, address: "", center_name: "", submarket: "", city: "Washington", state: "DC", county: "",
  space_type: "Retail", use_type: "", tenant: "", year_built: null, year_renovated: null,
  sign_date: null, start_date: null, sf: null, floor: "", rate_psf: null, term_months: null,
  lease_type: "NNN", deal_type: "", escalations: "3%", options: "", ti: "", free_rent: "", notes: "",
  ...base, ...c,
});

const link = (id: string, l: Partial<LinkItem>): LinkItem => ({
  id, section: "Tools and websites", jurisdiction: "", title: "", url: "", description: "",
  status: "", more: [], sort: 0, ...base, ...l,
});

export const SAMPLE_DATA: Dataset = {
  categories: [
    { name: "Leasing", grp: "Brokers and agents" },
    { name: "Loan Officer", grp: "Lending and 1031" },
    { name: "Attorney", grp: "Legal, tax and title" },
    { name: "Survey", grp: "Due diligence" },
    { name: "Contractor", grp: "Property services" },
  ],
  contacts: [
    person("s1", { category: "Leasing", name: "Jordan Avery", company: "Sample Realty", phone: "(202) 555-0141", email: "jordan@example.com", preferred: true }),
    person("s2", { category: "Loan Officer", name: "Casey Morgan", company: "Example Bank", title: "Vice President", phone: "(301) 555-0187", email: "casey@example.com", pays_referral: true, notes: "SBA and conventional." }),
    person("s3", { category: "Attorney", name: "Riley Brooks", company: "Brooks Law", phone: "(703) 555-0110", email: "riley@example.com" }),
    person("s4", { category: "Survey", name: "Taylor Quinn", company: "Quinn Surveying", phone: "(410) 555-0122", territory: "MD" }),
    person("s5", { category: "Contractor", name: "Morgan Ellis", company: "Ellis Builders", title: "Owner", phone: "(240) 555-0199", connection: "Sample teammate" }),
  ],
  comps: [
    comp("c1", { address: "100 Sample Street NW", submarket: "Downtown", space_type: "Office", lease_type: "Full Service", sf: 5200, rate_psf: 52, term_months: 84, sign_date: "2025-03-01" }),
    comp("c2", { address: "200 Example Ave NE", submarket: "Union Market", sf: 2400, rate_psf: 64, term_months: 120, sign_date: "2024-10-01", tenant: "Sample Cafe" }),
    comp("c3", { address: "300 Demo Road", submarket: "Towson", city: "Towson", state: "MD", county: "Baltimore", sf: 1400, rate_psf: 24, term_months: 60, sign_date: "2025-05-01" }),
  ],
  links: [
    link("l1", { title: "Business Day Calculator", url: "https://www.timeanddate.com/date/workdays.html", description: "Count business days between two dates.", sort: 1 }),
  ],
};
