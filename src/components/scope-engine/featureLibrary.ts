// ─── Scope Engine — Feature Library ──────────────────────────────────────────
// Every feature defines HOURS effort per role at each complexity tier.
// The engine multiplies by quantity × complexityMultiplier → phase allocations.

export type Complexity = "low" | "medium" | "high";
export type FeatureCategory =
  | "discovery"
  | "design"
  | "frontend"
  | "backend"
  | "mobile"
  | "ecommerce"
  | "integration"
  | "devops"
  | "testing"
  | "cms"
  | "social";

/** Hours per role for ONE unit at given complexity */
export interface FeatureEffort {
  designer: number; // UI/UX design hours
  frontend: number; // Frontend / React dev hours
  backend: number; // Backend / Laravel / API hours
  mobile: number; // Mobile (iOS/Android/Flutter) hours
  pm: number; // Project management + meetings hours
  qa: number; // Quality assurance / testing hours
}

export interface FeatureDefinition {
  id: string;
  category: FeatureCategory;
  label: string;
  description: string;
  effort: Record<Complexity, FeatureEffort>;
  /** Legacy emoji field kept for stored rows; the UI renders a category glyph instead. */
  icon?: string;
  tags: string[];
}

// ─── Complexity multiplier labels ─────────────────────────────────────────────
export const COMPLEXITY_LABELS: Record<
  Complexity,
  { label: string; description: string; color: string }
> = {
  low: {
    label: "Simple",
    description: "Standard patterns, minimal customisation",
    color: "emerald",
  },
  medium: { label: "Medium", description: "Custom logic, moderate complexity", color: "amber" },
  high: {
    label: "Complex",
    description: "Advanced features, integrations, edge-cases",
    color: "red",
  },
};

