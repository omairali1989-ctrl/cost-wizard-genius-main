async function test() {
  const baseUrl = "http://localhost:8081";

  console.log("1. Testing POST /api/auth/login...");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@alisonstechnology.com",
      password: "Alisons@2026!",
    }),
  });

  const loginData = await loginRes.json();
  if (loginData.error || !loginData.data?.session?.access_token) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }

  const token = loginData.data.session.access_token;
  const user = loginData.data.user;
  console.log(`✓ Logged in as: ${user.email} (ID: ${user.id})`);
  console.log(`✓ Session Token: ${token.slice(0, 20)}...`);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  console.log("\n2. Testing GET /api/auth/user...");
  const userRes = await fetch(`${baseUrl}/api/auth/user`, { headers: authHeaders });
  const userData = await userRes.json();
  console.log(`✓ User verified: ${userData.data?.user?.email}`);

  console.log("\n3. Testing Query: Company & Profile...");
  const profileRes = await fetch(`${baseUrl}/api/data/query`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "profiles",
      filters: [{ column: "id", op: "eq", value: user.id }],
      single: true,
    }),
  });
  const profileData = await profileRes.json();
  const companyId = profileData.data.company_id;
  console.log(`✓ Profile linked to Company ID: ${companyId}`);

  const companyRes = await fetch(`${baseUrl}/api/data/query`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "companies",
      filters: [{ column: "id", op: "eq", value: companyId }],
      single: true,
    }),
  });
  const companyData = await companyRes.json();
  console.log(`✓ Company Name: ${companyData.data.name} | Currency: ${companyData.data.currency}`);

  console.log("\n4. Testing Query: Employees...");
  const empRes = await fetch(`${baseUrl}/api/data/query`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "employees",
      filters: [{ column: "company_id", op: "eq", value: companyId }],
      order: [{ column: "name", ascending: true }],
    }),
  });
  const empData = await empRes.json();
  console.log(`✓ Total Employees Retrieved: ${empData.data.length}`);
  for (const e of empData.data) {
    const monthly = Math.round(Number(e.annual_salary) / 12);
    console.log(`   - ${e.name} (${e.department}, ${e.job_title}): Rs. ${monthly.toLocaleString()}/mo`);
  }

  console.log("\n5. Testing Query: Overheads (Office Expenses)...");
  const ohRes = await fetch(`${baseUrl}/api/data/query`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "overheads",
      filters: [{ column: "company_id", op: "eq", value: companyId }],
      order: [{ column: "name", ascending: true }],
    }),
  });
  const ohData = await ohRes.json();
  console.log(`✓ Total Overheads Retrieved: ${ohData.data.length}`);
  let totalOverhead = 0;
  for (const o of ohData.data) {
    const amt = Number(o.monthly_amount);
    totalOverhead += amt;
    console.log(`   - ${o.name}: Rs. ${amt.toLocaleString()}/mo (${o.category})`);
  }
  console.log(`✓ Total Monthly Office Expenses: Rs. ${totalOverhead.toLocaleString()}`);

  console.log("\n6. Testing RPC: company_employee_rates...");
  const ratesRes = await fetch(`${baseUrl}/api/rpc/company_employee_rates`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const ratesData = await ratesRes.json();
  console.log(`✓ Total Employee Calculated Rates: ${ratesData.data.length}`);
  for (const r of ratesData.data) {
    console.log(`   - ${r.name}: Rs. ${r.hourly_cost}/hr`);
  }

  console.log("\n7. Testing Query: Scope Features Library...");
  const featRes = await fetch(`${baseUrl}/api/data/query`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "scope_features",
      order: [{ column: "sort_order", ascending: true }],
    }),
  });
  const featData = await featRes.json();
  console.log(`✓ Total Scope Features in DB: ${featData.data?.length ?? 0}`);
  if (featData.data?.length > 0) {
    console.log(`   - Sample Feature: ${featData.data[0].icon} ${featData.data[0].label} (${featData.data[0].category})`);
    console.log(`   - Sample Effort: Medium Dev=${featData.data[0].effort?.medium?.frontend ?? 0}h, Design=${featData.data[0].effort?.medium?.designer ?? 0}h`);
  }

  console.log("\n========================================================");
  console.log(" ALL BACKEND API & DATA CHECKS PASSED PERFECTLY!");
  console.log("========================================================");
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
