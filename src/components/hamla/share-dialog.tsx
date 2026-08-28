import { Check, Copy, Facebook, Link2, MessageCircle, Twitter } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ShareDialog({
  open,
  onOpenChange,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.href;
  const text = encodeURIComponent(`${title} — ساهم معنا`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const links = [
    {
      label: "واتساب",
      icon: MessageCircle,
      href: `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`,
    },
    {
      label: "فيسبوك",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      label: "إكس",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>شارك هذه الحملة</DialogTitle>
          <DialogDescription>
            المشاركة مجانية، وهي من أكثر الطرق فعالية لدعم الحملة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-xs transition-colors hover:bg-accent"
            >
              <l.icon className="size-5 text-primary-strong" />
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-subtle-foreground" />
            <Input readOnly value={url} className="ps-9 text-xs" />
          </div>
          <Button type="button" variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "تم النسخ" : "نسخ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
