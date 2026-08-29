import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCard } from "@/components/hamla/campaign-card";
import { listPublicCampaigns } from "@/lib/server/donor/campaigns.server";

export const Route = createFileRoute("/c/")({
  head: () => ({ meta: [{ title: "الحملات | حملة" }] }),
  component: CampaignsListPage,
});

const SORTS = [
  { value: "recent", label: "الأحدث" },
  { value: "most_funded", label: "الأكثر تمويلاً" },
  { value: "ending_soon", label: "ينتهي قريباً" },
] as const;

const CATEGORIES = [
  { value: "", label: "الكل" },
  { value: "education", label: "تعليم" },
  { value: "health", label: "صحة" },
  { value: "family", label: "أسر" },
  { value: "emergency", label: "طوارئ" },
  { value: "orphan", label: "أيتام" },
  { value: "mosque", label: "مساجد" },
  { value: "other", label: "أخرى" },
] as const;

function CampaignsListPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<typeof SORTS[number]["value"]>("recent");
  const [category, setCategory] = useState("");
  const [certifiedOnly, setCertifiedOnly] = useState(false);

  const fetch = useServerFn(listPublicCampaigns);
  const q = useQuery({
    queryKey: ["public-campaigns", sort, category, certifiedOnly],
    queryFn: () =>
      fetch({
        data: {
          sort,
          category: category || null,
          certifiedOnly: certifiedOnly || null,
          verifiedCharityOnly: null,
          limit: 24,
          offset: 0,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الحملات</h1>
          <p className="text-sm text-subtle-foreground">ادعم حملة تستحق.</p>
        </div>
        <div className="flex items-center gap-2">
          {SORTS.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={sort === s.value ? "default" : "outline"}
              onClick={() => setSort(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الحملات..."
            className="pe-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={certifiedOnly}
            onChange={(e) => setCertifiedOnly(e.target.checked)}
          />
          الحملات الموثقة فقط
        </label>
      </div>

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : q.isError || !q.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
      ) : q.data.length === 0 ? (
        <p className="text-sm text-subtle-foreground">لا توجد حملات تطابق البحث.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data
            .filter((c) => !search || c.title.includes(search))
            .map((c) => (
              <CampaignCard key={c.id} campaign={c as any} />
            ))}
        </div>
      )}
    </div>
  );
}
