import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Society Records…");

  await prisma.auditLog.deleteMany();
  await prisma.tankerDelivery.deleteMany();
  await prisma.waterTanker.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.vehicleUsage.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.guardShift.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.fileMovement.deleteMany();
  await prisma.physicalFile.deleteMany();
  await prisma.fileLocation.deleteMany();
  await prisma.openFileRenewal.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.plotCharge.deleteMany();
  await prisma.openFile.deleteMany();
  await prisma.mortgage.deleteMany();
  await prisma.nec.deleteMany();
  await prisma.noc.deleteMany();
  await prisma.possession.deleteMany();
  // Break ownership↔transfer FKs carefully
  await prisma.ownership.updateMany({ data: { transferInId: null, transferOutId: null } });
  await prisma.transfer.deleteMany();
  await prisma.ownership.deleteMany();
  await prisma.plot.deleteMany();
  await prisma.feeConfiguration.deleteMany();
  await prisma.numberSequence.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const employees = await Promise.all(
    [
      { code: "EMP-001", name: "Ahmed Raza", cnic: "35202-1111111-1", designation: "TRANSFER_OFFICER" as const, dept: "Transfers", salary: 85000 },
      { code: "EMP-002", name: "Sara Khan", cnic: "35202-2222222-2", designation: "FINANCE" as const, dept: "Finance", salary: 75000 },
      { code: "EMP-003", name: "Bilal Hussain", cnic: "35202-3333333-3", designation: "RECORD_MANAGER" as const, dept: "Records", salary: 70000 },
      { code: "EMP-004", name: "Imran Ali", cnic: "35202-4444444-4", designation: "SECURITY_GUARD" as const, dept: "Security", salary: 35000 },
      { code: "EMP-005", name: "Naveed Iqbal", cnic: "35202-5555555-5", designation: "SECURITY_GUARD" as const, dept: "Security", salary: 35000 },
      { code: "EMP-006", name: "Tariq Mehmood", cnic: "35202-6666666-6", designation: "TRACTOR_DRIVER" as const, dept: "Works", salary: 40000 },
      { code: "EMP-007", name: "Farooq Shah", cnic: "35202-7777777-7", designation: "GM" as const, dept: "Management", salary: 150000 },
      { code: "EMP-008", name: "Ayesha Malik", cnic: "35202-8888888-8", designation: "SECRETARY" as const, dept: "Management", salary: 120000 },
    ].map((e) =>
      prisma.employee.create({
        data: {
          employeeCode: e.code,
          name: e.name,
          cnic: e.cnic,
          contact: "0300-1234567",
          designation: e.designation,
          department: e.dept,
          joiningDate: new Date("2020-01-15"),
          salary: e.salary,
          status: "ACTIVE",
        },
      })
    )
  );

  const [ahmed, sara, bilal, imran, naveed, tariq, farooq, ayesha] = employees;

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
      { feeType: "WATER_TANKER", name: "Water Tanker Delivery", amount: 2500, effectiveFrom: new Date("2025-01-01"), status: "ACTIVE", createdById: admin.id },
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
    ],
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: "society_name", value: "Green Valley Housing Society", label: "Society Name" },
      { key: "require_bank_clearance_for_transfer", value: "true", label: "Block transfer if active mortgage" },
      { key: "open_file_expiry_alert_days", value: "30", label: "Open file expiry alert (days)" },
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
      applicantName: owner3.ownerName,
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
        plotType: i % 7 === 0 ? "COMMERCIAL" : "RESIDENTIAL",
        ownershipStatus: "ACTIVE",
        possessionStatus: i % 4 === 0 ? "ISSUED" : "NOT_APPLIED",
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

  // Pending transfer
  await prisma.transfer.create({
    data: {
      transferNumber: "TRD-0119",
      trdNumber: "TRD-0119",
      plotId: plot123.id,
      status: "PAYMENT_PENDING",
      currentStep: 7,
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

  await prisma.payment.create({
    data: {
      receiptNumber: "RCPT-00950",
      plotId: plot123.id,
      feeType: "TRANSFER",
      feeConfigId: transferFee.id,
      amount: 50000,
      poAmount: 50000,
      poNumber: "PO-88991",
      bankName: "Meezan Bank",
      poDate: new Date(),
      status: "SUBMITTED",
      paymentMethod: "PO",
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
  const tanker1 = await prisma.waterTanker.create({
    data: { tankerCode: "WT-01", capacityLiters: 5000, driverId: tariq.id },
  });
  const tanker2 = await prisma.waterTanker.create({
    data: { tankerCode: "WT-02", capacityLiters: 3000, driverId: tariq.id },
  });

  await prisma.tankerDelivery.createMany({
    data: [
      {
        tankerId: tanker1.id,
        plotId: plot123.id,
        streetArea: "E-17 Street 12",
        distributionDate: today,
        charges: 2500,
        paymentStatus: "PAID",
        receiptNumber: "RCPT-00980",
        status: "COMPLETED",
      },
      {
        tankerId: tanker1.id,
        plotId: plot456.id,
        streetArea: "E-17 Street 4",
        distributionDate: today,
        charges: 2500,
        paymentStatus: "UNPAID",
        status: "SCHEDULED",
      },
      {
        tankerId: tanker2.id,
        customerName: "Walk-in",
        streetArea: "F-11 Street 7",
        distributionDate: today,
        charges: 2500,
        paymentStatus: "PAID",
        receiptNumber: "RCPT-00981",
        status: "COMPLETED",
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
