import type {
  FinanceTransactionStatus,
  PaymentMethod,
} from "@/generated/prisma/client";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "PO",
  "BANK_TRANSFER",
  "CHEQUE",
  "OTHER",
];

export const TXN_STATUSES: FinanceTransactionStatus[] = ["DRAFT", "POSTED", "VOID"];
