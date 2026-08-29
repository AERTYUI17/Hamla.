import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  HandHeart,
  Home,
  ListChecks,
  ScrollText,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { HamlaMark } from "@/components/hamla/logo";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const ITEMS: NavItem[] = [
  { to: "/admin", label: "الرئيسية", icon: Home },
  { to: "/admin/charities", label: "طلبات الجمعيات", icon: Building2 },
  { to: "/admin/campaigns", label: "الحملات", icon: HandHeart },
  { to: "/admin/payouts", label: "السحوبات", icon: Wallet },
  { to: "/admin/donations", label: "التبرعات", icon: ListChecks },
  { to: "/admin/audit-log", label: "سجل النشاط", icon: ScrollText },
  { to: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminSidebar() {
  const { location } = useRouterState();
  const pathname = location.pathname;

  return (
    <aside className="hidden w-60 shrink-0 border-l border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <HamlaMark className="h-7" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">لوحة الإدارة</p>
          <p className="text-[10px] text-subtle-foreground">حملة</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2 text-sm">
        {ITEMS.map((item) => {
          const active =
            item.to === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-foreground/80 transition-colors",
                active ? "bg-primary-soft text-primary-strong" : "hover:bg-accent",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-[10px] text-subtle-foreground">
        <p className="flex items-center gap-1">
          <ShieldCheck className="size-3" /> الإصدار 1.0
        </p>
      </div>
    </aside>
  );
}
