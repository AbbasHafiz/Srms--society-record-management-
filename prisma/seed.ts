import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedFinance } from "./seed-finance";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Society Records…");

  await prisma.auditLog.deleteMany();
  await prisma.garbageCollection.deleteMany();
  await prisma.tankerDelivery.deleteMany();
  await prisma.tankerTimeSlot.deleteMany();
  await prisma.waterTanker.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.vehicleUsage.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.guardShift.deleteMany();
  await prisma.plotStaffAssignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.fileMovement.deleteMany();
  await prisma.physicalFile.deleteMany();
  await prisma.fileLocation.deleteMany();
  await prisma.openFileRenewal.deleteMany();
  await prisma.document.deleteMany();
  await prisma.financeTransaction.deleteMany();
  await prisma.financeCategory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.plotCharge.deleteMany();
  await prisma.openFile.deleteMany();
  await prisma.mortgage.deleteMany();
  await prisma.nec.deleteMany();
  await prisma.noc.deleteMany();
  await prisma.possession.deleteMany();
  await prisma.propertySizeOption.deleteMany();
  // Break ownership↔transfer FKs carefully
  await prisma.transferHeir.deleteMany();
  await prisma.ownership.updateMany({ data: { transferInId: null, transferOutId: null } });
  await prisma.transfer.deleteMany();
  await prisma.ownership.deleteMany();
  await prisma.plot.deleteMany();
  await prisma.feeConfiguration.deleteMany();
  await prisma.numberSequence.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.salaryPayment.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.orgRole.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const ORG_ROLES = [
    { code: "PRESIDENT", name: "President", category: "PANEL" as const, sortOrder: 10 },
    { code: "SECRETARY", name: "Secretary", category: "PANEL" as const, sortOrder: 20 },
    { code: "EXECUTIVE_MEMBER", name: "Executive Member", category: "PANEL" as const, sortOrder: 30 },
    { code: "KHAZANCHI", name: "Khazanchi / Finance", category: "PANEL" as const, sortOrder: 40 },
    { code: "GM", name: "General Manager", category: "MANAGEMENT" as const, sortOrder: 50 },
    { code: "TRANSFER_OFFICER", name: "Transfer Officer", category: "MANAGEMENT" as const, sortOrder: 60 },
    { code: "ASSOCIATE_TRANSFER_OFFICER", name: "Associate Transfer Officer", category: "MANAGEMENT" as const, sortOrder: 70 },
    { code: "RECORD_KEEPER", name: "Record Keeper", category: "MANAGEMENT" as const, sortOrder: 80 },
    { code: "SUPERVISOR", name: "Supervisor", category: "TECHNICAL" as const, sortOrder: 110 },
    { code: "COOK", name: "Cook", category: "OPERATIONAL" as const, sortOrder: 200 },
    { code: "DRIVER", name: "Driver", category: "OPERATIONAL" as const, sortOrder: 210 },
    { code: "COMPUTER_OPERATOR", name: "Computer Operator", category: "OPERATIONAL" as const, sortOrder: 220 },
    { code: "MALI", name: "Mali (Gardener)", category: "OPERATIONAL" as const, sortOrder: 230 },
    { code: "SWEEPER", name: "Sweeper", category: "OPERATIONAL" as const, sortOrder: 240 },
    { code: "SECURITY_GUARD", name: "Security Guard", category: "OPERATIONAL" as const, sortOrder: 260 },
    { code: "TRACTOR_DRIVER", name: "Tractor Driver", category: "OPERATIONAL" as const, sortOrder: 270 },
    { code: "CONTRACTOR_ELECTRICAL", name: "Electrical Contractor", category: "CONTRACTOR" as const, sortOrder: 300 },
    { code: "CONTRACTOR_MAINTENANCE", name: "Maintenance Contractor", category: "CONTRACTOR" as const, sortOrder: 310 },
  ];

  const orgRoles = await Promise.all(
    ORG_ROLES.map((r) =>
      prisma.orgRole.create({
        data: { ...r, isSystem: true, isActive: true },
      })
    )
  );
  const roleId = (code: string) => orgRoles.find((r) => r.code === code)!.id;

  const employees = await Promise.all(
    [
      { code: "EMP-001", name: "Ahmed Raza", cnic: "35202-1111111-1", role: "TRANSFER_OFFICER", dept: "Transfers", salary: 85000, type: "STAFF" as const },
      { code: "EMP-002", name: "Sara Khan", cnic: "35202-2222222-2", role: "KHAZANCHI", dept: "Finance", salary: 75000, type: "PANEL_MEMBER" as const },
      { code: "EMP-003", name: "Bilal Hussain", cnic: "35202-3333333-3", role: "RECORD_KEEPER", dept: "Records", salary: 70000, type: "STAFF" as const },
      { code: "EMP-004", name: "Imran Ali", cnic: "35202-4444444-4", role: "SECURITY_GUARD", dept: "Security", salary: 35000, type: "STAFF" as const },
      { code: "EMP-005", name: "Naveed Iqbal", cnic: "35202-5555555-5", role: "SECURITY_GUARD", dept: "Security", salary: 35000, type: "STAFF" as const },
      { code: "EMP-006", name: "Tariq Mehmood", cnic: "35202-6666666-6", role: "TRACTOR_DRIVER", dept: "Works", salary: 40000, type: "STAFF" as const },
      { code: "EMP-007", name: "Farooq Shah", cnic: "35202-7777777-7", role: "GM", dept: "Management", salary: 150000, type: "STAFF" as const },
      { code: "EMP-008", name: "Ayesha Malik", cnic: "35202-8888888-8", role: "SECRETARY", dept: "Management", salary: 120000, type: "PANEL_MEMBER" as const },
      { code: "EMP-P01", name: "Dr. Khalid Mehmood", cnic: "35202-0000001-1", role: "PRESIDENT", dept: "Panel", salary: null, type: "PANEL_MEMBER" as const },
      { code: "EMP-009", name: "Rashid Khan", cnic: "35202-9090909-9", role: "COOK", dept: "Mess", salary: 32000, type: "STAFF" as const },
      { code: "EMP-010", name: "Zainab Ali", cnic: "35202-1010101-0", role: "COMPUTER_OPERATOR", dept: "Admin", salary: 45000, type: "STAFF" as const },
      { code: "EMP-011", name: "Kamran Shah", cnic: "35202-1111112-1", role: "DRIVER", dept: "Transport", salary: 38000, type: "STAFF" as const },
      { code: "EMP-012", name: "Hassan Mali", cnic: "35202-1212121-2", role: "MALI", dept: "Horticulture", salary: 28000, type: "STAFF" as const },
      { code: "EMP-013", name: "Ali Ahmad", cnic: "35202-1313131-3", role: "SWEEPER", dept: "Sanitation", salary: 26000, type: "STAFF" as const },
      { code: "EMP-014", name: "Javed Akhtar", cnic: "35202-1414141-4", role: "SUPERVISOR", dept: "Works", salary: 55000, type: "STAFF" as const },
    ].map((e) =>
      prisma.employee.create({
        data: {
          employeeCode: e.code,
          name: e.name,
          cnic: e.cnic,
          contact: "0300-1234567",
          orgRoleId: roleId(e.role),
          employmentType: e.type,
          department: e.dept,
          joiningDate: new Date("2020-01-15"),
          salary: e.salary,
          status: "ACTIVE",
        },
      })
    )
  );

  const [ahmed, sara, bilal, imran, naveed, tariq, farooq, ayesha, , , , , hassanMali, aliAhmad, supervisor] = employees;

  await prisma.employee.update({
    where: { id: supervisor.id },
    data: { supervisorId: farooq.id },
  });
  await prisma.employee.updateMany({
    where: { id: { in: [hassanMali.id, aliAhmad.id] } },
    data: { supervisorId: supervisor.id },
  });

  await prisma.employee.createMany({
    data: [
      {
        employeeCode: "CTR-001",
        name: "PowerLine Electrical Services",
        cnic: "35202-9900001-1",
        contact: "0300-9900001",
        orgRoleId: roleId("CONTRACTOR_ELECTRICAL"),
        employmentType: "CONTRACTOR",
        contractorTrade: "ELECTRICAL",
        companyName: "PowerLine Electrical Services",
        contractStart: new Date("2025-01-01"),
        contractEnd: new Date("2026-12-31"),
        department: "Works",
        joiningDate: new Date("2025-01-01"),
        status: "ACTIVE",
      },
      {
        employeeCode: "CTR-002",
        name: "GreenBuild Maintenance Co.",
        cnic: "35202-9900002-2",
        contact: "0300-9900002",
        orgRoleId: roleId("CONTRACTOR_MAINTENANCE"),
        employmentType: "CONTRACTOR",
        contractorTrade: "MAINTENANCE",
        companyName: "GreenBuild Maintenance Co.",
        contractStart: new Date("2025-06-01"),
        contractEnd: new Date("2026-05-31"),
        department: "Works",
        joiningDate: new Date("2025-06-01"),
        status: "ACTIVE",
      },
    ],
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@society.local",
      passwordHash,
      name: "System Administrator",
      role: "SUPER_ADMIN",
    },
  });

  await prisma.user.createMany({
    data: [
      { email: "transfer@society.local", passwordHash, name: ahmed.name, role: "TRANSFER_OFFICER", employeeId: ahmed.id },
      { email: "finance@society.local", passwordHash, name: sara.name, role: "FINANCE", employeeId: sara.id },
      { email: "records@society.local", passwordHash, name: bilal.name, role: "RECORD_MANAGER", employeeId: bilal.id },
      { email: "gm@society.local", passwordHash, name: farooq.name, role: "GM", employeeId: farooq.id },
      { email: "secretary@society.local", passwordHash, name: ayesha.name, role: "SECRETARY", employeeId: ayesha.id },
      { email: "security@society.local", passwordHash, name: imran.name, role: "SECURITY", employeeId: imran.id },
    ],
  });

  // Fee configurations (historical + active)
  const annual2025 = await prisma.feeConfiguration.create({
    data: {
      feeType: "ANNUAL_PLOT_CHARGE",
      name: "Annual Plot Charges 2025",
      amount: 2000,
      periodMonths: 1,
      effectiveFrom: new Date("2025-01-01"),
      effectiveUntil: new Date("2025-12-31"),
      status: "SUPERSEDED",
      createdById: admin.id,
    },
  });

  const annual2026 = await prisma.feeConfiguration.create({
    data: {
      feeType: "ANNUAL_PLOT_CHARGE",
      name: "Annual Plot Charges 2026",
      amount: 2000,
      periodMonths: 1,
      effectiveFrom: new Date("2026-01-01"),
      status: "ACTIVE",
      createdById: admin.id,
    },
  });

  const openFileFee = await prisma.feeConfiguration.create({
    data: {
      feeType: "OPEN_FILE",
      name: "Open File Fee (3 months)",
      amount: 21000,
      periodMonths: 3,
      effectiveFrom: new Date("2025-01-01"),
      status: "ACTIVE",
      createdById: admin.id,
    },
  });

  const transferFee = await prisma.feeConfiguration.create({
    data: {
      feeType: "TRANSFER",
      name: "Plot Transfer Fee",
      amount: 50000,
      effectiveFrom: new Date("2025-01-01"),
      status: "ACTIVE",
      createdById: admin.id,
    },
  });

  await prisma.feeConfiguration.createMany({
    data: [
      { feeType: "NOC", name: "NOC Fee", amount: 5000, effectiveFrom: new Date("2025-01-01"), status: "ACTIVE", createdById: admin.id },
      { feeType: "NEC", name: "NEC Fee", amount: 5000, effectiveFrom: new Date("2025-01-01"), status: "ACTIVE", createdById: admin.id },
      { feeType: "POSSESSION", name: "Possession Fee", amount: 15000, effectiveFrom: new Date("2025-01-01"), status: "ACTIVE", createdById: admin.id },
      {
        feeType: "WATER_TANKER",
        tankerType: "CLEAN_WATER",
        name: "Clean Water Tanker Delivery",
        amount: 2500,
        effectiveFrom: new Date("2025-01-01"),
        status: "ACTIVE",
        createdById: admin.id,
      },
      {
        feeType: "WATER_TANKER",
        tankerType: "CONSTRUCTION_WATER",
        name: "Construction Water Tanker Delivery",
        amount: 3500,
        effectiveFrom: new Date("2025-01-01"),
        status: "ACTIVE",
        createdById: admin.id,
      },
    ],
  });

  await prisma.numberSequence.createMany({
    data: [
      { key: "membership", prefix: "M", nextValue: 2500, padLength: 4 },
      { key: "allotment", prefix: "AL", nextValue: 2500, padLength: 4 },
      { key: "transfer", prefix: "TRD", nextValue: 120, padLength: 4 },
      { key: "physical_file", prefix: "PF", nextValue: 500, padLength: 4 },
      { key: "receipt", prefix: "RCPT", nextValue: 1000, padLength: 5 },
      { key: "open_file", prefix: "OF", nextValue: 90, padLength: 4 },
      { key: "employee", prefix: "EMP", nextValue: 15, padLength: 3 },
      { key: "noc_application", prefix: "NOC", nextValue: 300, padLength: 4 },
      { key: "noc_issue", prefix: "NOC-E17", nextValue: 250, padLength: 4 },
      { key: "tanker_booking", prefix: "TB", nextValue: 4, padLength: 4 },
    ],
  });

  await prisma.tankerTimeSlot.createMany({
    data: [
      { label: "Morning", startTime: "08:00", endTime: "10:00", sortOrder: 10, maxBookingsPerDay: 8, maxPerTanker: 2 },
      { label: "Late Morning", startTime: "10:00", endTime: "12:00", sortOrder: 20, maxBookingsPerDay: 8, maxPerTanker: 2 },
      { label: "Afternoon", startTime: "14:00", endTime: "16:00", sortOrder: 30, maxBookingsPerDay: 8, maxPerTanker: 2 },
      { label: "Evening", startTime: "16:00", endTime: "18:00", sortOrder: 40, maxBookingsPerDay: 6, maxPerTanker: 2 },
    ],
  });

  // Standard property size catalog
  await prisma.propertySizeOption.createMany({
    data: [
      { propertyType: "RESIDENTIAL", label: "5 Marla / 125 Sq Yd", sizeValue: 125, unit: "SQ_YD", sizeMarla: 5, sortOrder: 10 },
      { propertyType: "RESIDENTIAL", label: "8 Marla / 200 Sq Yd", sizeValue: 200, unit: "SQ_YD", sizeMarla: 8, sortOrder: 20 },
      { propertyType: "RESIDENTIAL", label: "10 Marla / 250 Sq Yd", sizeValue: 250, unit: "SQ_YD", sizeMarla: 10, sortOrder: 30 },
      { propertyType: "RESIDENTIAL", label: "10 Marla / 272 Sq Yd", sizeValue: 272, unit: "SQ_YD", sizeMarla: 10.88, sortOrder: 40 },
      { propertyType: "RESIDENTIAL", label: "15 Marla / 385 Sq Yd", sizeValue: 385, unit: "SQ_YD", sizeMarla: 15.4, sortOrder: 50 },
      { propertyType: "RESIDENTIAL", label: "20 Marla / 500 Sq Yd", sizeValue: 500, unit: "SQ_YD", sizeMarla: 20, sortOrder: 60 },
      { propertyType: "RESIDENTIAL", label: "1 Kanal / 1000 Sq Yd", sizeValue: 1000, unit: "SQ_YD", sizeMarla: 40, sortOrder: 70 },
      { propertyType: "COMMERCIAL", label: "4 Marla / 100 Sq Yd", sizeValue: 100, unit: "SQ_YD", sizeMarla: 4, sortOrder: 10 },
      { propertyType: "COMMERCIAL", label: "8 Marla / 200 Sq Yd", sizeValue: 200, unit: "SQ_YD", sizeMarla: 8, sortOrder: 20 },
      { propertyType: "FLAT", label: "2 Bed — 900 Sq Ft", sizeValue: 900, unit: "SQ_FT", sizeMarla: 4, sortOrder: 10 },
      { propertyType: "FLAT", label: "3 Bed — 1200 Sq Ft", sizeValue: 1200, unit: "SQ_FT", sizeMarla: 5.33, sortOrder: 20 },
      { propertyType: "FLAT", label: "4 Bed — 1600 Sq Ft", sizeValue: 1600, unit: "SQ_FT", sizeMarla: 7.11, sortOrder: 30 },
      { propertyType: "SHOP", label: "1 Marla Shop", sizeValue: 25, unit: "SQ_YD", sizeMarla: 1, sortOrder: 10 },
      { propertyType: "SHOP", label: "2 Marla Shop", sizeValue: 50, unit: "SQ_YD", sizeMarla: 2, sortOrder: 20 },
      { propertyType: "SHOP", label: "400 Sq Ft Shop", sizeValue: 400, unit: "SQ_FT", sizeMarla: 1.78, sortOrder: 30 },
    ],
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: "society_name", value: "Green Valley Housing Society", label: "Society Name" },
      { key: "require_bank_clearance_for_transfer", value: "true", label: "Block transfer if active mortgage" },
      { key: "open_file_expiry_alert_days", value: "30", label: "Open file expiry alert (days)" },
      { key: "sla_transfer_allotment_days", value: "14", label: "Transfer → allotment letter printing (days)" },
      { key: "sla_possession_days", value: "21", label: "Possession case completion (days)" },
      { key: "sla_death_case_days", value: "30", label: "Death / succession case completion (days)" },
      { key: "sla_noc_days", value: "7", label: "NOC issuance (days)" },
      { key: "sla_nec_days", value: "7", label: "NEC issuance (days)" },
      { key: "sla_utility_noc_days", value: "7", label: "Utility connection NOC (days)" },
    ],
  });

  // File locations
  const locA = await prisma.fileLocation.create({
    data: { building: "Admin Block", room: "Record Room 1", almirah: "A-1", locker: "L-12", shelf: "S-3", position: "P-05", label: "Sector E Active" },
  });
  const locB = await prisma.fileLocation.create({
    data: { building: "Admin Block", room: "Record Room 1", almirah: "A-2", locker: "L-04", shelf: "S-1", position: "P-02", label: "Transferred Files" },
  });
  const locC = await prisma.fileLocation.create({
    data: { building: "Admin Block", room: "Record Room 2", almirah: "B-1", locker: "L-01", shelf: "S-2", position: "P-08", label: "Open Files" },
  });

  // Plot with full ownership history (the showcase plot)
  const plot123 = await prisma.plot.create({
    data: {
      plotNumber: "123",
      sector: "E-17",
      block: "3",
      street: "Street 12",
      sizeMarla: 10,
      sizeSqYd: 250,
      plotType: "RESIDENTIAL",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      hasActiveMortgage: false,
      hasOpenFile: false,
      annualChargesStatus: "PAID",
    },
  });

  const owner1 = await prisma.ownership.create({
    data: {
      plotId: plot123.id,
      ownerName: "Muhammad Asif",
      cnic: "35202-1001001-1",
      contact: "0300-1112233",
      address: "Lahore",
      membershipNumber: "M-1001",
      allotmentNumber: "AL-1001",
      startDate: new Date("2018-03-15"),
      endDate: new Date("2021-06-20"),
      status: "TRANSFERRED",
    },
  });

  const owner2 = await prisma.ownership.create({
    data: {
      plotId: plot123.id,
      ownerName: "Fatima Bibi",
      cnic: "35202-2002002-2",
      contact: "0301-4455667",
      address: "Rawalpindi",
      membershipNumber: "M-1820",
      allotmentNumber: "AL-1820",
      startDate: new Date("2021-06-20"),
      endDate: new Date("2024-02-10"),
      status: "TRANSFERRED",
    },
  });

  const owner3 = await prisma.ownership.create({
    data: {
      plotId: plot123.id,
      ownerName: "Abbas Hafiz",
      cnic: "35202-3003003-3",
      contact: "0321-9988776",
      address: "Islamabad",
      membershipNumber: "M-2451",
      allotmentNumber: "AL-2451",
      startDate: new Date("2024-02-10"),
      status: "ACTIVE",
    },
  });

  // Historical transfers for plot 123
  const t1 = await prisma.transfer.create({
    data: {
      transferNumber: "TRD-0010",
      trdNumber: "TRD-0010",
      plotId: plot123.id,
      transferType: "SALE",
      status: "COMPLETED",
      currentStep: 14,
      sellerName: owner1.ownerName,
      sellerCnic: owner1.cnic,
      sellerMembershipNo: owner1.membershipNumber,
      sellerPresentPersonally: true,
      sellerIdentityVerified: true,
      purchaserName: owner2.ownerName,
      purchaserCnic: owner2.cnic,
      newMembershipNumber: owner2.membershipNumber,
      newAllotmentNumber: owner2.allotmentNumber,
      completedAt: owner1.endDate,
      completedById: admin.id,
    },
  });

  const t2 = await prisma.transfer.create({
    data: {
      transferNumber: "TRD-0088",
      trdNumber: "TRD-0088",
      plotId: plot123.id,
      transferType: "SALE",
      status: "COMPLETED",
      currentStep: 14,
      sellerName: owner2.ownerName,
      sellerCnic: owner2.cnic,
      sellerMembershipNo: owner2.membershipNumber,
      sellerPresentPersonally: true,
      sellerIdentityVerified: true,
      purchaserName: owner3.ownerName,
      purchaserCnic: owner3.cnic,
      newMembershipNumber: owner3.membershipNumber,
      newAllotmentNumber: owner3.allotmentNumber,
      completedAt: owner2.endDate,
      completedById: admin.id,
    },
  });

  await prisma.ownership.update({ where: { id: owner1.id }, data: { transferOutId: t1.id } });
  await prisma.ownership.update({ where: { id: owner2.id }, data: { transferInId: t1.id, transferOutId: t2.id } });
  await prisma.ownership.update({ where: { id: owner3.id }, data: { transferInId: t2.id } });

  await prisma.possession.create({
    data: {
      plotId: plot123.id,
      ownershipId: owner2.id,
      applicationNumber: "POS-0045",
      applicationDate: new Date("2022-01-15"),
      slaDueAt: new Date("2022-02-05"),
      applicantName: owner2.ownerName,
      possessionFee: 15000,
      paymentStatus: "VERIFIED",
      approvalStatus: "ISSUED",
      letterNumber: "PL-0045",
      issueDate: new Date("2022-01-15"),
      approvedById: admin.id,
    },
  });

  await prisma.noc.create({
    data: {
      plotId: plot123.id,
      ownershipId: owner3.id,
      applicationNumber: "NOC-0210",
      applicationDate: new Date("2025-10-25"),
      slaDueAt: new Date("2025-11-01"),
      applicantName: owner3.ownerName,
      purpose: "GENERAL",
      nocNumber: "NOC-E17-0210",
      issueDate: new Date("2025-11-01"),
      fee: 5000,
      paymentStatus: "VERIFIED",
      status: "ISSUED",
      approvedById: admin.id,
    },
  });

  // Plot with active mortgage (warning demo)
  const plot456 = await prisma.plot.create({
    data: {
      plotNumber: "456",
      sector: "E-17",
      block: "5",
      street: "Street 4",
      sizeMarla: 7,
      sizeSqYd: 175,
      plotType: "RESIDENTIAL",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      hasActiveMortgage: true,
      annualChargesStatus: "OVERDUE",
    },
  });

  const owner456 = await prisma.ownership.create({
    data: {
      plotId: plot456.id,
      ownerName: "Kamran Shah",
      cnic: "35202-4004004-4",
      contact: "0333-1122334",
      membershipNumber: "M-2100",
      allotmentNumber: "AL-2100",
      startDate: new Date("2022-08-01"),
      status: "ACTIVE",
    },
  });

  await prisma.mortgage.create({
    data: {
      plotId: plot456.id,
      ownershipId: owner456.id,
      bankName: "HBL",
      loanReference: "HBL-LN-88221",
      mortgageDate: new Date("2023-01-10"),
      status: "ACTIVE",
      remarks: "Housing finance — transfer blocked until bank NOC",
    },
  });

  // Plot with open file expiring soon
  const plot789 = await prisma.plot.create({
    data: {
      plotNumber: "789",
      sector: "F-11",
      block: "2",
      street: "Street 7",
      sizeMarla: 5,
      sizeSqYd: 125,
      plotType: "RESIDENTIAL",
      ownershipStatus: "ACTIVE",
      developmentStatus: "DEVELOPED",
      hasOpenFile: true,
      annualChargesStatus: "PENDING",
    },
  });

  const owner789 = await prisma.ownership.create({
    data: {
      plotId: plot789.id,
      ownerName: "Nida Rehman",
      cnic: "35202-5005005-5",
      contact: "0345-6677889",
      membershipNumber: "M-2301",
      allotmentNumber: "AL-2301",
      startDate: new Date("2023-05-01"),
      status: "ACTIVE",
    },
  });

  const expirySoon = new Date();
  expirySoon.setDate(expirySoon.getDate() + 12);

  await prisma.openFile.create({
    data: {
      openFileNumber: "OF-0084",
      plotId: plot789.id,
      ownershipId: owner789.id,
      trdNumber: "TRD-0115",
      sellerName: owner789.ownerName,
      sellerCnic: owner789.cnic,
      sellerMembershipNo: owner789.membershipNumber,
      dealerName: "Al-Noor Associates",
      dealerOffice: "Blue Area, Islamabad",
      openingDate: new Date(Date.now() - 78 * 24 * 60 * 60 * 1000),
      expiryDate: expirySoon,
      periodMonths: 3,
      feeAmount: 21000,
      feeConfigId: openFileFee.id,
      paymentStatus: "VERIFIED",
      status: "ACTIVE",
    },
  });

  // Undeveloped / non-possession plot with owner and pending dues (QR scan demo)
  const plot052 = await prisma.plot.create({
    data: {
      plotNumber: "052",
      sector: "E-17",
      block: "8",
      street: "Street 18",
      sizeMarla: 8,
      sizeSqYd: 200,
      plotType: "RESIDENTIAL",
      ownershipStatus: "ACTIVE",
      possessionStatus: "NOT_APPLIED",
      developmentStatus: "UNDEVELOPED",
      annualChargesStatus: "OVERDUE",
      remarks: "Undeveloped plot — owner allotted, possession not issued",
    },
  });

  const owner052 = await prisma.ownership.create({
    data: {
      plotId: plot052.id,
      ownerName: "Rashid Mehmood",
      cnic: "35202-6106106-6",
      contact: "0312-5544332",
      address: "Peshawar",
      membershipNumber: "M-2405",
      allotmentNumber: "AL-2405",
      startDate: new Date("2023-11-01"),
      status: "ACTIVE",
    },
  });

  await prisma.plotCharge.createMany({
    data: [
      {
        plotId: plot052.id,
        ownershipId: owner052.id,
        feeConfigId: annual2026.id,
        year: 2026,
        month: 6,
        rateSnapshot: 2000,
        amount: 2000,
        status: "OVERDUE",
        dueDate: new Date("2026-06-01"),
      },
      {
        plotId: plot052.id,
        ownershipId: owner052.id,
        feeConfigId: annual2026.id,
        year: 2026,
        month: 7,
        rateSnapshot: 2000,
        amount: 2000,
        status: "PENDING",
        dueDate: new Date("2026-07-01"),
      },
    ],
  });

  await prisma.payment.create({
    data: {
      receiptNumber: "RCPT-00955",
      plotId: plot052.id,
      ownershipId: owner052.id,
      feeType: "ANNUAL_PLOT_CHARGE",
      feeConfigId: annual2026.id,
      amount: 2000,
      status: "PENDING",
      paymentMethod: "PO",
    },
  });

  // Residential plot — 500 Sq Yd (construction NOC demo)
  const plot500 = await prisma.plot.create({
    data: {
      plotNumber: "500",
      sector: "E-17",
      block: "6",
      street: "Street 22",
      sizeMarla: 20,
      sizeSqYd: 500,
      plotType: "RESIDENTIAL",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "UNDEVELOPED",
      annualChargesStatus: "PAID",
      remarks: "20 Marla / 500 Sq Yd — owner plans to build house",
    },
  });

  const owner500 = await prisma.ownership.create({
    data: {
      plotId: plot500.id,
      ownerName: "Usman Tariq",
      cnic: "35202-6156156-6",
      contact: "0300-7766554",
      address: "Islamabad",
      membershipNumber: "M-2408",
      allotmentNumber: "AL-2408",
      startDate: new Date("2024-06-01"),
      status: "ACTIVE",
    },
  });

  await prisma.noc.create({
    data: {
      plotId: plot500.id,
      ownershipId: owner500.id,
      applicationNumber: "NOC-0298",
      applicationDate: new Date(),
      slaDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      applicantName: owner500.ownerName,
      purpose: "CONSTRUCTION",
      constructionType: "HOUSE",
      applicationNotes: "Owner applies to society for NOC to construct a single-storey residential house (500 Sq Yd plot).",
      fee: 5000,
      paymentStatus: "SUBMITTED",
      status: "SUBMITTED",
    },
  });

  // Diverse property types: flat, shop, park, masjid
  const plotFlat = await prisma.plot.create({
    data: {
      plotNumber: "A-12",
      sector: "E-17",
      block: "C",
      street: "Central Avenue",
      sizeMarla: 4,
      sizeSqYd: 100,
      plotType: "FLAT",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      annualChargesStatus: "PAID",
      remarks: "Residential flat — 2nd floor",
    },
  });

  await prisma.ownership.create({
    data: {
      plotId: plotFlat.id,
      ownerName: "Saima Noor",
      cnic: "35202-6206206-6",
      contact: "0333-2211445",
      membershipNumber: "M-2410",
      allotmentNumber: "AL-2410",
      startDate: new Date("2024-03-01"),
      status: "ACTIVE",
    },
  });

  const plotShop = await prisma.plot.create({
    data: {
      plotNumber: "S-05",
      sector: "E-17",
      block: "Comm",
      street: "Commercial Plaza",
      sizeMarla: 2,
      sizeSqYd: 50,
      plotType: "SHOP",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      annualChargesStatus: "PAID",
      remarks: "Ground-floor commercial shop",
    },
  });

  await prisma.ownership.create({
    data: {
      plotId: plotShop.id,
      ownerName: "Bashir Traders",
      cnic: "35202-6306306-6",
      contact: "0345-8877665",
      membershipNumber: "M-2411",
      allotmentNumber: "AL-2411",
      startDate: new Date("2023-09-15"),
      status: "ACTIVE",
    },
  });

  // Death / succession case demo (in progress — widow + children)
  const plot222 = await prisma.plot.create({
    data: {
      plotNumber: "222",
      sector: "F-11",
      block: "4",
      street: "Street 9",
      sizeMarla: 10,
      sizeSqYd: 250,
      plotType: "RESIDENTIAL",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      annualChargesStatus: "PAID",
      remarks: "Death succession case demo — legal heirs on file",
    },
  });

  const owner222 = await prisma.ownership.create({
    data: {
      plotId: plot222.id,
      ownerName: "Ghulam Rasool (deceased)",
      cnic: "35202-5505505-5",
      contact: "0300-5544332",
      address: "Rawalpindi",
      membershipNumber: "M-1988",
      allotmentNumber: "AL-1988",
      startDate: new Date("2019-04-10"),
      status: "ACTIVE",
    },
  });

  const deathTransfer = await prisma.transfer.create({
    data: {
      transferNumber: "TRD-0125",
      trdNumber: "TRD-0125",
      plotId: plot222.id,
      transferType: "DEATH_SUCCESSION",
      status: "DOCUMENTS_PENDING",
      currentStep: 2,
      sellerName: owner222.ownerName,
      sellerCnic: owner222.cnic,
      sellerMembershipNo: owner222.membershipNumber,
      sellerContact: owner222.contact,
      sellerAddress: owner222.address,
      sellerOwnershipId: owner222.id,
      deceasedDateOfDeath: new Date("2025-12-15"),
      deathCertificateRef: "UC-F11-2025/4421",
      remarks: "Widow + 2 children — society transfers to nominated primary heir with consent",
      slaDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.transferHeir.createMany({
    data: [
      {
        transferId: deathTransfer.id,
        name: "Rukhsana Bibi",
        cnic: "35202-5515515-5",
        relationToDeceased: "WIFE",
        contact: "0300-5544332",
        address: "Rawalpindi",
        isPrimarySuccessor: true,
        shareNotes: "Widow — nominated primary successor for membership",
      },
      {
        transferId: deathTransfer.id,
        name: "Ahmed Rasool",
        cnic: "35202-5525525-5",
        relationToDeceased: "SON",
        contact: "0312-9988776",
        shareNotes: "Eldest son — consents to widow as primary successor",
      },
      {
        transferId: deathTransfer.id,
        name: "Fatima Rasool",
        cnic: "35202-5535535-5",
        relationToDeceased: "DAUGHTER",
        contact: "0333-1122334",
        shareNotes: "Daughter — heir on FRC (NADRA)",
      },
    ],
  });

  await prisma.document.createMany({
    data: [
      {
        plotId: plot222.id,
        transferId: deathTransfer.id,
        documentType: "OLD_ALLOTMENT_LETTER",
        title: "Original allotment letter — M-1988",
        fileName: "old-allotment-letter.pdf",
        filePath: `/uploads/death/${deathTransfer.id}/old-allotment-letter.pdf`,
      },
      {
        plotId: plot222.id,
        transferId: deathTransfer.id,
        documentType: "DECEASED_CNIC",
        title: "CNIC — Ghulam Rasool",
        fileName: "deceased-cnic.pdf",
        filePath: `/uploads/death/${deathTransfer.id}/deceased-cnic.pdf`,
      },
      {
        plotId: plot222.id,
        transferId: deathTransfer.id,
        documentType: "FRC_NADRA",
        title: "FRC (NADRA) — Family Registration Certificate",
        fileName: "frc-nadra.pdf",
        filePath: `/uploads/death/${deathTransfer.id}/frc-nadra.pdf`,
      },
      {
        plotId: plot222.id,
        transferId: deathTransfer.id,
        documentType: "HEIR_CNIC",
        title: "CNIC — Rukhsana Bibi (primary successor)",
        fileName: "heir-cnic-primary.pdf",
        filePath: `/uploads/death/${deathTransfer.id}/heir-cnic.pdf`,
      },
    ],
  });

  await prisma.noc.create({
    data: {
      plotId: plot222.id,
      ownershipId: owner222.id,
      applicationNumber: "NOC-0312",
      applicationDate: new Date(),
      slaDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      applicantName: owner222.ownerName,
      purpose: "UTILITY_CONNECTION",
      applicationNotes: "Utility connection NOC — electricity meter transfer pending succession",
      fee: 3000,
      paymentStatus: "PENDING",
      status: "SUBMITTED",
    },
  });

  const plotPark = await prisma.plot.create({
    data: {
      plotNumber: "PARK-01",
      sector: "E-17",
      block: "Amenity",
      street: "Community Park",
      sizeMarla: 20,
      plotType: "PARK",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      annualChargesStatus: "WAIVED",
      remarks: "Society community park — society-held amenity",
    },
  });

  const plotMosque = await prisma.plot.create({
    data: {
      plotNumber: "MSJ-01",
      sector: "E-17",
      block: "Amenity",
      street: "Jamia Masjid Road",
      sizeMarla: 8,
      plotType: "MOSQUE",
      ownershipStatus: "ACTIVE",
      possessionStatus: "ISSUED",
      developmentStatus: "DEVELOPED",
      annualChargesStatus: "WAIVED",
      remarks: "Society masjid — caretaker assigned",
    },
  });

  await prisma.plotStaffAssignment.createMany({
    data: [
      {
        plotId: plotPark.id,
        employeeId: hassanMali.id,
        roleLabel: "Park Mali",
        startDate: new Date("2022-04-01"),
        status: "ACTIVE",
        remarks: "Maintains lawns and irrigation",
      },
      {
        plotId: plotMosque.id,
        employeeId: aliAhmad.id,
        roleLabel: "Masjid Caretaker",
        startDate: new Date("2021-06-01"),
        status: "ACTIVE",
        remarks: "Cleaning and daily upkeep",
      },
      {
        plotId: plotShop.id,
        employeeId: imran.id,
        roleLabel: "Commercial Block Security",
        startDate: new Date("2024-01-01"),
        status: "ACTIVE",
        remarks: "Evening patrol — commercial plaza",
      },
    ],
  });

  // More plots for dashboard counts
  const extraPlots = [];
  for (let i = 1; i <= 20; i++) {
    const p = await prisma.plot.create({
      data: {
        plotNumber: String(1000 + i),
        sector: i % 2 === 0 ? "E-17" : "F-11",
        block: String((i % 5) + 1),
        street: `Street ${(i % 10) + 1}`,
        sizeMarla: i % 3 === 0 ? 10 : 5,
        plotType:
          i % 11 === 0
            ? "FLAT"
            : i % 13 === 0
              ? "SHOP"
              : i % 7 === 0
                ? "COMMERCIAL"
                : "RESIDENTIAL",
        ownershipStatus: "ACTIVE",
        possessionStatus: i % 4 === 0 ? "ISSUED" : "NOT_APPLIED",
        developmentStatus: i % 4 === 0 ? "DEVELOPED" : i % 5 === 0 ? "UNDER_CONSTRUCTION" : "DEVELOPED",
        annualChargesStatus: i % 3 === 0 ? "OVERDUE" : "PAID",
      },
    });
    await prisma.ownership.create({
      data: {
        plotId: p.id,
        ownerName: `Owner ${i}`,
        cnic: `35202-${String(6000000 + i).padStart(7, "0")}-${i % 9}`,
        membershipNumber: `M-${2500 + i}`,
        allotmentNumber: `AL-${2500 + i}`,
        startDate: new Date("2024-01-01"),
        status: "ACTIVE",
      },
    });
    extraPlots.push(p);
  }

  // Physical files
  const pf123 = await prisma.physicalFile.create({
    data: {
      fileNumber: "PF-0123",
      barcode: "PF-E17-3-123",
      plotId: plot123.id,
      currentLocationId: locA.id,
      status: "IN_LOCKER",
      condition: "GOOD",
    },
  });

  await prisma.fileMovement.create({
    data: {
      physicalFileId: pf123.id,
      fromLocationId: locB.id,
      toLocationId: locA.id,
      movedById: admin.id,
      reason: "Membership change after transfer TRD-0088",
      transferId: t2.id,
      movedAt: new Date("2024-02-12"),
    },
  });

  await prisma.physicalFile.create({
    data: {
      fileNumber: "PF-0456",
      barcode: "PF-E17-5-456",
      plotId: plot456.id,
      currentLocationId: locA.id,
      status: "IN_LOCKER",
    },
  });

  await prisma.physicalFile.create({
    data: {
      fileNumber: "PF-0789",
      barcode: "PF-F11-2-789",
      plotId: plot789.id,
      currentLocationId: locC.id,
      status: "CHECKED_OUT",
      remarks: "With dealer for open file",
    },
  });

  await prisma.physicalFile.create({
    data: {
      fileNumber: "PF-0052",
      barcode: "PF-E17-8-052",
      plotId: plot052.id,
      currentLocationId: locA.id,
      status: "IN_LOCKER",
      condition: "GOOD",
      remarks: "Undeveloped plot file",
    },
  });

  // Pending transfer
  await prisma.transfer.create({
    data: {
      transferNumber: "TRD-0119",
      trdNumber: "TRD-0119",
      plotId: plot123.id,
      transferType: "SALE",
      status: "PAYMENT_PENDING",
      currentStep: 7,
      slaDueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      sellerName: owner3.ownerName,
      sellerCnic: owner3.cnic,
      sellerMembershipNo: owner3.membershipNumber,
      sellerContact: owner3.contact,
      sellerPresentPersonally: true,
      sellerIdentityVerified: true,
      sellerVerifiedById: admin.id,
      sellerVerificationDate: new Date(),
      purchaserName: "Hassan Ali",
      purchaserCnic: "35202-7007007-7",
      purchaserContact: "0300-9988776",
      purchaserAddress: "Karachi",
    },
  });

  const transferPayment = await prisma.payment.create({
    data: {
      receiptNumber: "RCPT-00950",
      plotId: plot123.id,
      ownershipId: owner3.id,
      feeType: "TRANSFER",
      feeConfigId: transferFee.id,
      amount: 50000,
      poAmount: 50000,
      poNumber: "PO-88991",
      bankName: "Meezan Bank",
      poDate: new Date(),
      paymentDate: new Date(),
      status: "VERIFIED",
      paymentMethod: "PO",
      verifiedAt: new Date(),
      verifiedById: admin.id,
    },
  });

  // Plot charges with historical rate snapshot
  await prisma.plotCharge.create({
    data: {
      plotId: plot123.id,
      ownershipId: owner3.id,
      feeConfigId: annual2025.id,
      year: 2025,
      month: 12,
      rateSnapshot: 2000,
      amount: 2000,
      status: "PAID",
      paidAt: new Date("2025-12-05"),
    },
  });

  await prisma.plotCharge.create({
    data: {
      plotId: plot123.id,
      ownershipId: owner3.id,
      feeConfigId: annual2026.id,
      year: 2026,
      month: 1,
      rateSnapshot: 2000,
      amount: 2000,
      status: "PAID",
      paidAt: new Date("2026-01-08"),
    },
  });

  await prisma.plotCharge.create({
    data: {
      plotId: plot456.id,
      ownershipId: owner456.id,
      feeConfigId: annual2026.id,
      year: 2026,
      month: 8,
      rateSnapshot: 2000,
      amount: 2000,
      status: "OVERDUE",
      dueDate: new Date("2026-08-01"),
    },
  });

  const mortgage456 = await prisma.mortgage.findFirst({ where: { plotId: plot456.id } });

  // Documents linked to ownerships (never replace prior owner docs)
  await prisma.document.createMany({
    data: [
      {
        plotId: plot123.id,
        ownershipId: owner1.id,
        documentType: "ALLOTMENT_LETTER",
        title: "Allotment Letter — M-1001",
        documentNumber: "AL-1001",
        fileName: "allotment-m1001.pdf",
        filePath: "/uploads/demo/allotment-m1001.pdf",
        version: 1,
        status: "ARCHIVED",
        uploadedById: admin.id,
      },
      {
        plotId: plot123.id,
        ownershipId: owner2.id,
        documentType: "ALLOTMENT_LETTER",
        title: "Allotment Letter — M-1820",
        documentNumber: "AL-1820",
        fileName: "allotment-m1820.pdf",
        filePath: "/uploads/demo/allotment-m1820.pdf",
        version: 1,
        status: "ARCHIVED",
        uploadedById: admin.id,
      },
      {
        plotId: plot123.id,
        ownershipId: owner3.id,
        documentType: "ALLOTMENT_LETTER",
        title: "Allotment Letter — M-2451",
        documentNumber: "AL-2451",
        fileName: "allotment-m2451.pdf",
        filePath: "/uploads/demo/allotment-m2451.pdf",
        version: 1,
        status: "ACTIVE",
        uploadedById: admin.id,
      },
      {
        plotId: plot123.id,
        ownershipId: owner3.id,
        documentType: "CNIC",
        title: "CNIC — Abbas Hafiz",
        fileName: "cnic-abbas.pdf",
        filePath: "/uploads/demo/cnic-abbas.pdf",
        version: 1,
        status: "ACTIVE",
        uploadedById: admin.id,
      },
      {
        plotId: plot456.id,
        ownershipId: owner456.id,
        mortgageId: mortgage456!.id,
        documentType: "MORTGAGE_LETTER",
        title: "HBL Mortgage Letter",
        fileName: "hbl-mortgage.pdf",
        filePath: "/uploads/demo/hbl-mortgage.pdf",
        version: 1,
        status: "ACTIVE",
        uploadedById: admin.id,
      },
    ],
  });

  // Attendance today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const emp of employees) {
    await prisma.attendance.create({
      data: {
        employeeId: emp.id,
        date: today,
        checkIn: new Date(today.getTime() + 8 * 60 * 60 * 1000),
        shift: emp.designation === "SECURITY_GUARD" ? "DAY" : "GENERAL",
        status: emp.id === naveed.id ? "ABSENT" : "PRESENT",
        markedById: admin.id,
      },
    });
  }

  await prisma.guardShift.createMany({
    data: [
      { employeeId: imran.id, date: today, shift: "DAY", post: "Main Gate" },
      { employeeId: naveed.id, date: today, shift: "NIGHT", post: "Main Gate", isLeave: true, notes: "On leave — replacement needed" },
    ],
  });

  // Water tankers
  const [slotMorning, slotLateMorning, slotAfternoon] = await Promise.all([
    prisma.tankerTimeSlot.findFirst({ where: { startTime: "08:00" } }),
    prisma.tankerTimeSlot.findFirst({ where: { startTime: "10:00" } }),
    prisma.tankerTimeSlot.findFirst({ where: { startTime: "14:00" } }),
  ]);
  const cleanWaterFee = await prisma.feeConfiguration.findFirst({
    where: { feeType: "WATER_TANKER", tankerType: "CLEAN_WATER", status: "ACTIVE" },
  });
  const constructionWaterFee = await prisma.feeConfiguration.findFirst({
    where: { feeType: "WATER_TANKER", tankerType: "CONSTRUCTION_WATER", status: "ACTIVE" },
  });

  const tanker1 = await prisma.waterTanker.create({
    data: { tankerCode: "WT-01", capacityLiters: 5000, driverId: tariq.id },
  });
  const tanker2 = await prisma.waterTanker.create({
    data: { tankerCode: "WT-02", capacityLiters: 3000, driverId: tariq.id },
  });

  await prisma.tankerDelivery.createMany({
    data: [
      {
        bookingNumber: "TB-0001",
        tankerType: "CLEAN_WATER",
        tankerId: tanker1.id,
        driverId: tariq.id,
        plotId: plot123.id,
        bookerName: "Fatima Khan",
        customerName: "Fatima Khan",
        streetArea: "E-17 Street 12",
        distributionDate: today,
        timeSlotId: slotMorning!.id,
        slotLabel: slotMorning!.label,
        slotStartTime: slotMorning!.startTime,
        slotEndTime: slotMorning!.endTime,
        charges: 2500,
        feeConfigId: cleanWaterFee!.id,
        paymentStatus: "PAID",
        receiptNumber: "RCPT-00980",
        status: "COMPLETED",
        bookedById: admin.id,
      },
      {
        bookingNumber: "TB-0002",
        tankerType: "CLEAN_WATER",
        tankerId: tanker1.id,
        plotId: plot456.id,
        bookerName: "Usman Tariq",
        customerName: "Usman Tariq",
        streetArea: "E-17 Street 4",
        distributionDate: today,
        timeSlotId: slotLateMorning!.id,
        slotLabel: slotLateMorning!.label,
        slotStartTime: slotLateMorning!.startTime,
        slotEndTime: slotLateMorning!.endTime,
        charges: 2500,
        feeConfigId: cleanWaterFee!.id,
        paymentStatus: "UNPAID",
        status: "SCHEDULED",
        bookedById: admin.id,
      },
      {
        bookingNumber: "TB-0003",
        tankerType: "CONSTRUCTION_WATER",
        tankerId: tanker2.id,
        driverId: tariq.id,
        customerName: "Walk-in",
        bookerName: "Walk-in Customer",
        streetArea: "F-11 Street 7",
        distributionDate: today,
        timeSlotId: slotAfternoon!.id,
        slotLabel: slotAfternoon!.label,
        slotStartTime: slotAfternoon!.startTime,
        slotEndTime: slotAfternoon!.endTime,
        charges: 3500,
        feeConfigId: constructionWaterFee!.id,
        paymentStatus: "PAID",
        receiptNumber: "RCPT-00981",
        status: "COMPLETED",
        bookedById: admin.id,
      },
    ],
  });

  await prisma.garbageCollection.createMany({
    data: [
      {
        collectionDate: today,
        area: "Sector E-17",
        street: "Street 12",
        collectorId: aliAhmad.id,
        status: "COMPLETED",
      },
      {
        collectionDate: today,
        area: "Sector E-17",
        street: "Street 4",
        collectorId: aliAhmad.id,
        status: "PENDING",
      },
    ],
  });

  await prisma.vehicle.create({
    data: {
      vehicleCode: "TR-01",
      registrationNo: "ICT-4521",
      vehicleType: "TRACTOR",
      driverId: tariq.id,
    },
  });

  const saraUser = await prisma.user.findUnique({ where: { email: "finance@society.local" } });
  await seedFinance(prisma, {
    adminId: admin.id,
    saraId: saraUser!.id,
    plot123Id: plot123.id,
    owner3Id: owner3.id,
    transferPaymentId: transferPayment.id,
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "TRANSFER_COMPLETED",
        module: "transfers",
        recordId: t2.id,
        plotId: plot123.id,
        transferId: t2.id,
        newValue: { membership: "M-2451", owner: "Abbas Hafiz" },
        reason: "Seeded historical transfer",
      },
      {
        userId: admin.id,
        action: "FEE_CONFIGURATION_CHANGED",
        module: "settings",
        recordId: annual2026.id,
        newValue: { feeType: "ANNUAL_PLOT_CHARGE", amount: 2000 },
      },
      {
        userId: admin.id,
        action: "PHYSICAL_FILE_MOVED",
        module: "physical-files",
        plotId: plot123.id,
        oldValue: { location: "A-2 / L-04" },
        newValue: { location: "A-1 / L-12" },
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Login: admin@society.local / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
