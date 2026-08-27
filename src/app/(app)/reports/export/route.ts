import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { startOfMonth, endOfMonth } from "date-fns";
import { LIVE_OPEN_FILE_STATUSES } from "@/lib/open-files";

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "export_reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = req.nextUrl.searchParams.get("report");
  let csv = "";
  let filename = "report.csv";

  if (report === "transfers") {
    const from = new Date(req.nextUrl.searchParams.get("from") ?? startOfMonth(new Date()).toISOString());
    const to = new Date(req.nextUrl.searchParams.get("to") ?? endOfMonth(new Date()).toISOString());
    const status = req.nextUrl.searchParams.get("status");

    const transfers = await prisma.transfer.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(status ? { status: status as never } : {}),
      },
      include: { plot: true },
      orderBy: { createdAt: "desc" },
    });

    csv = toCsv(
      ["Transfer Number", "Plot", "Type", "Seller", "Status", "Created"],
      transfers.map((t) => [
        t.transferNumber,
        `${t.plot.sector}/${t.plot.block}-${t.plot.plotNumber}`,
        t.transferType,
        t.sellerName,
        t.status,
        t.createdAt.toISOString().slice(0, 10),
      ])
    );
    filename = "transfers-report.csv";
  } else if (report === "open-files") {
    const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const files = await prisma.openFile.findMany({
      where: { status: { in: LIVE_OPEN_FILE_STATUSES }, expiryDate: { lte: cutoff } },
      include: { plot: true },
      orderBy: { expiryDate: "asc" },
    });

    csv = toCsv(
      ["Open File", "Plot", "Dealer", "Seller", "Expiry", "Status"],
      files.map((f) => [
        f.openFileNumber,
        `${f.plot.sector}/${f.plot.block}-${f.plot.plotNumber}`,
        f.dealerName,
        f.sellerName,
        f.expiryDate.toISOString().slice(0, 10),
        f.status,
      ])
    );
    filename = "open-files-expiring.csv";
  } else if (report === "attendance") {
    const monthStr = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split("-").map(Number);
    const from = startOfMonth(new Date(year, month - 1));
    const to = endOfMonth(new Date(year, month - 1));

    const records = await prisma.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      include: { employee: true },
    });

    const byEmployee = new Map<string, { name: string; code: string; present: number; absent: number; leave: number }>();
    for (const r of records) {
      const entry = byEmployee.get(r.employeeId) ?? {
        name: r.employee.name,
        code: r.employee.employeeCode,
        present: 0,
        absent: 0,
        leave: 0,
      };
      if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") entry.present++;
      else if (r.status === "ABSENT") entry.absent++;
      else if (r.status === "LEAVE") entry.leave++;
      byEmployee.set(r.employeeId, entry);
    }

    csv = toCsv(
      ["Employee Code", "Name", "Present", "Absent", "Leave"],
      [...byEmployee.values()].map((r) => [r.code, r.name, r.present, r.absent, r.leave])
    );
    filename = `attendance-${monthStr}.csv`;
  } else if (report === "finance") {
    const monthStr = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split("-").map(Number);
    const from = startOfMonth(new Date(year, month - 1));
    const to = endOfMonth(new Date(year, month - 1));

    const transactions = await prisma.financeTransaction.findMany({
      where: { txnDate: { gte: from, lte: to }, status: "POSTED" },
      include: { category: true },
      orderBy: { txnDate: "desc" },
    });

    csv = toCsv(
      ["Txn Number", "Category", "Type", "Amount", "Date", "Reference"],
      transactions.map((t) => [
        t.txnNumber,
        t.category.name,
        t.type,
        Number(t.amount),
        t.txnDate.toISOString().slice(0, 10),
        t.reference,
      ])
    );
    filename = `finance-${monthStr}.csv`;
  } else {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
