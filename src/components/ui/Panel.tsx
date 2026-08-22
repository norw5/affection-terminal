import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Panel({
  title,
  className,
  bodyClassName,
  children,
  actions,
}: {
  title?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("pane", className)}>
      {title && (
        <div className="pane-title">
          <span className="truncate">{title}</span>
          {actions && <span className="ml-auto flex items-center gap-3">{actions}</span>}
        </div>
      )}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}
