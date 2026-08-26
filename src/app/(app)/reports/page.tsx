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
  CalendarCheck,
  CircleDollarSign,
  IdCard,
  Receipt,
} from "lucide-react";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    title: "Transfer Report",
    description: "Transfers by date range with status breakdown and CSV export.",
    href: "/reports/transfers",
    icon: ArrowLeftRight,
    aggregated: true,
  },
  {
    title: "Open Files Expiring",
    description: "Dealer open files nearing expiry within N days.",
    href: "/reports/open-files",
    icon: FolderOpen,
    aggregated: true,
  },
  {
    title: "Attendance Summary",
    description: "Monthly present / absent / leave rollup by employee.",
    href: "/reports/attendance",
    icon: CalendarCheck,
    aggregated: true,
  },
  {
    title: "Finance MTD",
    description: "Posted revenue and expenses by category for a month.",
    href: "/reports/finance",
    icon: CircleDollarSign,
    aggregated: true,
  },
  {
    title: "Plot Register",
    description: "Full plot master with ownership status flags.",
    href: "/plots",
    icon: MapPinned,
  },
  {
    title: "Membership Register",
    description: "Active, transferred, and deceased membership numbers.",
    href: "/memberships",
    icon: IdCard,
  },
  {
    title: "Ownership History",
    description: "All ownership records including transferred.",
    href: "/owners?status=TRANSFERRED",
    icon: Users,
  },
  {
    title: "Annual Charges",
    description: "Plot charge billing and payment status.",
    href: "/annual-charges",
    icon: Receipt,
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
        description="Aggregated operational reports with CSV export, plus quick links to filtered registers."
      />

      <h2 className="mb-3 font-display text-lg font-semibold text-slate-800">Aggregated Reports</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORTS.filter((r) => "aggregated" in r && r.aggregated).map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full border-teal-100 transition-shadow hover:shadow-md">
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

      <h2 className="mb-3 font-display text-lg font-semibold text-slate-800">Quick Registers</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.filter((r) => !("aggregated" in r && r.aggregated)).map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="rounded-lg bg-slate-50 p-2 text-slate-700">
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
