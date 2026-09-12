import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { FEATURE_LIBRARY } from "../src/components/scope-engine/featureLibrary";

async function main() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const dbName = process.env.MYSQL_DATABASE || "alisons_costcraft";

  console.log(`Connecting to MySQL on ${host}:${port} as ${user}...`);

  // 1. Connect without database to ensure DB exists
  const initialConnection = await mysql.createConnection({ host, port, user, password });
  await initialConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await initialConnection.end();

  console.log(`Database "${dbName}" verified.`);

  // 2. Connect to the database
  const connection = await mysql.createConnection({ host, port, user, password, database: dbName });

  // 3. Create tables
  console.log("Creating tables...");

  await connection.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(255),
      currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      raw_user_meta_data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_expires (expires_at)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36),
      full_name VARCHAR(255),
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_profiles_company (company_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      company_id VARCHAR(36) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_company_role (user_id, company_id, role),
      INDEX idx_roles_company (company_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS cost_policies (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL UNIQUE,
      working_days_per_year DECIMAL(10, 2) NOT NULL DEFAULT 240,
      hours_per_day DECIMAL(10, 2) NOT NULL DEFAULT 8,
      default_utilization_pct DECIMAL(10, 2) NOT NULL DEFAULT 75,
      default_contingency_pct DECIMAL(10, 2) NOT NULL DEFAULT 10,
      default_margin_pct DECIMAL(10, 2) NOT NULL DEFAULT 25,
      pricing_mode VARCHAR(20) NOT NULL DEFAULT 'margin',
      default_markup_pct DECIMAL(10, 2) NOT NULL DEFAULT 35,
      rounding_step DECIMAL(10, 2) NOT NULL DEFAULT 100,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      job_title VARCHAR(255),
      department VARCHAR(255),
      seniority VARCHAR(50),
      monthly_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
      annual_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
      salary_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      employer_cost_pct DECIMAL(5, 2) NOT NULL DEFAULT 20,
      billable_target_pct DECIMAL(5, 2) NOT NULL DEFAULT 75,
      skills JSON,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_employees_company (company_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS overheads (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      monthly_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
      period ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',
      allocation_basis VARCHAR(50) NOT NULL DEFAULT 'per_employee',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_overheads_company (company_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255),
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_projects_company (company_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS calculations (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      project_id VARCHAR(36),
      label VARCHAR(255) NOT NULL DEFAULT 'Version 1',
      version INT NOT NULL DEFAULT 1,
      inputs JSON,
      results JSON,
      is_snapshot BOOLEAN NOT NULL DEFAULT true,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_calcs_company (company_id),
      INDEX idx_calcs_project (project_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36),
      action VARCHAR(100) NOT NULL,
      entity VARCHAR(100) NOT NULL,
      entity_id VARCHAR(36),
      details JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_company (company_id)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS invitations (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      invited_by VARCHAR(36),
      expires_at TIMESTAMP NULL,
      responded_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_invitations_comp_email (company_id, email)
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS scope_features (
      id VARCHAR(64) PRIMARY KEY,
      company_id VARCHAR(36) NULL,
      category VARCHAR(50) NOT NULL,
      label VARCHAR(255) NOT NULL,
      description TEXT,
      effort JSON NOT NULL,
      icon VARCHAR(20) DEFAULT '⚡',
      tags JSON,
      sort_order INT NOT NULL DEFAULT 0,
      is_custom BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_features_cat (category),
      INDEX idx_features_comp (company_id)
    );
  `);

  console.log("All tables created or verified.");

  // Seed scope_features
  console.log(`Seeding scope_features library (${FEATURE_LIBRARY.length} items)...`);
  for (let i = 0; i < FEATURE_LIBRARY.length; i++) {
    const feat = FEATURE_LIBRARY[i];
    await connection.query(
      `INSERT INTO scope_features (id, company_id, category, label, description, effort, icon, tags, sort_order, is_custom)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, false)
       ON DUPLICATE KEY UPDATE
         category = VALUES(category),
         label = VALUES(label),
         description = VALUES(description),
         effort = VALUES(effort),
         icon = VALUES(icon),
         tags = VALUES(tags),
         sort_order = VALUES(sort_order)`,
      [
        feat.id,
        feat.category,
        feat.label,
        feat.description,
        JSON.stringify(feat.effort),
        feat.icon,
        JSON.stringify(feat.tags),
        i,
      ]
    );
  }
  console.log("Scope features seeded successfully.");

  // 4. Seed Alisons Technology Company
  const companyId = crypto.randomUUID();
  const companyName = "Alisons Technology";
  const currency = "PKR";
  const industry = "Software Development & Technology Services";

  // Check if company already exists
  const [existingCompanies] = await connection.query<any[]>(
    "SELECT id FROM companies WHERE name = ?",
    [companyName]
  );

  let targetCompanyId = companyId;
  if (existingCompanies.length > 0) {
    targetCompanyId = existingCompanies[0].id;
    console.log(`Company "${companyName}" already exists (ID: ${targetCompanyId}). Updating details...`);
    await connection.query("UPDATE companies SET currency = ?, industry = ? WHERE id = ?", [
      currency,
      industry,
      targetCompanyId,
    ]);
  } else {
    console.log(`Creating company "${companyName}" (ID: ${targetCompanyId})...`);
    await connection.query(
      "INSERT INTO companies (id, name, industry, currency) VALUES (?, ?, ?, ?)",
      [targetCompanyId, companyName, industry, currency]
    );
  }

  // 5. Seed Cost Policy for Alisons Technology
  const [existingPolicies] = await connection.query<any[]>(
    "SELECT id FROM cost_policies WHERE company_id = ?",
    [targetCompanyId]
  );
  if (existingPolicies.length === 0) {
    console.log("Creating default cost policy for Alisons Technology...");
    await connection.query(
      `INSERT INTO cost_policies 
       (id, company_id, working_days_per_year, hours_per_day, default_utilization_pct, default_contingency_pct, default_margin_pct, pricing_mode, default_markup_pct, rounding_step)
       VALUES (?, ?, 240, 8, 75, 10, 25, 'margin', 35, 100)`,
      [crypto.randomUUID(), targetCompanyId]
    );
  }

  // 6. Seed Admin User Credentials
  const adminEmail = "admin@alisonstechnology.com";
  const adminPasswordPlain = "Alisons@2026!";
  const adminFullName = "Alisons Admin";
  const passwordHash = await bcrypt.hash(adminPasswordPlain, 10);

  const [existingUsers] = await connection.query<any[]>(
    "SELECT id FROM auth_users WHERE email = ?",
    [adminEmail]
  );

  let adminUserId = crypto.randomUUID();
  if (existingUsers.length > 0) {
    adminUserId = existingUsers[0].id;
    console.log(`Admin user "${adminEmail}" already exists. Updating password and profile...`);
    await connection.query(
      "UPDATE auth_users SET password_hash = ?, raw_user_meta_data = ? WHERE id = ?",
      [passwordHash, JSON.stringify({ full_name: adminFullName }), adminUserId]
    );
  } else {
    console.log(`Creating admin user "${adminEmail}"...`);
    await connection.query(
      "INSERT INTO auth_users (id, email, password_hash, raw_user_meta_data) VALUES (?, ?, ?, ?)",
      [adminUserId, adminEmail, passwordHash, JSON.stringify({ full_name: adminFullName })]
    );
  }

  // Profile
  await connection.query(
    `INSERT INTO profiles (id, company_id, full_name, email) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE company_id = VALUES(company_id), full_name = VALUES(full_name), email = VALUES(email)`,
    [adminUserId, targetCompanyId, adminFullName, adminEmail]
  );

  // User Role (admin)
  await connection.query(
    `INSERT INTO user_roles (id, user_id, company_id, role) VALUES (?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE role = 'admin'`,
    [crypto.randomUUID(), adminUserId, targetCompanyId]
  );

  // 7. Seed Employees from July 2026 Payslip & Organizational Hierarchy
  console.log("Seeding employees & leadership for Alisons Technology...");
  const employeesData = [
    // Executive Leadership & Directors (2 Directors)
    {
      name: "Omair",
      department: "Management",
      job_title: "Director & Technology Strategist",
      seniority: "Director",
      monthly_salary: 400000,
      billable_target_pct: 25,
      skills: ["Technology Strategy", "Enterprise Architecture", "Executive Leadership", "Client Relations"],
    },
    {
      name: "Khurram",
      department: "Management",
      job_title: "Director & Operations",
      seniority: "Director",
      monthly_salary: 400000,
      billable_target_pct: 25,
      skills: ["Business Strategy", "Operations", "Governance", "Client Partnerships"],
    },
    // Management & Sales
    {
      name: "Syed Sultan Raza Shah",
      department: "Management",
      job_title: "Project Manager",
      seniority: "Lead",
      monthly_salary: 100000,
      billable_target_pct: 80,
      skills: ["Project Management", "Agile / Scrum", "Sprint Planning", "Client Communication", "Delivery"],
    },
    {
      name: "Ayesha badar",
      department: "Sales",
      job_title: "Sales Executive & Client Acquisition",
      seniority: "Manager",
      monthly_salary: 35000,
      billable_target_pct: 20,
      skills: ["Sales", "Business Development", "Client Pitching", "Lead Generation"],
    },
    // Production Leadership
    {
      name: "Muhammad Yousuf",
      department: "Production",
      job_title: "Team Lead & Principal Architect",
      seniority: "Lead",
      monthly_salary: 121936,
      billable_target_pct: 80,
      skills: ["Team Leadership", "System Architecture", "DevOps", "Code Quality", "Fullstack"],
    },
    // Design Team
    {
      name: "Faiza Jamal",
      department: "Design",
      job_title: "Design Lead",
      seniority: "Lead",
      monthly_salary: 46775,
      billable_target_pct: 80,
      skills: ["UI/UX Leadership", "Design Systems", "Figma", "User Research", "Interaction Design"],
    },
    {
      name: "Yousuf Ansari",
      department: "Design",
      job_title: "UI/UX Designer",
      seniority: "Mid-level",
      monthly_salary: 27000,
      billable_target_pct: 85,
      skills: ["UI/UX Design", "Figma", "Wireframing", "Visual Design", "Prototyping"],
    },
    // Engineering Specialists
    {
      name: "Hassnain Yaqoob",
      department: "Production",
      job_title: "MERN Stack Developer",
      seniority: "Senior",
      monthly_salary: 78388,
      billable_target_pct: 85,
      skills: ["React", "Node.js", "Express", "MongoDB", "TypeScript", "Next.js"],
    },
    {
      name: "Osama khan",
      department: "Production",
      job_title: "Laravel Developer",
      seniority: "Senior",
      monthly_salary: 60000,
      billable_target_pct: 85,
      skills: ["PHP", "Laravel", "MySQL", "REST APIs", "Backend Architecture"],
    },
    {
      name: "Mubashir shakeel",
      department: "Production",
      job_title: "Mobile App Developer",
      seniority: "Mid-level",
      monthly_salary: 40000,
      billable_target_pct: 85,
      skills: ["Flutter", "React Native", "iOS", "Android", "Mobile UI"],
    },
    {
      name: "Syed Minhaj Albeez",
      department: "Production",
      job_title: "Software Engineer",
      seniority: "Mid-level",
      monthly_salary: 33871,
      billable_target_pct: 85,
      skills: ["Backend", "Node.js", "APIs", "Database Design"],
    },
    // Junior Developers & QA
    {
      name: "Kamran faiz",
      department: "Production",
      job_title: "Junior Developer / QA",
      seniority: "Junior",
      monthly_salary: 20000,
      billable_target_pct: 90,
      skills: ["QA Testing", "Frontend", "Regression Testing", "Bug Reporting"],
    },
    {
      name: "Abdur Rehman",
      department: "Production",
      job_title: "Junior Backend Developer",
      seniority: "Junior",
      monthly_salary: 20000,
      billable_target_pct: 90,
      skills: ["Backend", "Database", "Python", "Node.js"],
    },
    {
      name: "Kanza Batool",
      department: "Production",
      job_title: "Junior Frontend Developer",
      seniority: "Junior",
      monthly_salary: 20000,
      billable_target_pct: 90,
      skills: ["Frontend", "HTML/CSS", "React", "Web Styling"],
    },
  ];

  for (const emp of employeesData) {
    const annualSalary = emp.monthly_salary * 12;
    const [existing] = await connection.query<any[]>(
      "SELECT id FROM employees WHERE company_id = ? AND name = ?",
      [targetCompanyId, emp.name]
    );

    const billableTarget = emp.billable_target_pct || 75;

    if (existing.length > 0) {
      await connection.query(
        `UPDATE employees SET 
          department = ?, job_title = ?, seniority = ?, 
          annual_salary = ?, billable_target_pct = ?, skills = ?, active = true 
         WHERE id = ?`,
        [emp.department, emp.job_title, emp.seniority, annualSalary, billableTarget, JSON.stringify(emp.skills), existing[0].id]
      );
      console.log(`  Updated employee: ${emp.name} - ${emp.job_title} (Monthly: Rs. ${emp.monthly_salary.toLocaleString()} | Annual: Rs. ${annualSalary.toLocaleString()})`);
    } else {
      await connection.query(
        `INSERT INTO employees 
          (id, company_id, name, department, job_title, seniority, annual_salary, employer_cost_pct, billable_target_pct, skills, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 20, ?, ?, true)`,
        [crypto.randomUUID(), targetCompanyId, emp.name, emp.department, emp.job_title, emp.seniority, annualSalary, billableTarget, JSON.stringify(emp.skills)]
      );
      console.log(`  Inserted employee: ${emp.name} - ${emp.job_title} (Monthly: Rs. ${emp.monthly_salary.toLocaleString()} | Annual: Rs. ${annualSalary.toLocaleString()})`);
    }
  }

  // 8. Seed Office Expenses & Subscriptions
  console.log("Seeding office expenses & subscriptions as monthly overheads...");
  const officeExpenses = [
    { name: "Office Rent", category: "facilities", monthly_amount: 143000 },
    { name: "Office Electric bill", category: "utilities", monthly_amount: 103280 },
    { name: "Peon", category: "office_support", monthly_amount: 32000 },
    { name: "Office 365 ($1,124/yr)", category: "software", monthly_amount: 26227 },
    { name: "Server Cost ($748/yr)", category: "infrastructure", monthly_amount: 17453 },
    { name: "Office Bill internet (PTCL + Strom fiber)", category: "connectivity", monthly_amount: 17969 },
    { name: "Office exp", category: "general", monthly_amount: 15000 },
    { name: "Office Guard", category: "security", monthly_amount: 9000 },
  ];

  for (const exp of officeExpenses) {
    const [existing] = await connection.query<any[]>(
      "SELECT id FROM overheads WHERE company_id = ? AND name = ?",
      [targetCompanyId, exp.name]
    );

    if (existing.length > 0) {
      await connection.query(
        "UPDATE overheads SET category = ?, monthly_amount = ?, allocation_basis = 'per_employee' WHERE id = ?",
        [exp.category, exp.monthly_amount, existing[0].id]
      );
      console.log(`  Updated overhead: ${exp.name} (Monthly: Rs. ${exp.monthly_amount.toLocaleString()})`);
    } else {
      await connection.query(
        `INSERT INTO overheads (id, company_id, name, category, monthly_amount, allocation_basis)
         VALUES (?, ?, ?, ?, ?, 'per_employee')`,
        [crypto.randomUUID(), targetCompanyId, exp.name, exp.category, exp.monthly_amount]
      );
      console.log(`  Inserted overhead: ${exp.name} (Monthly: Rs. ${exp.monthly_amount.toLocaleString()})`);
    }
  }

  console.log("\n========================================================");
  console.log("🎉 SUCCESS! MySQL Database & Alisons Technology seeded.");
  console.log("========================================================");
  console.log(`Company: Alisons Technology`);
  console.log(`Currency: PKR (₨)`);
  console.log(`Employees Seeded: ${employeesData.length}`);
  console.log(`Office Overheads Seeded: ${officeExpenses.length}`);
  console.log(`Monthly Total Overhead: Rs. ${officeExpenses.reduce((s, o) => s + o.monthly_amount, 0).toLocaleString()}`);
  console.log("--------------------------------------------------------");
  console.log("LOGIN CREDENTIALS:");
  console.log(`Email:    ${adminEmail}`);
  console.log(`Password: ${adminPasswordPlain}`);
  console.log("========================================================\n");

  await connection.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
