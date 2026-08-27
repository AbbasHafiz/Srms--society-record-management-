export function possessionLabel(status: string): string {
  switch (status) {
    case "ISSUED":
      return "Possession Issued";
    case "APPROVED":
      return "Possession Approved";
    case "PENDING":
      return "Possession Pending";
    case "APPLIED":
      return "Possession Applied";
    case "REJECTED":
      return "Possession Rejected";
    case "NOT_APPLIED":
    default:
      return "Non-Possession / Not Applied";
  }
}

export function isNonPossession(possessionStatus: string, developmentStatus: string): boolean {
  return possessionStatus !== "ISSUED" || developmentStatus === "UNDEVELOPED" || developmentStatus === "VACANT";
}
