import type { ExchangeRecord } from "./contracts";
import { resourceProviderPreviewSeed } from "../resources/provider-preview";

export const exchangeSeed: ExchangeRecord[] = [
  ...resourceProviderPreviewSeed,
  {
    id: "rfx-001", type: "rfx", title: "Regional Facilities Maintenance IDIQ", organization: "City of Chesapeake",
    summary: "Multi-trade maintenance and repair services across municipal facilities.", geography: "Chesapeake, VA",
    metadata: ["Sources Sought", "Due Sep 3", "$1M–$5M"], location: { lat: 36.77, lng: -76.29 }, saved: true,
    card: { eyebrow: "Sources Sought", classifications: ["Facilities", "Maintenance"], status: { label: "Open", tone: "info" }, relationships: ["watched"], distance: "34 mi" },
  },
  {
    id: "rfx-002", type: "rfx", title: "Cybersecurity Assessment Services", organization: "Harbor Systems Authority",
    summary: "Assessment, remediation planning, and continuous security advisory support.", geography: "Norfolk, VA",
    metadata: ["RFP", "Due Sep 12", "Professional Services"], location: { lat: 36.85, lng: -76.29 },
    card: {
      eyebrow: "Request for Proposals",
      media: { kind: "video", label: "Short video", poster: "/exchange-media/rfx-cybersecurity-poster.svg", alt: "Abstract cybersecurity network preview for the TestRFx reference RFx" },
      classifications: ["Cybersecurity", "Advisory"], status: { label: "Open", tone: "success" }, distance: "31 mi",
    },
  },
  {
    id: "rfx-003", type: "rfx", title: "Small Business Supplier Outreach", organization: "Accel Analysis",
    summary: "Supplier outreach request managed by the signed-in organization.", geography: "Isle of Wight, VA",
    metadata: ["Supplier Outreach"], location: { lat: 36.9, lng: -76.71 }, ownedByViewer: true,
    card: { eyebrow: "RFx", classifications: ["Supplier Outreach"], status: { label: "Draft", tone: "warning" }, distance: "Local" },
  },
  {
    id: "res-001", type: "resource", title: "Mobile Training Classroom", organization: "Atlantic Skills Group",
    summary: "Twenty-four seat mobile classroom available for short-term deployment across Hampton Roads.", geography: "Suffolk, VA",
    metadata: ["Training & Facilities", "Available now", "24 seats"], location: { lat: 36.73, lng: -76.58 }, featured: true,
    card: {
      eyebrow: "Resource Offer",
      media: { kind: "image", label: "Mobile classroom", src: "/exchange-media/resource-mobile-classroom.svg", alt: "Illustrated mobile classroom preview used by the TestRFx reference Resource listing" },
      classifications: ["Training & Facilities", "Equipment"], status: { label: "Available now", tone: "success" }, placement: "sponsored", distance: "18 mi",
    },
    resource: { category: "Training & Facilities", availability: "available", availabilityLabel: "Available now", capacity: "24 seats", serviceArea: "Hampton Roads", visibility: "public-location", terms: "Short-term deployment; provider confirms scheduling and delivery requirements.", status: "active", sponsored: true },
  },
  {
    id: "res-002", type: "resource", title: "Proposal Review Capacity", organization: "Peninsula Advisory Partners",
    summary: "Experienced capture and proposal review support for government contractors on a remote basis.", geography: "Virginia",
    metadata: ["Professional Services", "Remote", "Available now", "Off-map"],
    card: { eyebrow: "Resource Offer", classifications: ["Proposal Support", "Capture"], status: { label: "Available now", tone: "success" } },
    resource: { category: "Professional Services", availability: "available", availabilityLabel: "Available now", capacity: "Up to 40 review hours / month", serviceArea: "Remote / Virginia", visibility: "off-map", terms: "Scope and timing confirmed with the provider after request.", status: "active" },
  },
  {
    id: "res-003", type: "resource", title: "Conference Room Inventory", organization: "Accel Analysis",
    summary: "Meeting and workshop space offered for partner use.", geography: "Isle of Wight, VA",
    metadata: ["Facilities", "Available now", "Up to 18 people"], location: { lat: 36.91, lng: -76.7 }, ownedByViewer: true,
    card: { eyebrow: "Resource Offer", classifications: ["Facilities"], status: { label: "Published", tone: "info" }, distance: "Local" },
    resource: { category: "Facilities", availability: "available", availabilityLabel: "Available now", capacity: "Up to 18 people", serviceArea: "Isle of Wight County", visibility: "public-location", terms: "Partner scheduling required.", status: "active" },
  },
  {
    id: "res-004", type: "resource", title: "Portable Generator Fleet", organization: "Tidewater Site Services",
    summary: "Towable generators with delivery and setup support for temporary operations and field events.", geography: "Portsmouth, VA",
    metadata: ["Equipment", "Limited availability", "20–60 kW", "Sponsored"], location: { lat: 36.82, lng: -76.31 }, featured: true,
    card: { eyebrow: "Resource Offer", classifications: ["Equipment", "Field Support"], status: { label: "Limited", tone: "warning" }, placement: "sponsored", distance: "32 mi" },
    resource: { category: "Equipment", availability: "limited", availabilityLabel: "Limited availability", capacity: "20–60 kW units", serviceArea: "South Hampton Roads", visibility: "service-area", terms: "Delivery, fuel, and setup quoted separately.", status: "active", sponsored: true },
  },
  {
    id: "res-005", type: "resource", title: "GIS Data Subscription Access", organization: "Coastal Data Cooperative",
    summary: "Shared access to regional parcel, infrastructure, and development datasets for approved project teams.", geography: "Hampton Roads, VA",
    metadata: ["Data & Intelligence", "Scheduled access", "Off-map"], saved: true,
    card: { eyebrow: "Resource Offer", classifications: ["Data", "Intelligence"], status: { label: "Scheduled", tone: "info" }, relationships: ["saved"] },
    resource: { category: "Data & Intelligence", availability: "scheduled", availabilityLabel: "Scheduled access", capacity: "Project-based seats", serviceArea: "Hampton Roads", visibility: "off-map", terms: "Data-use restrictions and project eligibility apply.", status: "active" },
  },
  {
    id: "intel-001", type: "intelligence", title: "Maritime supplier concentration is rising", organization: "RFxchange Intelligence",
    summary: "Capability density increased around the Norfolk–Portsmouth corridor in the reference dataset.", geography: "Hampton Roads, VA",
    metadata: ["Market signal", "30-day view", "Maritime"], location: { lat: 36.84, lng: -76.32 },
    card: {
      eyebrow: "Market Signal",
      media: { kind: "visualization", label: "Supply signal", src: "/exchange-media/intelligence-maritime-signal.svg", alt: "Illustrated maritime supply-density signal for TestRFx reference intelligence" },
      classifications: ["Maritime", "Supply Density"], status: { label: "Updated", tone: "info" }, relationships: ["following"],
    },
  },
  {
    id: "intel-002", type: "intelligence", title: "Training demand exceeds visible local supply", organization: "RFxchange Intelligence",
    summary: "Reference insight demonstrating off-map intelligence in the drawer.", geography: "Virginia",
    metadata: ["Demand signal", "60-day view", "Workforce", "Off-map record"],
    card: { eyebrow: "Demand Signal", media: { kind: "visualization", label: "Insight" }, classifications: ["Workforce", "Training"], status: { label: "Current", tone: "info" } },
  },
  {
    id: "cap-001", type: "capability", title: "Industrial Electrical Installation", organization: "Tidewater Technical Services",
    summary: "Commercial and industrial electrical installation and maintenance capability.", geography: "Portsmouth, VA",
    metadata: ["AMACS mapped", "Electrical", "Field service"], location: { lat: 36.84, lng: -76.34 },
    card: {
      eyebrow: "Organization Capability",
      media: { kind: "image", label: "Electrical capability", src: "/exchange-media/capability-electrical.svg", alt: "Illustrated electrical system preview for the TestRFx capability reference" },
      classifications: ["AMACS Mapped", "Electrical", "Field Service"], status: { label: "Published", tone: "success" }, relationships: ["following"], distance: "33 mi",
    },
  },
  {
    id: "cap-002", type: "capability", title: "Business Intelligence & Market Analysis", organization: "Accel Analysis",
    summary: "Business intelligence and market analysis capability published by the signed-in organization.", geography: "Isle of Wight, VA",
    metadata: ["AMACS mapped", "Market Analysis"], location: { lat: 36.9, lng: -76.71 }, ownedByViewer: true,
    card: { eyebrow: "Organization Capability", classifications: ["AMACS Mapped", "Market Analysis", "Business Intelligence"], status: { label: "Published", tone: "success" }, distance: "Local" },
  },
  {
    id: "cap-003", type: "capability", title: "K-9 Training & Education", organization: "Regional Working Dog Institute",
    summary: "Training, curriculum, facility, and operational support capabilities.", geography: "Virginia",
    metadata: ["Training", "Education", "Off-map record"],
    card: {
      eyebrow: "Organization Capability",
      organizationMedia: { logo: { kind: "logo", label: "Organization mark", src: "/exchange-media/organization-rwdi-mark.svg", alt: "Reference organization mark for Regional Working Dog Institute" } },
      classifications: ["Training", "Education"], status: { label: "Published", tone: "success" }, relationships: ["referred"],
    },
  },
];
