import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type OrgRoleSeed = {
  code: string;
  name: string;
  category: "PANEL" | "MANAGEMENT" | "OPERATIONAL" | "TECHNICAL" | "CONTRACTOR" | "OTHER";
  sortOrder: number;
  description?: string;
};

const SYSTEM_ORG_ROLES: OrgRoleSeed[] = [
  // Panel
  { code: "PRESIDENT", name: "President", category: "PANEL", sortOrder: 10, description: "Society panel president" },
  { code: "SECRETARY", name: "Secretary", category: "PANEL", sortOrder: 20, description: "Society panel secretary" },
  {
    code: "EXECUTIVE_MEMBER",
    name: "Executive Member",
    category: "PANEL",
    sortOrder: 30,
    description: "Panel executive member",
  },
  { code: "KHAZANCHI", name: "Khazanchi / Finance", category: "PANEL", sortOrder: 40, description: "Treasurer / finance panel member" },
  // Management
  { code: "GM", name: "General Manager", category: "MANAGEMENT", sortOrder: 50 },
  { code: "ADMIN", name: "Admin", category: "MANAGEMENT", sortOrder: 55, description: "Society administrator (non super-admin)" },
  { code: "TRANSFER_OFFICER", name: "Transfer Officer", category: "MANAGEMENT", sortOrder: 60 },
  {
    code: "ASSOCIATE_TRANSFER_OFFICER",
    name: "Associate Transfer Officer",
    category: "MANAGEMENT",
    sortOrder: 70,
  },
  { code: "RECORD_KEEPER", name: "Record Keeper", category: "MANAGEMENT", sortOrder: 80 },
  // Technical
  { code: "BUILDING_INSPECTOR", name: "Building Inspector", category: "TECHNICAL", sortOrder: 90 },
  { code: "ARCHITECT", name: "Architect", category: "TECHNICAL", sortOrder: 100 },
  { code: "SUPERVISOR", name: "Supervisor", category: "TECHNICAL", sortOrder: 110 },
  { code: "ELECTRICIAN", name: "Electrician", category: "TECHNICAL", sortOrder: 120 },
  { code: "PLUMBER", name: "Plumber", category: "TECHNICAL", sortOrder: 130 },
  // Operational
  { code: "COOK", name: "Cook", category: "OPERATIONAL", sortOrder: 200 },
  { code: "DRIVER", name: "Driver", category: "OPERATIONAL", sortOrder: 210 },
  { code: "COMPUTER_OPERATOR", name: "Computer Operator", category: "OPERATIONAL", sortOrder: 220 },
  { code: "MALI", name: "Mali (Gardener)", category: "OPERATIONAL", sortOrder: 230 },
  { code: "SWEEPER", name: "Sweeper", category: "OPERATIONAL", sortOrder: 240 },
  { code: "MESS", name: "Mess Staff", category: "OPERATIONAL", sortOrder: 250 },
  { code: "SECURITY_GUARD", name: "Security Guard", category: "OPERATIONAL", sortOrder: 260 },
  { code: "TRACTOR_DRIVER", name: "Tractor Driver", category: "OPERATIONAL", sortOrder: 270 },
  // Contractor trades (org roles for contractor job titles)
  {
    code: "CONTRACTOR_ELECTRICAL",
    name: "Electrical Contractor",
    category: "CONTRACTOR",
    sortOrder: 300,
    description: "External electrical works contractor",
  },
  {
    code: "CONTRACTOR_MAINTENANCE",
    name: "Maintenance Contractor",
    category: "CONTRACTOR",
    sortOrder: 310,
    description: "General maintenance contractor",
  },
  { code: "OTHER", name: "Other", category: "OTHER", sortOrder: 999 },
];

/** Map legacy Designation enum → OrgRole code */
const DESIGNATION_MAP: Record<string, string> = {
  PRESIDENT: "PRESIDENT",
  SECRETARY: "SECRETARY",
  GM: "GM",
  TRANSFER_OFFICER: "TRANSFER_OFFICER",
  ASSOCIATE_TRANSFER_OFFICER: "ASSOCIATE_TRANSFER_OFFICER",
  RECORD_MANAGER: "RECORD_KEEPER",
  FINANCE: "KHAZANCHI",
  COOK: "COOK",
  DRIVER: "DRIVER",
  COMPUTER_OPERATOR: "COMPUTER_OPERATOR",
  ELECTRICIAN: "ELECTRICIAN",
  PLUMBER: "PLUMBER",
  MALI: "MALI",
  SWEEPER: "SWEEPER",
  MESS: "MESS",
  SECURITY_GUARD: "SECURITY_GUARD",
  TRACTOR_DRIVER: "TRACTOR_DRIVER",
  OTHER: "OTHER",
};

