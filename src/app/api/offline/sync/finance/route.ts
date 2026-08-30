import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createFinanceTransaction } from "@/lib/finance";
import { PAYMENT_METHODS } from "@/lib/finance-constants";
import type { FinanceTransactionStatus, PaymentMethod } from "@/generated/prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Connect to sign in again before syncing the queue." },
      { status: 401 },
    );
  }
  if (!hasPermission(session.user.role, "manage_finance")) {
    return NextResponse.json({ ok: false, error: "You cannot post finance entries." }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid queue payload." }, { status: 400 });
  }

  const categoryId = String(body.categoryId || "").trim();
  const amount = Number(body.amount);
  const paymentMethod = String(body.paymentMethod || "CASH") as PaymentMethod;
  if (!categoryId) return NextResponse.json({ ok: false, error: "Category is required." }, { status: 400 });
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Amount must be greater than zero." }, { status: 400 });
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ ok: false, error: "Invalid payment method." }, { status: 400 });
  }

  const txn = await createFinanceTransaction({
    categoryId,
    amount,
    txnDate: body.txnDate ? new Date(body.txnDate) : new Date(),
    paymentMethod,
    reference: String(body.reference || "").trim() || null,
    plotId: String(body.plotId || "").trim() || null,
    ownershipId: null,
    employeeId: String(body.employeeId || "").trim() || null,
    description: (() => {
      const note = String(body.description || "").trim();
      if (!note) return "Queued offline";
      return note.startsWith("[Queued offline]") ? note : `[Queued offline] ${note}`;
    })(),
    status: (body.postNow === "on" ? "POSTED" : "DRAFT") as FinanceTransactionStatus,
    createdById: session.user.id,
  });

  return NextResponse.json({ ok: true, id: txn.id });
}
