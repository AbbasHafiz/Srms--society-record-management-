import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCalendarPeriod, getSocietyLetterhead } from "@/lib/print";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function SalarySlipPrintPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const [payment, letterhead] = await Promise.all([
    prisma.salaryPayment.findUnique({
      where: { id: paymentId },
      include: {
        employee: {
          include: { orgRole: { select: { name: true } } },
        },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!payment || payment.employeeId !== id) notFound();

  const employee = payment.employee;

  return (
    <PrintPageShell backHref={`/employees/${employee.id}`} backLabel="Back to employee">
      <PrintDocument
        letterhead={letterhead}
        title="Salary Slip"
        subtitle={`${formatCalendarPeriod(payment.periodYear, payment.periodMonth)} · ${labelize(payment.status)}`}
        serialLabel="Employee"
        serial={employee.employeeCode}
        date={payment.paidAt ?? payment.createdAt}
        parties={[
          { label: "Name", value: employee.name },
          { label: "Role", value: employee.orgRole?.name || labelize(employee.employmentType) },
        ]}
        preparedBy="Accounts / HR"
        receivedBy={employee.name}
      >
        <PrintSection title="Payment">
          <dl>
            <PrintRow label="Period" value={formatCalendarPeriod(payment.periodYear, payment.periodMonth)} />
            <PrintRow label="Amount (PKR)" value={formatCurrency(payment.amount)} />
            <PrintRow label="Status" value={labelize(payment.status)} />
            <PrintRow label="Paid on" value={formatDate(payment.paidAt)} />
            <PrintRow label="Department" value={employee.department} />
            <PrintRow label="CNIC" value={employee.cnic} />
          </dl>
        </PrintSection>
        {payment.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{payment.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