// ─── Feature Library ──────────────────────────────────────────────────────────
export const FEATURE_LIBRARY: FeatureDefinition[] = [
  // ── Discovery & Strategy ─────────────────────────────────────────────────
  {
    id: "discovery_workshop",
    category: "discovery",
    label: "Discovery & Requirements Workshop",
    description: "Stakeholder interviews, user journey mapping, technical feasibility",
    tags: ["planning", "ux"],
    effort: {
      low: { designer: 4, frontend: 2, backend: 2, mobile: 0, pm: 8, qa: 0 },
      medium: { designer: 8, frontend: 4, backend: 4, mobile: 0, pm: 16, qa: 0 },
      high: { designer: 16, frontend: 8, backend: 8, mobile: 0, pm: 32, qa: 4 },
    },
  },
  {
    id: "technical_architecture",
    category: "discovery",
    label: "Technical Architecture & System Design",
    description: "DB schema, API design, cloud architecture, tech stack selection",
    tags: ["backend", "planning"],
    effort: {
      low: { designer: 0, frontend: 4, backend: 8, mobile: 0, pm: 4, qa: 0 },
      medium: { designer: 0, frontend: 8, backend: 16, mobile: 0, pm: 8, qa: 0 },
      high: { designer: 0, frontend: 16, backend: 32, mobile: 0, pm: 16, qa: 8 },
    },
  },

  // ── UX / Design ───────────────────────────────────────────────────────────
  {
    id: "wireframes",
    category: "design",
    label: "Wireframes & User Flow Diagrams",
    description: "Lo-fi wireframes, clickable prototypes, user flow mapping",
    tags: ["ux", "design"],
    effort: {
      low: { designer: 8, frontend: 0, backend: 0, mobile: 0, pm: 2, qa: 0 },
      medium: { designer: 16, frontend: 0, backend: 0, mobile: 0, pm: 4, qa: 0 },
      high: { designer: 32, frontend: 0, backend: 0, mobile: 0, pm: 8, qa: 0 },
    },
  },
  {
    id: "ui_design",
    category: "design",
    label: "UI Visual Design (Hi-Fi Screens)",
    description: "High-fidelity Figma designs, design system, component library",
    tags: ["design", "ui"],
    effort: {
      low: { designer: 16, frontend: 0, backend: 0, mobile: 0, pm: 2, qa: 0 },
      medium: { designer: 32, frontend: 0, backend: 0, mobile: 0, pm: 4, qa: 0 },
      high: { designer: 64, frontend: 0, backend: 0, mobile: 0, pm: 8, qa: 0 },
    },
  },
  {
    id: "branding",
    category: "design",
    label: "Logo & Brand Identity",
    description: "Logo design, brand guidelines, colour palette, typography",
    tags: ["branding", "design"],
    effort: {
      low: { designer: 8, frontend: 0, backend: 0, mobile: 0, pm: 2, qa: 0 },
      medium: { designer: 24, frontend: 0, backend: 0, mobile: 0, pm: 4, qa: 0 },
      high: { designer: 48, frontend: 0, backend: 0, mobile: 0, pm: 8, qa: 0 },
    },
  },
  {
    id: "social_media_creatives",
    category: "social",
    label: "Social Media Creatives / Posts",
    description: "Per batch of social media graphics (posts, stories, banners)",
    tags: ["social", "design"],
    effort: {
      low: { designer: 4, frontend: 0, backend: 0, mobile: 0, pm: 1, qa: 0 },
      medium: { designer: 8, frontend: 0, backend: 0, mobile: 0, pm: 2, qa: 0 },
      high: { designer: 16, frontend: 0, backend: 0, mobile: 0, pm: 3, qa: 0 },
    },
  },

  // ── Authentication & Users ────────────────────────────────────────────────
  {
    id: "auth_system",
    category: "backend",
    label: "User Authentication System",
    description: "Register, login, forgot password, JWT/session management",
    tags: ["auth", "backend"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 8, mobile: 4, pm: 2, qa: 4 },
      medium: { designer: 8, frontend: 16, backend: 16, mobile: 8, pm: 4, qa: 8 },
      high: { designer: 16, frontend: 24, backend: 32, mobile: 16, pm: 8, qa: 16 },
    },
  },
  {
    id: "social_login",
    category: "backend",
    label: "Social Login (Google / Facebook / Apple)",
    description: "OAuth 2.0 social sign-in providers",
    tags: ["auth", "oauth"],
    effort: {
      low: { designer: 2, frontend: 4, backend: 8, mobile: 4, pm: 1, qa: 4 },
      medium: { designer: 4, frontend: 8, backend: 12, mobile: 8, pm: 2, qa: 8 },
      high: { designer: 8, frontend: 16, backend: 24, mobile: 16, pm: 4, qa: 12 },
    },
  },
  {
    id: "roles_permissions",
    category: "backend",
    label: "Roles & Permissions (RBAC)",
    description: "Admin / manager / user role system with access control",
    tags: ["auth", "admin"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 16, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 8, frontend: 16, backend: 24, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 16, frontend: 24, backend: 40, mobile: 0, pm: 12, qa: 24 },
    },
  },

  // ── Frontend / Web ────────────────────────────────────────────────────────
  {
    id: "landing_page",
    category: "frontend",
    label: "Landing Page / Marketing Site",
    description: "Hero, features, pricing, CTA, testimonials, responsive",
    tags: ["frontend", "marketing"],
    effort: {
      low: { designer: 8, frontend: 8, backend: 0, mobile: 0, pm: 2, qa: 4 },
      medium: { designer: 16, frontend: 16, backend: 0, mobile: 0, pm: 4, qa: 8 },
      high: { designer: 32, frontend: 32, backend: 0, mobile: 0, pm: 8, qa: 16 },
    },
  },
  {
    id: "dashboard_ui",
    category: "frontend",
    label: "Admin / User Dashboard",
    description: "Charts, stats, data tables, filters, analytics views",
    tags: ["frontend", "dashboard"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 8, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 16, frontend: 32, backend: 16, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 24, frontend: 56, backend: 32, mobile: 0, pm: 16, qa: 24 },
    },
  },
  {
    id: "forms_crud",
    category: "frontend",
    label: "Forms & CRUD Operations",
    description: "Create / read / update / delete for a data entity with validation",
    tags: ["frontend", "backend"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 8, mobile: 0, pm: 2, qa: 4 },
      medium: { designer: 8, frontend: 16, backend: 16, mobile: 0, pm: 4, qa: 8 },
      high: { designer: 12, frontend: 24, backend: 32, mobile: 0, pm: 8, qa: 16 },
    },
  },
  {
    id: "search_filter",
    category: "frontend",
    label: "Search & Advanced Filters",
    description: "Full-text search, faceted filters, sort, pagination",
    tags: ["frontend", "backend"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 8, mobile: 0, pm: 2, qa: 4 },
      medium: { designer: 8, frontend: 16, backend: 16, mobile: 0, pm: 4, qa: 8 },
      high: { designer: 12, frontend: 24, backend: 32, mobile: 0, pm: 8, qa: 16 },
    },
  },
  {
    id: "notifications",
    category: "frontend",
    label: "In-App Notifications / Alerts",
    description: "Real-time notification centre, read/unread, toast system",
    tags: ["frontend", "backend"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 8, mobile: 4, pm: 2, qa: 4 },
      medium: { designer: 8, frontend: 16, backend: 16, mobile: 8, pm: 4, qa: 8 },
      high: { designer: 12, frontend: 24, backend: 24, mobile: 16, pm: 8, qa: 16 },
    },
  },

  // ── Backend / APIs ────────────────────────────────────────────────────────
  {
    id: "rest_api",
    category: "backend",
    label: "REST API Development",
    description: "CRUD endpoints, auth middleware, error handling, pagination",
    tags: ["backend", "api"],
    effort: {
      low: { designer: 0, frontend: 4, backend: 16, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 0, frontend: 8, backend: 32, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 0, frontend: 16, backend: 64, mobile: 0, pm: 16, qa: 32 },
    },
  },
  {
    id: "email_system",
    category: "backend",
    label: "Email Notifications / Templates",
    description: "Transactional emails, HTML templates, queue-based sending",
    tags: ["backend", "notifications"],
    effort: {
      low: { designer: 4, frontend: 0, backend: 8, mobile: 0, pm: 2, qa: 4 },
      medium: { designer: 8, frontend: 0, backend: 16, mobile: 0, pm: 4, qa: 8 },
      high: { designer: 16, frontend: 0, backend: 24, mobile: 0, pm: 8, qa: 16 },
    },
  },
  {
    id: "file_upload",
    category: "backend",
    label: "File Upload & Storage",
    description: "Image/document upload, S3 / cloud storage, processing pipeline",
    tags: ["backend", "storage"],
    effort: {
      low: { designer: 2, frontend: 8, backend: 8, mobile: 4, pm: 2, qa: 4 },
      medium: { designer: 4, frontend: 12, backend: 16, mobile: 8, pm: 4, qa: 8 },
      high: { designer: 8, frontend: 16, backend: 32, mobile: 16, pm: 8, qa: 16 },
    },
  },
  {
    id: "reporting_export",
    category: "backend",
    label: "Reports & Data Export (PDF/Excel)",
    description: "PDF generation, Excel export, scheduled reports",
    tags: ["backend", "reports"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 16, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 8, frontend: 16, backend: 24, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 12, frontend: 24, backend: 40, mobile: 0, pm: 16, qa: 24 },
    },
  },

  // ── Mobile App ────────────────────────────────────────────────────────────
  {
    id: "mobile_app_core",
    category: "mobile",
    label: "Mobile App (Core — React Native / Flutter)",
    description: "App shell, navigation, auth screens, core feature screens",
    tags: ["mobile", "app"],
    effort: {
      low: { designer: 16, frontend: 0, backend: 8, mobile: 40, pm: 8, qa: 16 },
      medium: { designer: 32, frontend: 0, backend: 16, mobile: 80, pm: 16, qa: 32 },
      high: { designer: 64, frontend: 0, backend: 32, mobile: 160, pm: 32, qa: 64 },
    },
  },
  {
    id: "push_notifications",
    category: "mobile",
    label: "Push Notifications (FCM / APNs)",
    description: "Firebase push, notification scheduling, deep-linking",
    tags: ["mobile", "notifications"],
    effort: {
      low: { designer: 2, frontend: 0, backend: 8, mobile: 8, pm: 2, qa: 4 },
      medium: { designer: 4, frontend: 0, backend: 16, mobile: 16, pm: 4, qa: 8 },
      high: { designer: 8, frontend: 0, backend: 24, mobile: 24, pm: 8, qa: 16 },
    },
  },
  {
    id: "offline_mode",
    category: "mobile",
    label: "Offline Mode & Sync",
    description: "Local storage, sync queue, conflict resolution",
    tags: ["mobile", "sync"],
    effort: {
      low: { designer: 4, frontend: 0, backend: 8, mobile: 16, pm: 4, qa: 8 },
      medium: { designer: 8, frontend: 0, backend: 16, mobile: 32, pm: 8, qa: 16 },
      high: { designer: 16, frontend: 0, backend: 32, mobile: 64, pm: 16, qa: 32 },
    },
  },

  // ── E-commerce ───────────────────────────────────────────────────────────
  {
    id: "product_catalog",
    category: "ecommerce",
    label: "Product Catalogue & Listing",
    description: "Product cards, gallery, variants, stock status",
    tags: ["ecommerce", "frontend"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 8, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 16, frontend: 24, backend: 16, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 32, frontend: 40, backend: 32, mobile: 0, pm: 16, qa: 24 },
    },
  },
  {
    id: "shopping_cart",
    category: "ecommerce",
    label: "Shopping Cart & Checkout",
    description: "Cart management, shipping calc, address, order summary",
    tags: ["ecommerce", "backend"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 16, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 16, frontend: 24, backend: 24, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 24, frontend: 40, backend: 40, mobile: 0, pm: 16, qa: 24 },
    },
  },
  {
    id: "payment_gateway",
    category: "ecommerce",
    label: "Payment Gateway (Stripe / PayFast / Easypaisa)",
    description: "Card payments, wallet, recurring billing, refunds",
    tags: ["payments", "backend"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 16, mobile: 4, pm: 4, qa: 8 },
      medium: { designer: 8, frontend: 16, backend: 24, mobile: 8, pm: 8, qa: 16 },
      high: { designer: 16, frontend: 24, backend: 40, mobile: 16, pm: 16, qa: 24 },
    },
  },
  {
    id: "order_management",
    category: "ecommerce",
    label: "Order Management & Fulfilment",
    description: "Order lifecycle, status tracking, invoices, returns",
    tags: ["ecommerce", "backend"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 24, mobile: 0, pm: 8, qa: 16 },
      medium: { designer: 16, frontend: 24, backend: 40, mobile: 0, pm: 16, qa: 24 },
      high: { designer: 24, frontend: 40, backend: 64, mobile: 0, pm: 24, qa: 40 },
    },
  },

  // ── WordPress / CMS ──────────────────────────────────────────────────────
  {
    id: "wordpress_theme",
    category: "cms",
    label: "WordPress Custom Theme",
    description: "Custom WP theme from Figma design, responsive, ACF fields",
    tags: ["wordpress", "cms"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 8, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 16, frontend: 32, backend: 16, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 32, frontend: 64, backend: 24, mobile: 0, pm: 16, qa: 24 },
    },
  },
  {
    id: "wordpress_plugins",
    category: "cms",
    label: "WordPress Custom Plugin Development",
    description: "Bespoke WP plugin, hooks, shortcodes, admin UI",
    tags: ["wordpress", "backend"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 16, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 8, frontend: 16, backend: 32, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 16, frontend: 24, backend: 64, mobile: 0, pm: 16, qa: 32 },
    },
  },
  {
    id: "shopify_store",
    category: "ecommerce",
    label: "Shopify Store Setup & Customisation",
    description: "Theme customisation, apps, product setup, payment config",
    tags: ["shopify", "ecommerce"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 4, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 16, frontend: 32, backend: 8, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 32, frontend: 56, backend: 24, mobile: 0, pm: 16, qa: 24 },
    },
  },

  // ── Integrations ─────────────────────────────────────────────────────────
  {
    id: "third_party_api",
    category: "integration",
    label: "3rd Party API Integration",
    description: "CRM, ERP, maps, SMS, analytics, or any external service",
    tags: ["integration", "backend"],
    effort: {
      low: { designer: 0, frontend: 4, backend: 16, mobile: 0, pm: 4, qa: 8 },
      medium: { designer: 0, frontend: 8, backend: 24, mobile: 0, pm: 8, qa: 16 },
      high: { designer: 0, frontend: 16, backend: 40, mobile: 0, pm: 16, qa: 24 },
    },
  },
  {
    id: "real_time_chat",
    category: "integration",
    label: "Real-Time Chat / Messaging",
    description: "WebSocket chat, channels, read receipts, media sharing",
    tags: ["realtime", "backend"],
    effort: {
      low: { designer: 8, frontend: 16, backend: 24, mobile: 16, pm: 8, qa: 16 },
      medium: { designer: 16, frontend: 32, backend: 40, mobile: 32, pm: 16, qa: 24 },
      high: { designer: 24, frontend: 56, backend: 64, mobile: 56, pm: 24, qa: 40 },
    },
  },
  {
    id: "maps_geolocation",
    category: "integration",
    label: "Maps & Geolocation Features",
    description: "Google Maps / Mapbox, location tracking, radius search",
    tags: ["maps", "mobile"],
    effort: {
      low: { designer: 4, frontend: 8, backend: 8, mobile: 8, pm: 4, qa: 8 },
      medium: { designer: 8, frontend: 16, backend: 16, mobile: 16, pm: 8, qa: 16 },
      high: { designer: 16, frontend: 24, backend: 32, mobile: 32, pm: 16, qa: 24 },
    },
  },

  // ── DevOps & Infrastructure ────────────────────────────────────────────
  {
    id: "ci_cd_pipeline",
    category: "devops",
    label: "CI/CD Pipeline Setup",
    description: "GitHub Actions / GitLab CI, staging, production deployment",
    tags: ["devops", "deployment"],
    effort: {
      low: { designer: 0, frontend: 4, backend: 8, mobile: 0, pm: 4, qa: 4 },
      medium: { designer: 0, frontend: 8, backend: 16, mobile: 0, pm: 8, qa: 8 },
      high: { designer: 0, frontend: 16, backend: 32, mobile: 0, pm: 16, qa: 16 },
    },
  },
  {
    id: "testing_qa",
    category: "testing",
    label: "QA Testing & Test Automation",
    description: "Test plans, manual testing, unit/integration/e2e test suites",
    tags: ["qa", "testing"],
    effort: {
      low: { designer: 0, frontend: 8, backend: 8, mobile: 8, pm: 4, qa: 24 },
      medium: { designer: 0, frontend: 16, backend: 16, mobile: 16, pm: 8, qa: 40 },
      high: { designer: 0, frontend: 24, backend: 24, mobile: 24, pm: 16, qa: 80 },
    },
  },
];

