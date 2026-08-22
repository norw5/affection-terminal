import { cn } from "@/lib/cn";
// Terminal-styled tab bar built on Radix's accessible Tabs primitive. Single active tab
// with an accent underline; reused across module pages.
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-center gap-1 border-b border-border bg-panel px-1 py-1", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button">) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "focus-ring border-b-2 border-transparent px-3 py-1 text-xs uppercase tracking-wider text-text-faint",
        "data-[state=active]:border-accent data-[state=active]:text-accent",
        "hover:text-text",
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content value={value} className={cn("pt-4", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
