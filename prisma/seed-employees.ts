import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Additive employee seed — upserts by employeeCode without wiping the database. */
const STAFF = [
  {
    code: "EMP-009",
    name: "Rashid Khan",
    cnic: "35202-9090909-9",
    designation: "COOK" as const,
    dept: "Mess",
    salary: 32000,
  },
  {
    code: "EMP-010",
    name: "Zainab Ali",
    cnic: "35202-1010101-0",
    designation: "COMPUTER_OPERATOR" as const,
    dept: "Admin",
    salary: 45000,
  },
  {
    code: "EMP-011",
    name: "Kamran Shah",
    cnic: "35202-1111112-1",
    designation: "DRIVER" as const,
    dept: "Transport",
    salary: 38000,
  },
  {
    code: "EMP-012",
    name: "Hassan Mali",
    cnic: "35202-1212121-2",
    designation: "MALI" as const,
    dept: "Horticulture",
    salary: 28000,
  },
  {
    code: "EMP-013",
    name: "Ali Ahmad",
    cnic: "35202-1313131-3",
    designation: "SWEEPER" as const,
    dept: "Sanitation",
    salary: 26000,
  },
];

async function main() {
  console.log("Upserting operational staff…");

  for (const e of STAFF) {
    const employee = await prisma.employee.upsert({
      where: { employeeCode: e.code },
      update: {
        name: e.name,
        designation: e.designation,
        department: e.dept,
        salary: e.salary,
        status: "ACTIVE",
      },
      create: {
        employeeCode: e.code,
        name: e.name,
        cnic: e.cnic,
        contact: "0300-1234567",
        designation: e.designation,
        department: e.dept,
        joiningDate: new Date("2021-06-01"),
        salary: e.salary,
        status: "ACTIVE",
      },
    });
    console.log(`  ${employee.employeeCode} — ${employee.name} (${employee.designation})`);
  }

  await prisma.numberSequence.upsert({
    where: { key: "employee" },
    update: { nextValue: 14 },
    create: { key: "employee", prefix: "EMP", nextValue: 14, padLength: 3 },
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
