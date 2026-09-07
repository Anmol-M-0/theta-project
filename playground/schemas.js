/**
 * Theta Playground Preset Schemas
 */

export const conveyanceDeedSchema = {
  id: "indian_conveyance_deed",
  version: 1,
  title: "Agreement to Sell / Conveyance Deed",
  sections: [
    {
      id: "property_sec",
      title: "Property Classification",
      questions: [
        {
          id: "prop_category",
          sectionId: "property_sec",
          path: "property.category",
          kind: "card",
          label: "What is the physical nature of the property?",
          description: "Select the legal classification under local revenue laws.",
          options: [
            { value: "apartment", label: "Residential Apartment", hint: "Flats, duplexes, multi-unit buildings" },
            { value: "plot", label: "Vacant Plotted Land", hint: "Survey layout plots, freehold land" },
            { value: "commercial", label: "Commercial Unit", hint: "Retail shops, office spaces, warehouses" }
          ],
          validation: { required: true }
        },
        {
          id: "apt_floor",
          sectionId: "property_sec",
          path: "property.apartment.floorNumber",
          kind: "number",
          label: "On which floor is the apartment situated?",
          description: "e.g., 4 for 4th Floor, 0 for Ground Floor",
          visibleWhen: { field: "property.category", operator: "equals", value: "apartment" },
          validation: { required: true }
        },
        {
          id: "apt_tower",
          sectionId: "property_sec",
          path: "property.apartment.towerBlock",
          kind: "text",
          label: "Tower, Wing or Block identification:",
          description: "e.g., Tower B, Wing 3",
          visibleWhen: { field: "property.category", operator: "equals", value: "apartment" }
        },
        {
          id: "plot_survey",
          sectionId: "property_sec",
          path: "property.plot.surveyNumber",
          kind: "text",
          label: "Revenue Survey / Khasra Number:",
          description: "Official survey or plot identification in revenue records",
          visibleWhen: { field: "property.category", operator: "equals", value: "plot" },
          validation: { required: true }
        },
        {
          id: "comm_shop_no",
          sectionId: "property_sec",
          path: "property.commercial.unitNumber",
          kind: "text",
          label: "Commercial Unit / Shop Number:",
          description: "Unit number as sanctioned in the master plan",
          visibleWhen: { field: "property.category", operator: "equals", value: "commercial" },
          validation: { required: true }
        },
        {
          id: "carpet_area",
          sectionId: "property_sec",
          path: "property.carpetAreaSqFt",
          kind: "number",
          label: "Total Carpet Area (in sq. ft.):",
          description: "RERA carpet area measurement",
          validation: { required: true }
        }
      ]
    },
    {
      id: "parties_sec",
      title: "Parties Identification",
      questions: [
        {
          id: "seller_entity_type",
          sectionId: "parties_sec",
          path: "parties.primarySeller.entityType",
          kind: "card",
          label: "What is the legal entity constitution of the Seller?",
          description: "Changing this cleanly clears conditional company/individual facts.",
          options: [
            { value: "individual", label: "Individual / Natural Person", hint: "Natural citizen, proprietary" },
            { value: "company", label: "Registered Corporate Body", hint: "Private Limited, Public Limited, LLP" }
          ],
          validation: { required: true }
        },
        {
          id: "seller_ind_name",
          sectionId: "parties_sec",
          path: "parties.primarySeller.individual.fullName",
          kind: "text",
          label: "Full Legal Name of the Individual Seller:",
          description: "As per PAN card or Aadhaar records",
          visibleWhen: { field: "parties.primarySeller.entityType", operator: "equals", value: "individual" },
          validation: { required: true }
        },
        {
          id: "seller_ind_pan",
          sectionId: "parties_sec",
          path: "parties.primarySeller.individual.panNumber",
          kind: "text",
          label: "Seller's Permanent Account Number (PAN):",
          description: "10-character alphanumeric PAN",
          visibleWhen: { field: "parties.primarySeller.entityType", operator: "equals", value: "individual" }
        },
        {
          id: "seller_co_name",
          sectionId: "parties_sec",
          path: "parties.primarySeller.company.corporateName",
          kind: "text",
          label: "Registered Company Name:",
          description: "Exact name as registered with Ministry of Corporate Affairs (MCA)",
          visibleWhen: { field: "parties.primarySeller.entityType", operator: "equals", value: "company" },
          validation: { required: true }
        },
        {
          id: "seller_co_cin",
          sectionId: "parties_sec",
          path: "parties.primarySeller.company.cin",
          kind: "text",
          label: "Corporate Identification Number (CIN):",
          description: "21-character MCA registration string",
          visibleWhen: { field: "parties.primarySeller.entityType", operator: "equals", value: "company" },
          validation: { required: true }
        },
        {
          id: "seller_co_director",
          sectionId: "parties_sec",
          path: "parties.primarySeller.company.authorizedDirector",
          kind: "text",
          label: "Name of the Authorized Signatory / Director:",
          description: "Authorized via Board Resolution",
          visibleWhen: { field: "parties.primarySeller.entityType", operator: "equals", value: "company" }
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
          kind: "number",
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
          kind: "number",
          label: "Token or Advance Amount Paid (INR):",
          description: "Amount transferred upon signing agreement"
        }
      ]
    }
  ],
  branches: [
    {
      id: "prop_category_branch",
      discriminatorPath: "property.category",
      ownedPaths: {
        apartment: ["property.apartment"],
        plot: ["property.plot"],
        commercial: ["property.commercial"]
      }
    },
    {
      id: "seller_entity_branch",
      discriminatorPath: "parties.primarySeller.entityType",
      ownedPaths: {
        individual: ["parties.primarySeller.individual"],
        company: ["parties.primarySeller.company"]
      }
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
          kind: "number",
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
          kind: "text",
          label: "Date of Bank Return Memo:",
          description: "DD/MM/YYYY - Critical for 30-day statutory limitation",
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
            { value: "developer", label: "Open Source Developer", hint: "Individual contributor" },
            { value: "enterprise", label: "Enterprise Organization", hint: "Corporations and teams" }
          ],
          validation: { required: true }
        },
        {
          id: "github_username",
          sectionId: "demo_sec",
          path: "profile.developer.githubUsername",
          kind: "text",
          label: "Your GitHub Username:",
          visibleWhen: { field: "profile.type", operator: "equals", value: "developer" },
          validation: { required: true }
        },
        {
          id: "company_domain",
          sectionId: "demo_sec",
          path: "profile.enterprise.workDomain",
          kind: "text",
          label: "Corporate Work Email Domain:",
          visibleWhen: { field: "profile.type", operator: "equals", value: "enterprise" },
          validation: { required: true }
        }
      ]
    }
  ],
  branches: [
    {
      id: "profile_branch",
      discriminatorPath: "profile.type",
      ownedPaths: {
        developer: ["profile.developer"],
        enterprise: ["profile.enterprise"]
      }
    }
  ]
};
