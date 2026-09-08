/**
 * Comprehensive Property Conveyance & Intake Schema demonstrating:
 * - Dynamic progressive question derivation
 * - Branch invalidation & atomic cleanup
 * - Conditional question visibility
 * - Repeaters for nested collections
 */
export const propertyIntakeSchema = {
  id: "property_conveyance_v1",
  title: "Property Conveyance Intake",
  version: 1,
  sections: [
    {
      id: "sec_property",
      title: "Property Identification",
      description: "Specify the nature and physical details of the immovable property.",
      questions: [
        {
          id: "prop_category",
          sectionId: "sec_property",
          path: "property.category",
          kind: "card",
          label: "What is the classification of the property?",
          description: "Select the asset class to dynamically configure statutory disclosures.",
          options: [
            {
              value: "apartment",
              label: "Residential Apartment / Flat",
              description: "High-rise or multi-unit residential building with undivided share.",
            },
            {
              value: "plot",
              label: "Vacant Plot / Land Parcel",
              description: "Demarcated freehold or leasehold land parcel.",
            },
          ],
        },
        {
          id: "prop_address",
          sectionId: "sec_property",
          path: "property.address",
          kind: "text",
          label: "Registered Property Address",
          description: "Full municipal address as recorded in the title deed.",
        },
        {
          id: "apt_floor",
          sectionId: "sec_property",
          path: "property.apartment.floor",
          kind: "number",
          label: "Floor Number",
          description: "The floor on which the apartment unit is located.",
          visibleWhen: { equals: { path: "property.category", value: "apartment" } },
          validate: (val: any) =>
            (Number(val) >= 0 && Number(val) <= 150) || "Floor number must be between 0 (Ground) and 150.",
        },
        {
          id: "apt_super_area",
          sectionId: "sec_property",
          path: "property.apartment.superAreaSqFt",
          kind: "number",
          label: "Super Built-Up Area (sq. ft.)",
          visibleWhen: { equals: { path: "property.category", value: "apartment" } },
          validate: (val: any) => Number(val) > 50 || "Super built-up area must be greater than 50 sq. ft.",
        },
        {
          id: "plot_survey_number",
          sectionId: "sec_property",
          path: "property.plot.surveyNumber",
          kind: "text",
          label: "Survey / Khasra Number",
          description: "Revenue department cadastral survey or plot number.",
          visibleWhen: { equals: { path: "property.category", value: "plot" } },
        },
        {
          id: "plot_area_sqyds",
          sectionId: "sec_property",
          path: "property.plot.areaSqYards",
          kind: "number",
          label: "Total Plot Area (sq. yards)",
          visibleWhen: { equals: { path: "property.category", value: "plot" } },
          validate: (val: any) => Number(val) > 0 || "Area must be a positive number.",
        },
      ],
    },
    {
      id: "sec_seller",
      title: "Seller Entity & KYC",
      description: "Identify the transferring party and statutory identity documentation.",
      questions: [
        {
          id: "seller_type",
          sectionId: "sec_seller",
          path: "seller.type",
          kind: "card",
          label: "What is the legal constitution of the Seller?",
          options: [
            {
              value: "individual",
              label: "Individual / Natural Person",
              description: "Sole owner or joint individual proprietors.",
            },
            {
              value: "company",
              label: "Corporate Body / Private Limited",
              description: "Registered company acting through authorized signatory.",
            },
          ],
        },
        {
          id: "seller_name",
          sectionId: "sec_seller",
          path: "seller.name",
          kind: "text",
          label: "Full Legal Name of Seller",
          description: "Name as appearing on official government photo ID or Certificate of Incorporation.",
        },
        {
          id: "seller_pan",
          sectionId: "sec_seller",
          path: "seller.individual.pan",
          kind: "text",
          label: "Permanent Account Number (PAN)",
          description: "10-character alphanumeric tax identifier.",
          visibleWhen: { equals: { path: "seller.type", value: "individual" } },
          validate: (val: any) =>
            /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(String(val || "").trim()) ||
            "Please enter a valid 10-character PAN (e.g. ABCDE1234F).",
        },
        {
          id: "seller_cin",
          sectionId: "sec_seller",
          path: "seller.company.cin",
          kind: "text",
          label: "Corporate Identification Number (CIN)",
          description: "21-character MCA corporate registration identifier.",
          visibleWhen: { equals: { path: "seller.type", value: "company" } },
        },
        {
          id: "seller_auth_signatory",
          sectionId: "sec_seller",
          path: "seller.company.signatoryName",
          kind: "text",
          label: "Authorized Signatory Name",
          description: "Director or authorized officer pursuant to Board Resolution.",
          visibleWhen: { equals: { path: "seller.type", value: "company" } },
        },
      ],
    },
    {
      id: "sec_terms",
      title: "Financial Consideration",
      description: "Transaction value and payment structure.",
      questions: [
        {
          id: "sale_consideration",
          sectionId: "sec_terms",
          path: "terms.considerationAmount",
          kind: "number",
          label: "Total Sale Consideration ($)",
          description: "Agreed total purchase price for conveyance.",
          validate: (val: any) => Number(val) > 0 || "Consideration amount must be greater than zero.",
        },
        {
          id: "possession_date",
          sectionId: "sec_terms",
          path: "terms.possessionTargetDate",
          kind: "text",
          label: "Target Handover Date",
          description: "Anticipated date of physical handover (YYYY-MM-DD).",
        },
      ],
    },
  ],
  branches: [
    {
      id: "branch_prop_apartment",
      activation: { equals: { path: "property.category", value: "apartment" } },
      ownedPaths: ["property.apartment"],
    },
    {
      id: "branch_prop_plot",
      activation: { equals: { path: "property.category", value: "plot" } },
      ownedPaths: ["property.plot"],
    },
    {
      id: "branch_seller_individual",
      activation: { equals: { path: "seller.type", value: "individual" } },
      ownedPaths: ["seller.individual"],
    },
    {
      id: "branch_seller_company",
      activation: { equals: { path: "seller.type", value: "company" } },
      ownedPaths: ["seller.company"],
    },
  ],
};
