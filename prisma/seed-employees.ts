import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Additive employee seed — upserts by employeeCode without wiping the requires org roles seeded first. */
const STAFF = [
  {
    code: "EMP-009",
    name: "Rashid Khan",
    cnic: "35202-9090909-9",
    roleCode: "COOK",
    dept: "Mess",
    salary: 32000,
  },
  {
    code: "EMP-010",
    name: "Zainab Ali",
    cnic: "35202-1010101-0",
    roleCode: "COMPUTER_OPERATOR",
    dept: "Admin",
    salary: 45000,
  },
  {
    code: "EMP-011",
    name: "Kamran Shah",
    cnic: "35202-1111112-1",
    roleCode: "DRIVER",
    dept: "Transport",
    salary: 38000,
  },
  {
    code: "EMP-012",
    name: "Hassan Mali",
    cnic: "35202-1212121-2",
    roleCode: "MALI",
    dept: "Horticulture",
    salary: 28000,
  },
  {
    code: "EMP-013",
    name: "Ali Ahmad",
    cnic: "35202-1313131-3",
    roleCode: "SWEEPER",
    dept: "Sanitation",
    salary: 26000,
  },
];

async function main() {
  console.log("Upserting operational staff…");

  const roles = await prisma.orgRole.findMany();
  if (roles.length === 0) {
    console.error("No org roles found — run: npx tsx prisma/seed-org-roles.ts");
    process.exit(1);
  }
  const roleByCode = new Map(roles.map((r) => [r.code, r.id]));

  for (const e of STAFF) {
    const orgRoleId = roleByCode.get(e.roleCode);
    if (!orgRoleId) {
      console.warn(`  Skipping ${e.code} — role ${e.roleCode} not found`);
      continue;
    }

    const employee = await prisma.employee.upsert({
      where: { employeeCode: e.code },
      update: {
        name: e.name,
        orgRoleId,
        department: e.dept,
        salary: e.salary,
        status: "ACTIVE",
      },
      create: {
        employeeCode: e.code,
        name: e.name,
        cnic: e.cnic,
        contact: "0300-1234567",
        orgRoleId,
        employmentType: "STAFF",
        department: e.dept,
        joiningDate: new Date("2021-06-01"),
        salary: e.salary,
        status: "ACTIVE",
      },
    });
    console.log(`  ${employee.employeeCode} — ${employee.name}`);
  }

  await prisma.numberSequence.upsert({
    where: { key: "employee" },
    update: { nextValue: 15 },
    create: { key: "employee", prefix: "EMP", nextValue: 15, padLength: 3 },
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