async function main() {
  console.log("Seeding org roles…");

  for (const role of SYSTEM_ORG_ROLES) {
    await prisma.orgRole.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        category: role.category,
        description: role.description,
        sortOrder: role.sortOrder,
        isSystem: true,
        isActive: true,
      },
      create: {
        code: role.code,
        name: role.name,
        category: role.category,
        description: role.description,
        sortOrder: role.sortOrder,
        isSystem: true,
        isActive: true,
      },
    });
    console.log(`  ${role.code} — ${role.name}`);
  }

  // Backfill orgRoleId from designation for existing employees
  const roles = await prisma.orgRole.findMany();
  const roleByCode = new Map(roles.map((r) => [r.code, r.id]));

  const employees = await prisma.employee.findMany({
    where: { orgRoleId: null, designation: { not: null } },
  });

  for (const emp of employees) {
    if (!emp.designation) continue;
    const code = DESIGNATION_MAP[emp.designation];
    const orgRoleId = code ? roleByCode.get(code) : roleByCode.get("OTHER");
    if (orgRoleId) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { orgRoleId },
      });
      console.log(`  Linked ${emp.employeeCode} → ${code}`);
    }
  }

  // Set supervisor hierarchy for sample staff if not already set
  const gm = await prisma.employee.findFirst({
    where: { orgRole: { code: "GM" } },
  });
  const supervisor = await prisma.employee.findFirst({
    where: { orgRole: { code: "SUPERVISOR" } },
  });

  if (gm) {
    const mali = await prisma.employee.findFirst({ where: { orgRole: { code: "MALI" } } });
    const sweeper = await prisma.employee.findFirst({ where: { orgRole: { code: "SWEEPER" } } });

    if (supervisor && !supervisor.supervisorId) {
      await prisma.employee.update({
        where: { id: supervisor.id },
        data: { supervisorId: gm.id },
      });
      console.log(`  Supervisor reports to GM`);
    }

    const reportsToSupervisor = [mali, sweeper].filter(Boolean);
    for (const emp of reportsToSupervisor) {
      if (emp && !emp.supervisorId && supervisor) {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { supervisorId: supervisor.id },
        });
        console.log(`  ${emp.employeeCode} reports to Supervisor`);
      }
    }
  }

  // Seed panel president if missing
  const presidentRole = roleByCode.get("PRESIDENT");
  if (presidentRole) {
    await prisma.employee.upsert({
      where: { employeeCode: "EMP-P01" },
      update: {},
      create: {
        employeeCode: "EMP-P01",
        name: "Dr. Khalid Mehmood",
        cnic: "35202-0000001-1",
        contact: "0300-0000001",
        orgRoleId: presidentRole,
        employmentType: "PANEL_MEMBER",
        department: "Panel",
        joiningDate: new Date("2019-01-01"),
        status: "ACTIVE",
      },
    });
  }

  // Seed supervisor if missing
  const supervisorRole = roleByCode.get("SUPERVISOR");
  if (supervisorRole && gm) {
    await prisma.employee.upsert({
      where: { employeeCode: "EMP-014" },
      update: { orgRoleId: supervisorRole, supervisorId: gm.id },
      create: {
        employeeCode: "EMP-014",
        name: "Javed Akhtar",
        cnic: "35202-1414141-4",
        contact: "0300-1414141",
        orgRoleId: supervisorRole,
        supervisorId: gm.id,
        employmentType: "STAFF",
        department: "Works",
        joiningDate: new Date("2018-03-01"),
        salary: 55000,
        status: "ACTIVE",
      },
    });
  }

  // Seed contractors
  const elecRole = roleByCode.get("CONTRACTOR_ELECTRICAL");
  const maintRole = roleByCode.get("CONTRACTOR_MAINTENANCE");

  if (elecRole) {
    await prisma.employee.upsert({
      where: { employeeCode: "CTR-001" },
      update: {},
      create: {
        employeeCode: "CTR-001",
        name: "PowerLine Electrical Services",
        cnic: "35202-9900001-1",
        contact: "0300-9900001",
        orgRoleId: elecRole,
        employmentType: "CONTRACTOR",
        contractorTrade: "ELECTRICAL",
        companyName: "PowerLine Electrical Services",
        contractStart: new Date("2025-01-01"),
        contractEnd: new Date("2026-12-31"),
        department: "Works",
        joiningDate: new Date("2025-01-01"),
        status: "ACTIVE",
        remarks: "Society electrical maintenance contract",
      },
    });
  }

  if (maintRole) {
    await prisma.employee.upsert({
      where: { employeeCode: "CTR-002" },
      update: {},
      create: {
        employeeCode: "CTR-002",
        name: "GreenBuild Maintenance Co.",
        cnic: "35202-9900002-2",
        contact: "0300-9900002",
        orgRoleId: maintRole,
        employmentType: "CONTRACTOR",
        contractorTrade: "MAINTENANCE",
        companyName: "GreenBuild Maintenance Co.",
        contractStart: new Date("2025-06-01"),
        contractEnd: new Date("2026-05-31"),
        department: "Works",
        joiningDate: new Date("2025-06-01"),
        status: "ACTIVE",
        remarks: "General society maintenance contractor",
      },
    });
  }

  console.log("Org roles seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
