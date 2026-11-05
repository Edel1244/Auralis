"use client";

import { AlertTriangle, SearchX } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import type { ApiClientError } from "@/lib/api";
import { Button } from "./Button";
import { EmptyState, Skeleton } from "./misc";

/** Standard loading / error rendering for data-driven pages. */
export function PageState({ loading, error, onRetry }: { loading: boolean; error: ApiClientError | null; onRetry?: () => void }) {
  const t = useT();
  if (error) {
    if (error.status === 404)
      return <EmptyState icon={<SearchX size={28} />} title={t("errors.notFound")} body={t("errors.notFoundHint")} />;
    return (
      <EmptyState
        icon={<AlertTriangle size={28} />}
        title={error.code === "NETWORK" ? t("errors.network") : t("errors.generic")}
        body={error.message}
        action={onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
      />
    );
  }
  if (loading) return <PageSkeleton />;
  return null;
}

export function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
