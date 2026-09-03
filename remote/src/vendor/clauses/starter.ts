/**
 * The 25 clauses the server ships with.
 *
 * Every one is a generic freelance template written in plain language, with {{variables}}
 * for the facts that change per engagement. None of it is legal advice, none of it is
 * jurisdiction-specific, and `store.ts` stamps that note onto each of them at seed time.
 * Starter clauses do not count against the free tier's own-clause cap.
 */
export interface StarterClause {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  variables: string[];
  /** D-R37: clause ids this body points at. Resolved against the included set at assembly. */
  references?: string[];
}

export const STARTER_CLAUSES: StarterClause[] = [
  {
    id: "scope-of-work", title: "Scope of Work", category: "scope",
    tags: ["scope", "deliverables", "core"],
    variables: ["contractor", "client", "project", "deliverables"],
    references: ["revisions"],
    body: "{{contractor}} will provide {{client}} with the services described for {{project}}: {{deliverables}}. Work outside this description is not included and is treated as a change request, priced and agreed in writing before it starts. Anything not listed here is out of scope until both parties agree otherwise in writing.",
  },
  {
    id: "payment-terms", title: "Payment Terms", category: "payment",
    tags: ["payment", "invoice", "core"],
    variables: ["client", "fee", "currency", "payment_days", "deposit_percent"],
    body: "The fee for the services is {{fee}} {{currency}}. {{client}} pays a deposit of {{deposit_percent}} percent before work begins, and the balance on delivery. Invoices are due within {{payment_days}} days of the invoice date. All amounts are exclusive of VAT and of any bank or currency conversion charges.",
  },
  {
    id: "late-fees", title: "Late Payment", category: "payment",
    tags: ["payment", "late", "interest"],
    variables: ["late_fee_percent", "payment_days"],
    body: "Invoices unpaid more than {{payment_days}} days after the due date carry interest of {{late_fee_percent}} percent per month on the outstanding balance, accruing daily. Work may be suspended while an invoice is overdue, and any agreed schedule shifts by the length of the suspension.",
  },
  {
    id: "ip-assignment", title: "Intellectual Property Assignment", category: "ip",
    tags: ["ip", "ownership", "core"],
    variables: ["contractor", "client"],
    body: "On receipt of payment in full, {{contractor}} assigns to {{client}} all rights in the final deliverables produced under this agreement. {{contractor}} keeps ownership of any pre-existing tools, libraries, know-how and templates used to make them, and grants {{client}} a perpetual, non-exclusive licence to use those components as embedded in the deliverables. Nothing transfers before payment clears.",
  },
  {
    id: "confidentiality", title: "Confidentiality", category: "confidentiality",
    tags: ["confidentiality", "nda", "core"],
    variables: ["client", "contractor", "confidentiality_years"],
    body: "Each party keeps the other's non-public information confidential and uses it only to perform this agreement. The obligation lasts {{confidentiality_years}} years from disclosure and does not cover information that is public through no fault of the receiving party, was already known to it, or must be disclosed by law. On request, {{contractor}} returns or deletes {{client}} material still in its possession.",
  },
  {
    id: "termination", title: "Termination", category: "term",
    tags: ["termination", "notice", "core"],
    variables: ["notice_days", "client", "contractor"],
    body: "Either party may end this agreement on {{notice_days}} days written notice. Either party may end it immediately if the other commits a material breach and does not fix it within 14 days of written notice. On termination {{client}} pays for all work completed and all committed costs up to the termination date, and {{contractor}} hands over the work in progress in its then-current state.",
  },
  {
    id: "liability-cap", title: "Limitation of Liability", category: "liability",
    tags: ["liability", "cap", "risk"],
    variables: ["liability_cap", "currency"],
    body: "Neither party is liable for indirect, incidental or consequential loss, including lost profit, lost revenue or lost data. Each party's total liability under this agreement is limited to {{liability_cap}} {{currency}}. Nothing here limits liability for death, personal injury, fraud, or anything else that cannot be limited by law.",
  },
  {
    id: "revisions", title: "Revisions", category: "scope",
    tags: ["revisions", "scope", "feedback"],
    variables: ["revision_rounds", "client"],
    body: "The fee includes {{revision_rounds}} rounds of revision per deliverable. A round means one consolidated set of feedback from {{client}}, delivered together rather than in pieces. Further rounds, or changes that alter the agreed direction after approval, are billed at the applicable hourly rate.",
  },
  {
    id: "expenses", title: "Expenses", category: "expenses",
    tags: ["expenses", "costs", "travel"],
    variables: ["client", "expense_approval_limit", "currency"],
    body: "{{client}} reimburses out-of-pocket costs incurred for the project, including travel, stock assets, third-party licences and hosting, at cost and against receipts. Any single item above {{expense_approval_limit}} {{currency}} needs written approval before it is incurred.",
  },
  {
    id: "governing-law", title: "Governing Law", category: "general",
    tags: ["law", "jurisdiction", "boilerplate"],
    variables: ["jurisdiction"],
    references: ["dispute-resolution"],
    body: "This agreement is governed by the laws of {{jurisdiction}}, without regard to its conflict of law rules, and the courts of {{jurisdiction}} have exclusive jurisdiction over any dispute the parties have not already resolved between them.",
  },
  {
    id: "force-majeure", title: "Force Majeure", category: "general",
    tags: ["force-majeure", "delay", "boilerplate"],
    variables: ["notice_days"],
    body: "Neither party is in breach for a delay or failure caused by events outside its reasonable control, including natural disaster, war, epidemic, strike, power or network failure, or government action. The affected party gives notice as soon as practical and both parties agree a revised schedule. If the event continues for more than 30 days, either party may terminate on {{notice_days}} days notice.",
  },
  {
    id: "independent-contractor", title: "Independent Contractor", category: "general",
    tags: ["status", "employment", "boilerplate"],
    variables: ["contractor", "client"],
    body: "{{contractor}} is an independent contractor, not an employee, partner or agent of {{client}}. {{contractor}} controls how and when the work is done, supplies its own equipment, may work for others, and is responsible for its own taxes, social contributions and insurance. Nothing in this agreement creates an employment relationship.",
  },
  {
    id: "non-solicit", title: "Non-Solicitation", category: "general",
    tags: ["non-solicit", "staff", "restriction"],
    variables: ["non_solicit_months", "client", "contractor"],
    body: "For {{non_solicit_months}} months after this agreement ends, neither {{client}} nor {{contractor}} will directly solicit for employment any person the other introduced during the engagement. This does not restrict general public job advertising or applications made without solicitation.",
  },
  {
    id: "acceptance", title: "Acceptance of Deliverables", category: "scope",
    tags: ["acceptance", "sign-off", "delivery"],
    variables: ["client", "acceptance_days"],
    body: "{{client}} has {{acceptance_days}} days from delivery to review each deliverable and either accept it or give a written list of specific defects measured against the agreed scope. A deliverable not rejected in that window is accepted. Use of a deliverable in production is acceptance.",
  },
  {
    id: "warranty-disclaimer", title: "Warranty Disclaimer", category: "warranty",
    tags: ["warranty", "as-is", "risk"],
    variables: ["contractor"],
    body: "{{contractor}} warrants that the services are performed with reasonable skill and care and that the deliverables are its own original work. Beyond that, the deliverables are provided as is, without any implied warranty of merchantability, fitness for a particular purpose, or uninterrupted or error-free operation.",
  },
  {
    id: "dispute-resolution", title: "Dispute Resolution", category: "disputes",
    tags: ["dispute", "mediation", "escalation"],
    variables: ["jurisdiction", "notice_days"],
    body: "Before starting proceedings, the parties will try to settle any dispute by direct discussion between named representatives within {{notice_days}} days of written notice of the dispute, and then by mediation. Either party may seek urgent injunctive relief at any time in the courts of {{jurisdiction}}.",
  },
  {
    id: "notices", title: "Notices", category: "general",
    tags: ["notices", "email", "boilerplate"],
    variables: ["client_email", "contractor_email"],
    body: "Notices under this agreement are in writing and sent by email to {{client_email}} and {{contractor_email}}, or to any other address a party gives in writing. A notice is treated as received on the next business day after it is sent, unless a delivery failure is received.",
  },
  {
    id: "entire-agreement", title: "Entire Agreement", category: "general",
    tags: ["entire-agreement", "boilerplate"],
    variables: [],
    body: "This agreement, with its schedules, is the whole agreement between the parties on its subject and replaces every earlier proposal, quote, email and conversation. It may only be changed by a written document signed by both parties. Neither party relies on any statement not written in it.",
  },
  {
    id: "severability", title: "Severability", category: "general",
    tags: ["severability", "boilerplate"],
    variables: [],
    body: "If any provision of this agreement is held invalid or unenforceable, it is limited or removed to the smallest extent necessary and the rest of the agreement stays in force. The parties will replace the removed provision with a valid one that comes closest to its intended effect.",
  },
  {
    id: "assignment", title: "Assignment", category: "general",
    tags: ["assignment", "subcontracting", "boilerplate"],
    variables: ["contractor", "client"],
    body: "Neither party may assign this agreement without the other's written consent, which will not be unreasonably withheld, except to a successor of substantially all of its business. {{contractor}} may use subcontractors but stays responsible for their work and for their confidentiality obligations to {{client}}.",
  },
  {
    id: "data-protection", title: "Data Protection", category: "data",
    tags: ["data", "gdpr", "privacy"],
    variables: ["client", "contractor", "jurisdiction"],
    body: "Where {{contractor}} processes personal data on behalf of {{client}}, it does so only on {{client}} written instructions, keeps the data secure with appropriate technical and organisational measures, restricts access to people who need it, notifies {{client}} without undue delay of any personal data breach, and deletes or returns the data at the end of the engagement. {{client}} is the controller and is responsible for the lawful basis of the processing under the data protection law of {{jurisdiction}}.",
  },
  {
    id: "portfolio-rights", title: "Portfolio and Credit", category: "ip",
    tags: ["portfolio", "credit", "marketing"],
    variables: ["contractor", "client", "project"],
    body: "{{contractor}} may show the non-confidential parts of {{project}} in its portfolio, case studies and marketing, and may name {{client}} as a client, once the work is public. {{client}} may ask in writing for specific material to be withheld and {{contractor}} will comply.",
  },
  {
    id: "kill-fee", title: "Kill Fee", category: "payment",
    tags: ["kill-fee", "cancellation", "payment"],
    variables: ["kill_fee_percent", "client", "fee", "currency"],
    body: "If {{client}} cancels the project after it has begun but before completion, {{client}} pays for all work completed to date plus a kill fee of {{kill_fee_percent}} percent of the remaining unbilled portion of the {{fee}} {{currency}} fee, to cover the reserved capacity that can no longer be filled.",
  },
  {
    id: "rush-fee", title: "Rush Fee", category: "payment",
    tags: ["rush", "deadline", "payment"],
    variables: ["rush_fee_percent", "client"],
    body: "Work that {{client}} requests on a compressed timeline, requiring evenings, weekends or public holidays, or displacing already-scheduled work, is billed with a rush surcharge of {{rush_fee_percent}} percent. The surcharge is agreed in writing before the rush work starts.",
  },
  {
    id: "change-requests", title: "Change Requests", category: "scope",
    tags: ["change", "scope", "variation"],
    variables: ["client", "contractor"],
    body: "Either party may propose a change to the scope, schedule or fee. {{contractor}} responds with the effect on price and timeline, and no change takes effect until {{client}} approves it in writing. Work continues on the agreed scope while a change is under discussion.",
  },
];
