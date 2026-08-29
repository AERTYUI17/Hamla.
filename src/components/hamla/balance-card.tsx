import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDZD } from "@/lib/format";
import { Wallet, TrendingUp, Hourglass, Users, Heart, ListChecks } from "lucide-react";

export interface CharityBalances {
  totalRaisedDzd: number;
  totalPaidDzd: number;
  availableBalanceDzd: number;
  pendingBalanceDzd: number;
  campaignCount: number;
  donorCount: number;
  donationCount: number;
}

export function BalanceGrid({ balances }: { balances: CharityBalances }) {
  const cards: { title: string; value: string; icon: ReactNode; tone: string }[] = [
    {
      title: "إجمالي التبرعات",
      value: formatDZD(balances.totalRaisedDzd),
      icon: <TrendingUp className="size-5" />,
      tone: "text-primary-strong",
    },
    {
      title: "الرصيد المتاح للسحب",
      value: formatDZD(balances.availableBalanceDzd),
      icon: <Wallet className="size-5" />,
      tone: "text-primary-strong",
    },
    {
      title: "السحوبات المعلقة",
      value: formatDZD(balances.pendingBalanceDzd),
      icon: <Hourglass className="size-5" />,
      tone: "text-highlight",
    },
    {
      title: "الحملات",
      value: balances.campaignCount.toString(),
      icon: <ListChecks className="size-5" />,
      tone: "text-foreground",
    },
    {
      title: "المتبرعون",
      value: balances.donorCount.toString(),
      icon: <Users className="size-5" />,
      tone: "text-foreground",
    },
    {
      title: "عدد التبرعات",
      value: balances.donationCount.toString(),
      icon: <Heart className="size-5" />,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-subtle-foreground">{c.title}</CardTitle>
            <span className={c.tone}>{c.icon}</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
