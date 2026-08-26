import Link from "next/link";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPinned,
  ArrowLeftRight,
  Users,
  FolderOpen,
  Wallet,
  Landmark,
  ShieldCheck,
  ScrollText,
  ClipboardList,
} from "lucide-react";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    title: "Plot Register",
    description: "Full plot master with ownership status flags.",
    href: "/plots",
    icon: MapPinned,
  },
  {
    title: "Transfer Pipeline",
    description: "Active and pending ownership transfers.",
    href: "/transfers?status=PAYMENT_PENDING",
    icon: ArrowLeftRight,
  },
  {
    title: "Ownership History",
    description: "All ownership records including transferred.",
    href: "/owners?status=TRANSFERRED",
    icon: Users,
  },
  {
    title: "Open Files Expiring",
    description: "Dealer open files nearing expiry.",
    href: "/open-files?status=ACTIVE",
    icon: FolderOpen,
  },
  {
    title: "Pending Payments",
    description: "Unverified payment receipts awaiting finance.",
    href: "/payments?status=PENDING",
    icon: Wallet,
  },
  {
    title: "Active Mortgages",
    description: "Bank restrictions blocking transfers.",
    href: "/mortgages",
    icon: Landmark,
  },
  {
    title: "Pending NOCs",
    description: "NOC applications under review.",
    href: "/noc?status=UNDER_REVIEW",
    icon: ShieldCheck,
  },
  {
    title: "Pending NECs",
    description: "NEC applications under review.",
    href: "/nec?status=UNDER_REVIEW",
    icon: ScrollText,
  },
  {
    title: "Audit Trail",
    description: "System-wide change history.",
    href: "/audit",
    icon: ClipboardList,
  },
] as const;

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Quick access to filtered operational views and registers."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="rounded-lg bg-teal-50 p-2 text-teal-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{report.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
