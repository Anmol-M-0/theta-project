/**
 * @file schemas.js
 * @description Standardized legal tech & conditional branching schemas for Theta Engine Studio.
 */

export const conveyanceDeedSchema = {
  id: "indian_conveyance_deed",
  version: 1,
  title: "Indian Conveyance Deed (Complex Legal Drafting)",
  sections: [
    {
      id: "property_sec",
      title: "Property Identification",
      questions: [
        {
          id: "property_type",
          sectionId: "property_sec",
          path: "property.category",
          kind: "card",
          label: "Select the real estate category:",
          description: "Branching determines statutory schedule clauses and municipal clearances",
          options: [
            { value: "apartment", label: "Residential Apartment / Flat", hint: "Includes undivided share in land (UDS) and society membership" },
            { value: "plot", label: "Freehold Land / Plot", hint: "Includes revenue survey demarcation and boundary schedule" },
            { value: "commercial", label: "Commercial Office / Retail Unit", hint: "Includes GST consideration schedule and building maintenance terms" }
          ],
          validation: { required: true }
        },
        {
          id: "apt_floor",
          sectionId: "property_sec",
          branch: "b_apartment",
          path: "property.apartment.floorNumber",
          kind: "number",
          label: "Floor Number of the Apartment:",
          visibleWhen: { equals: { path: "property.category", value: "apartment" } },
          validation: { required: true }
        },
        {
          id: "apt_tower",
          sectionId: "property_sec",
          branch: "b_apartment",
          path: "property.apartment.towerBlock",
          kind: "text",
          label: "Tower / Block / Wing Designation:",
          description: "e.g., Tower B, Wing 3",
          visibleWhen: { equals: { path: "property.category", value: "apartment" } },
          validation: { required: true }
        },
        {
          id: "plot_survey",
          sectionId: "property_sec",
          branch: "b_plot",
          path: "property.plot.surveyNumber",
          kind: "text",
          label: "Revenue Survey / Khasra / CTS Number:",
          description: "e.g., Survey No. 142/3A, Village Haveli",
          visibleWhen: { equals: { path: "property.category", value: "plot" } },
          validation: { required: true }
        },
        {
          id: "comm_complex",
          sectionId: "property_sec",
          branch: "b_commercial",
          path: "property.commercial.complexName",
          kind: "text",
          label: "Commercial Complex / Tech Park Name:",
          description: "e.g., Cyber Gateway Business Centre",
          visibleWhen: { equals: { path: "property.category", value: "commercial" } },
          validation: { required: true }
        },
        {
          id: "carpet_area",
          sectionId: "property_sec",
          path: "property.carpetAreaSqFt",
          kind: "number",
          label: "Total Carpet Area (in Sq. Ft.):",
          description: "As defined under RERA Act 2016",
          validation: { required: true }
        }
      ]
    },
    {
      id: "parties_sec",
      title: "Seller Entity Details",
      questions: [
        {
          id: "seller_type",
          sectionId: "parties_sec",
          path: "parties.primarySeller.entityType",
          kind: "card",
          label: "What is the legal constitution of the Primary Seller?",
          description: "Determines execution verification, PAN/CIN, and Board Resolution mandates",
          options: [
            { value: "individual", label: "Individual / Sole Proprietor", hint: "Natural person with individual PAN & Aadhaar verification" },
            { value: "company", label: "Registered Corporate Body", hint: "Private Limited, Public Limited, LLP with CIN" }
          ],
          validation: { required: true }
        },
        {
          id: "seller_ind_name",
          sectionId: "parties_sec",
          branch: "b_seller_ind",
          path: "parties.primarySeller.individual.fullName",
          kind: "text",
          label: "Full Legal Name of the Individual Seller:",
          description: "As per PAN card or Aadhaar records",
          visibleWhen: { equals: { path: "parties.primarySeller.entityType", value: "individual" } },
          validation: { required: true }
        },
        {
          id: "seller_ind_pan",
          sectionId: "parties_sec",
          branch: "b_seller_ind",
          path: "parties.primarySeller.individual.panNumber",
          kind: "pan",
          label: "Seller's Permanent Account Number (PAN):",
          description: "10-character alphanumeric PAN",
          visibleWhen: { equals: { path: "parties.primarySeller.entityType", value: "individual" } }
        },
        {
          id: "seller_co_name",
          sectionId: "parties_sec",
          branch: "b_seller_co",
          path: "parties.primarySeller.company.corporateName",
          kind: "text",
          label: "Registered Company Name:",
          description: "Exact name as registered with Ministry of Corporate Affairs (MCA)",
          visibleWhen: { equals: { path: "parties.primarySeller.entityType", value: "company" } },
          validation: { required: true }
        },
        {
          id: "seller_co_cin",
          sectionId: "parties_sec",
          branch: "b_seller_co",
          path: "parties.primarySeller.company.cin",
          kind: "cin",
          label: "Corporate Identification Number (CIN):",
          description: "21-character MCA registration string",
          visibleWhen: { equals: { path: "parties.primarySeller.entityType", value: "company" } },
          validation: { required: true }
        },
        {
          id: "seller_co_director",
          sectionId: "parties_sec",
          branch: "b_seller_co",
          path: "parties.primarySeller.company.authorizedDirector",
          kind: "text",
          label: "Name of the Authorized Signatory / Director:",
          description: "Authorized via Board Resolution",
          visibleWhen: { equals: { path: "parties.primarySeller.entityType", value: "company" } }
        }
      ]
    },
    {
      id: "financial_sec",
      title: "Financial Consideration",
      questions: [
        {
          id: "total_price",
          sectionId: "financial_sec",
          path: "consideration.totalAmountInr",
          kind: "currency",
          label: "Total Agreed Sale Consideration (INR):",
          description: "Gross agreed consideration figure",
          validation: { required: true }
        },
        {
          id: "payment_mode",
          sectionId: "financial_sec",
          path: "consideration.primaryPaymentMode",
          kind: "card",
          label: "What is the primary mode of settlement?",
          options: [
            { value: "rtgs", label: "Bank Wire / RTGS / NEFT", hint: "Electronic funds transfer" },
            { value: "cheque", label: "Banker's Cheque / Demand Draft", hint: "Pay order / physical instrument" }
          ]
        },
        {
          id: "advance_paid",
          sectionId: "financial_sec",
          path: "consideration.tokenAdvancePaid",
          kind: "currency",
          label: "Token or Advance Amount Paid (INR):",
          description: "Amount transferred upon signing agreement"
        }
      ]
    }
  ],
  branches: [
    {
      id: "b_apartment",
      activation: { equals: { path: "property.category", value: "apartment" } },
      ownedPaths: ["property.apartment.floorNumber", "property.apartment.towerBlock"]
    },
    {
      id: "b_plot",
      activation: { equals: { path: "property.category", value: "plot" } },
      ownedPaths: ["property.plot.surveyNumber"]
    },
    {
      id: "b_commercial",
      activation: { equals: { path: "property.category", value: "commercial" } },
      ownedPaths: ["property.commercial.complexName"]
    },
    {
      id: "b_seller_ind",
      activation: { equals: { path: "parties.primarySeller.entityType", value: "individual" } },
      ownedPaths: ["parties.primarySeller.individual.fullName", "parties.primarySeller.individual.panNumber"]
    },
    {
      id: "b_seller_co",
      activation: { equals: { path: "parties.primarySeller.entityType", value: "company" } },
      ownedPaths: ["parties.primarySeller.company.corporateName", "parties.primarySeller.company.cin", "parties.primarySeller.company.authorizedDirector"]
    }
  ]
};