// ─── Category meta ────────────────────────────────────────────────────────────
export const CATEGORY_META: Record<FeatureCategory, { label: string; icon: string }> = {
  discovery: { label: "Discovery & Planning", icon: "search" },
  design: { label: "UI/UX Design", icon: "palette" },
  frontend: { label: "Frontend / Web", icon: "monitor" },
  backend: { label: "Backend / API", icon: "server" },
  mobile: { label: "Mobile App", icon: "smartphone" },
  ecommerce: { label: "E-Commerce", icon: "shopping-cart" },
  integration: { label: "Integrations & Real-Time", icon: "plug" },
  devops: { label: "DevOps & Infrastructure", icon: "cloud" },
  testing: { label: "QA & Testing", icon: "flask" },
  cms: { label: "CMS / Portals", icon: "newspaper" },
  social: { label: "Social Media Design", icon: "megaphone" },
};

// ─── Role keys and labels ─────────────────────────────────────────────────────
export const ROLE_KEYS = ["designer", "frontend", "backend", "mobile", "pm", "qa"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, { label: string; short: string; color: string }> = {
  designer: { label: "Design", short: "Design", color: "bg-primary" },
  frontend: { label: "Frontend Dev", short: "Frontend", color: "bg-primary" },
  backend: { label: "Backend Dev", short: "Backend", color: "bg-warning/10" },
  mobile: { label: "Mobile Dev", short: "Mobile", color: "bg-primary" },
  pm: { label: "Project Mgmt", short: "PM", color: "bg-primary" },
  qa: { label: "QA / Testing", short: "QA", color: "bg-destructive/10" },
};
