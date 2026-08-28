import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";

export function PrintButton({
  href,
  label = "Print / Save PDF",
  variant = "outline",
  size = "default",
}: {
  href: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <Link href={href} target="_blank" rel="noreferrer">
      <Button type="button" variant={variant} size={size}>
        {label}
      </Button>
    </Link>
  );
}