export const notice138Schema = {
  id: "section_138_notice",
  version: 1,
  title: "Negotiable Instruments Act (Section 138) Legal Notice",
  sections: [
    {
      id: "cheque_sec",
      title: "Dishonoured Cheque Particulars",
      questions: [
        {
          id: "cheque_number",
          sectionId: "cheque_sec",
          path: "cheque.instrumentNumber",
          kind: "text",
          label: "Enter the 6-digit Cheque Number:",
          description: "e.g., 049281",
          validation: { required: true }
        },
        {
          id: "cheque_amount",
          sectionId: "cheque_sec",
          path: "cheque.amountInr",
          kind: "currency",
          label: "Cheque Face Value Amount (INR):",
          description: "Numeric face amount dishonoured",
          validation: { required: true }
        },
        {
          id: "cheque_bank",
          sectionId: "cheque_sec",
          path: "cheque.draweeBank",
          kind: "text",
          label: "Drawee Bank and Branch Name:",
          description: "Bank upon which cheque was drawn"
        }
      ]
    },
    {
      id: "dishonour_sec",
      title: "Bank Return Details",
      questions: [
        {
          id: "memo_reason",
          sectionId: "dishonour_sec",
          path: "dishonour.returnReason",
          kind: "card",
          label: "What was the official reason stated in Bank Return Memo?",
          options: [
            { value: "funds_insufficient", label: "Funds Insufficient", hint: "Balance in drawer account was inadequate" },
            { value: "account_closed", label: "Account Closed", hint: "Drawer had closed the bank account" },
            { value: "stop_payment", label: "Payment Stopped by Drawer", hint: "Stop payment instruction given" }
          ],
          validation: { required: true }
        },
        {
          id: "memo_date",
          sectionId: "dishonour_sec",
          path: "dishonour.memoDate",
          kind: "date",
          label: "Date of Bank Return Memo:",
          description: "Critical for 30-day statutory limitation period",
          validation: { required: true }
        }
      ]
    }
  ],
  branches: []
};

