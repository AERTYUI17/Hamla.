import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadedFile {
  file: File;
  previewUrl: string | null;
}

export function FileUploader({
  accept,
  maxBytes,
  maxFiles,
  onChange,
  value,
  allowedMimeLabel = "PDF أو صور (JPG, PNG)",
}: {
  accept: string;
  maxBytes: number;
  maxFiles: number;
  onChange: (files: UploadedFile[]) => void;
  value: UploadedFile[];
  allowedMimeLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...value];
    const allowed = accept.split(",").map((t) => t.trim());
    for (const f of Array.from(list)) {
      if (next.length >= maxFiles) {
        setError(`الحد الأقصى ${maxFiles} ملفات.`);
        break;
      }
      if (f.size > maxBytes) {
        setError(`الملف "${f.name}" يتجاوز الحد المسموح (${Math.round(maxBytes / 1024 / 1024)} ميغابايت).`);
        continue;
      }
      if (!allowed.includes(f.type)) {
        setError(`نوع الملف "${f.name}" غير مسموح. الأنواع المسموحة: ${allowedMimeLabel}.`);
        continue;
      }
      next.push({
        file: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      });
    }
    onChange(next);
  }

  function remove(idx: number) {
    const next = value.slice();
    const removed = next.splice(idx, 1)[0];
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border-2 border-dashed border-border bg-secondary/40 p-6 text-center"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto size-6 text-subtle-foreground" />
        <p className="mt-2 text-sm text-foreground">اسحب الملفات هنا أو</p>
        <p className="text-xs text-subtle-foreground">
          {allowedMimeLabel} — حد أقصى {Math.round(maxBytes / 1024 / 1024)} ميغابايت لكل ملف
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          اختر ملفاً
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((uf, idx) => (
            <li
              key={`${uf.file.name}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                {uf.file.type.startsWith("image/") ? (
                  <ImageIcon className="size-4 shrink-0 text-subtle-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-subtle-foreground" />
                )}
                <span className="truncate">{uf.file.name}</span>
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {Math.round(uf.file.size / 1024)} KB
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => remove(idx)}
                aria-label="إزالة"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
