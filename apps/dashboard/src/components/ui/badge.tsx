import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-px text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-zinc-900 bg-zinc-900 text-zinc-50",
        progress: "border-blue-200 bg-blue-50 text-blue-700",
        done: "border-green-200 bg-green-50 text-green-700",
        spam: "border-red-200 bg-red-50 text-red-700",
        outline: "border-border bg-background text-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export function statusVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  if (status === "new") return "default";
  if (status === "in_progress") return "progress";
  if (status === "done") return "done";
  if (status === "spam") return "spam";
  return "outline";
}

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