export const minimalBranchingSchema = {
  id: "branching_demo",
  version: 1,
  title: "Atomic Branch Invalidation Demo",
  sections: [
    {
      id: "demo_sec",
      title: "Discriminator Switching Test",
      questions: [
        {
          id: "user_type",
          sectionId: "demo_sec",
          path: "profile.type",
          kind: "card",
          label: "Select your account profile type:",
          options: [
            { value: "developer", label: "Open Source Developer", hint: "Individual software engineer" },
            { value: "enterprise", label: "Enterprise Organization", hint: "Corporations and teams" }
          ],
          validation: { required: true }
        },
        {
          id: "github_username",
          sectionId: "demo_sec",
          branch: "b_dev",
          path: "profile.developer.githubUsername",
          kind: "text",
          label: "Your GitHub Username:",
          visibleWhen: { equals: { path: "profile.type", value: "developer" } },
          validation: { required: true }
        },
        {
          id: "dev_tier",
          sectionId: "demo_sec",
          branch: "b_dev",
          path: "profile.developer.tier",
          kind: "card",
          label: "Select Sponsorship Tier:",
          options: [
            { value: "free", label: "Free Tier Contributor", hint: "Community access" },
            { value: "sponsor", label: "Gold Sponsor", hint: "Custom tier with pledge" }
          ],
          visibleWhen: { equals: { path: "profile.type", value: "developer" } },
          validation: { required: true }
        },
        {
          id: "dev_sponsor_amount",
          sectionId: "demo_sec",
          branch: "b_dev_sponsor",
          path: "profile.developer.sponsorAmount",
          kind: "currency",
          label: "Monthly Sponsorship Amount ($):",
          visibleWhen: { all: [{ equals: { path: "profile.type", value: "developer" } }, { equals: { path: "profile.developer.tier", value: "sponsor" } }] },
          validation: { required: true }
        },
        {
          id: "company_domain",
          sectionId: "demo_sec",
          branch: "b_ent",
          path: "profile.enterprise.workDomain",
          kind: "text",
          label: "Corporate Work Email Domain:",
          description: "e.g., acme.corp",
          visibleWhen: { equals: { path: "profile.type", value: "enterprise" } },
          validation: { required: true }
        },
        {
          id: "company_seats",
          sectionId: "demo_sec",
          branch: "b_ent",
          path: "profile.enterprise.seats",
          kind: "number",
          label: "Number of Licensed Seats:",
          visibleWhen: { equals: { path: "profile.type", value: "enterprise" } },
          validation: { required: true }
        }
      ]
    }
  ],
  branches: [
    {
      id: "b_dev",
      activation: { equals: { path: "profile.type", value: "developer" } },
      ownedPaths: ["profile.developer.githubUsername", "profile.developer.tier"]
    },
    {
      id: "b_dev_sponsor",
      activation: { all: [{ equals: { path: "profile.type", value: "developer" } }, { equals: { path: "profile.developer.tier", value: "sponsor" } }] },
      ownedPaths: ["profile.developer.sponsorAmount"]
    },
    {
      id: "b_ent",
      activation: { equals: { path: "profile.type", value: "enterprise" } },
      ownedPaths: ["profile.enterprise.workDomain", "profile.enterprise.seats"]
    }
  ]
};
