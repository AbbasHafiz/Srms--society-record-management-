import { prisma } from "@/lib/db";

/** Atomically allocate the next number for a sequence key. Never reuses values. */
export async function nextSequence(key: string, fallbackPrefix: string, padLength = 4) {
  const seq = await prisma.$transaction(async (tx) => {
    const existing = await tx.numberSequence.findUnique({ where: { key } });
    if (!existing) {
      const created = await tx.numberSequence.create({
        data: { key, prefix: fallbackPrefix, nextValue: 2, padLength },
      });
      return { prefix: created.prefix, value: 1, padLength: created.padLength };
    }
    const updated = await tx.numberSequence.update({
      where: { key },
      data: { nextValue: { increment: 1 } },
    });
    return {
      prefix: updated.prefix,
      value: updated.nextValue - 1,
      padLength: updated.padLength,
    };
  });

  return `${seq.prefix}-${String(seq.value).padStart(seq.padLength, "0")}`;
}

export async function nextMembershipNumber() {
  return nextSequence("membership", process.env.MEMBERSHIP_PREFIX || "M", 4);
}

export async function nextAllotmentNumber() {
  return nextSequence("allotment", process.env.ALLOTMENT_PREFIX || "AL", 4);
}

export async function nextTransferNumber() {
  return nextSequence("transfer", process.env.TRANSFER_PREFIX || "TRD", 4);
}

export async function nextFileNumber() {
  return nextSequence("physical_file", process.env.FILE_PREFIX || "PF", 4);
}

export async function nextReceiptNumber() {
  return nextSequence("receipt", "RCPT", 5);
}

export async function nextOpenFileNumber() {
  return nextSequence("open_file", "OF", 4);
}

export async function nextEmployeeCode() {
  return nextSequence("employee", "EMP", 3);
}

export async function nextNocApplicationNumber() {
  return nextSequence("noc_application", "NOC", 4);
}

export async function nextNocNumber(sector?: string) {
  const prefix = sector ? `NOC-${sector.replace(/[^A-Za-z0-9]/g, "")}` : "NOC";
  return nextSequence("noc_issue", prefix, 4);
}

export async function nextFinanceTxnNumber() {
  return nextSequence("finance_txn", "FIN", 4);
}

export async function nextTankerBookingNumber() {
  return nextSequence("tanker_booking", "TB", 4);
}

export async function nextTankerBulkPurchaseNumber() {
  return nextSequence("tanker_bulk_purchase", "TBP", 4);
}

export async function nextPossessionApplicationNumber() {
  return nextSequence("possession_application", "POS", 4);
}

export async function nextPossessionLetterNumber(sector?: string) {
  const prefix = sector ? `PL-${sector.replace(/[^A-Za-z0-9]/g, "")}` : "PL";
  return nextSequence("possession_letter", prefix, 4);
}

export async function nextNecApplicationNumber() {
  return nextSequence("nec_application", "NEC-APP", 4);
}

export async function nextNecNumber(sector?: string) {
  const prefix = sector ? `NEC-${sector.replace(/[^A-Za-z0-9]/g, "")}` : "NEC";
  return nextSequence("nec_issue", prefix, 4);
}

export async function nextPoaNumber() {
  return nextSequence("poa", "POA", 4);
}

export async function nextTaxAssessmentNumber() {
  return nextSequence("tax_assessment", "FBR", 4);
}
