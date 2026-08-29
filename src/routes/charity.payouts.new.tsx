import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDZD } from "@/lib/format";
import { getCharityDashboard } from "@/lib/server/charity/dashboard.server";
import { requestMyPayout } from "@/lib/server/charity/payouts.server";

export const Route = createFileRoute("/charity/payouts/new")({
  head: () => ({ meta: [{ title: "طلب سحب جديد | حملة" }] }),
  component: NewPayoutPage,
});

const formSchema = z.object({
  amount: z.coerce.number().int().min(1000, "الحد الأدنى 1,000 دج").max(50_000_000),
  method: z.enum(["ccp", "bank", "baridimob"]),
  account_name: z.string().min(2, "أدخل اسم صاحب الحساب").max(120),
  account_number: z.string().min(4, "أدخل رقم الحساب").max(40),
  bank_name: z.string().optional(),
  rib: z.string().optional(),
  phone: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.method === "ccp" && d.account_number.length < 4) {
    ctx.addIssue({ code: "custom", path: ["account_number"], message: "رقم CCP قصير" });
  }
  if (d.method === "bank") {
    if (!d.bank_name || d.bank_name.length < 2) {
      ctx.addIssue({ code: "custom", path: ["bank_name"], message: "أدخل اسم البنك" });
    }
    if (!d.rib || d.rib.length < 8) {
      ctx.addIssue({ code: "custom", path: ["rib"], message: "أدخل RIB صحيح" });
    }
  }
  if (d.method === "baridimob") {
    if (!d.phone || !/^0(5|6|7)[0-9]{8}$/.test(d.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "رقم BaridimMob غير صالح" });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

function NewPayoutPage() {
  const navigate = useNavigate();
  const fetchBalances = useServerFn(getCharityDashboard);
  const request = useServerFn(requestMyPayout);
  const balancesQ = useQuery({
    queryKey: ["charity-dashboard"],
    queryFn: () => fetchBalances({ data: {} }),
  });

  const { register, handleSubmit, formState, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      method: "ccp",
      account_name: "",
      account_number: "",
      bank_name: "",
      rib: "",
      phone: "",
    },
  });
  const method = watch("method");
  const amount = watch("amount");

  const submitMut = useMutation({
    mutationFn: (values: FormValues) => {
      const { amount, method, account_name, account_number, bank_name, rib, phone } = values;
      const destination: Record<string, string> = { method, account_name, account_number };
      if (method === "bank") {
        destination.bank_name = bank_name ?? "";
        destination.rib = rib ?? "";
      }
      if (method === "baridimob") destination.phone = phone ?? "";
      return request({ data: { amount, destination } });
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب السحب. سيتم مراجعته من قبل الإدارة.");
      void navigate({ to: "/charity/payouts" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = balancesQ.data?.balances.availableBalanceDzd ?? 0;
  const overLimit = amount > available;

  return (
    <div className="min-h-screen bg-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">طلب سحب جديد</h1>
        <p className="mt-1 text-sm text-subtle-foreground">سيتم مراجعة طلبك من قبل إدارة حملة.</p>

        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="rounded-xl bg-primary-soft p-4 text-sm">
              <p className="text-subtle-foreground">الرصيد المتاح للسحب</p>
              <p className="text-2xl font-bold text-primary-strong">{formatDZD(available)}</p>
            </div>

            <form onSubmit={handleSubmit((v) => submitMut.mutate(v))} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="amount">المبلغ (دج)</Label>
                <Input id="amount" type="number" {...register("amount")} />
                {overLimit ? <p className="mt-1 text-xs text-destructive">المبلغ يتجاوز الرصيد المتاح.</p> : null}
                {formState.errors.amount ? <p className="mt-1 text-xs text-destructive">{formState.errors.amount.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="method">طريقة السحب</Label>
                <select
                  id="method"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("method")}
                >
                  <option value="ccp">CCP</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="baridimob">بريدي موب</option>
                </select>
              </div>
              <div>
                <Label htmlFor="account_name">اسم صاحب الحساب</Label>
                <Input id="account_name" {...register("account_name")} />
                {formState.errors.account_name ? <p className="mt-1 text-xs text-destructive">{formState.errors.account_name.message}</p> : null}
              </div>
              {method === "ccp" ? (
                <div>
                  <Label htmlFor="account_number">رقم CCP</Label>
                  <Input id="account_number" {...register("account_number")} />
                  {formState.errors.account_number ? <p className="mt-1 text-xs text-destructive">{formState.errors.account_number.message}</p> : null}
                </div>
              ) : null}
              {method === "bank" ? (
                <>
                  <div>
                    <Label htmlFor="bank_name">اسم البنك</Label>
                    <Input id="bank_name" {...register("bank_name")} />
                    {formState.errors.bank_name ? <p className="mt-1 text-xs text-destructive">{formState.errors.bank_name.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="rib">RIB (24 رقم)</Label>
                    <Input id="rib" {...register("rib")} />
                    {formState.errors.rib ? <p className="mt-1 text-xs text-destructive">{formState.errors.rib.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="account_number">رقم الحساب</Label>
                    <Input id="account_number" {...register("account_number")} />
                  </div>
                </>
              ) : null}
              {method === "baridimob" ? (
                <div>
                  <Label htmlFor="phone">رقم الهاتف (BaridimMob)</Label>
                  <Input id="phone" inputMode="tel" {...register("phone")} />
                  {formState.errors.phone ? <p className="mt-1 text-xs text-destructive">{formState.errors.phone.message}</p> : null}
                </div>
              ) : null}
              <Button type="submit" disabled={submitMut.isPending || overLimit} className="w-full">
                {submitMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                إرسال الطلب
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
