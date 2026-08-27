import type { OpenFileHolderType, PaymentMethod, SellerAppearance } from "@/generated/prisma/client";

export const OPEN_FILE_HOLDER_TYPES: OpenFileHolderType[] = ["INVESTOR", "DEALER"];

export const SELLER_APPEARANCES: SellerAppearance[] = ["IN_PERSON", "VIA_ATTORNEY"];

export const OPEN_FILE_CONSIDERATION_METHODS: PaymentMethod[] = [
  "CASH",
  "PO",
  "BANK_TRANSFER",
  "CHEQUE",
  "OTHER",
];

export const OPEN_FILE_SUPPORTING_DOC_TYPES = [
  { key: "supportingCnic", documentType: "CNIC" as const, label: "Seller / XYZ CNIC" },
  {
    key: "supportingPreviousTransfer",
    documentType: "PREVIOUS_TRANSFER" as const,
    label: "Previous transfer papers",
  },
  { key: "supportingSitePlan", documentType: "SITE_PLAN" as const, label: "Site plan" },
  { key: "supportingOther", documentType: "OPEN_FILE_DOCUMENT" as const, label: "Other plot document" },
] as const;

export function holderTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "INVESTOR":
      return "Investor";
    case "DEALER":
      return "Dealer (as purchaser of the file)";
    default:
      return "Investor / dealer";
  }
}

export function sellerAppearanceLabel(value: string | null | undefined): string {
  switch (value) {
    case "VIA_ATTORNEY":
      return "Seller appearing via attorney";
    case "IN_PERSON":
    default:
      return "Seller appearing in person";
  }
}

export const OPEN_FILE_STORY =
  "Open transfer — sold to investor/dealer; end purchaser not yet named.";
