import { Skeleton } from '@/components/ui/skeleton'

// Shared fallback streamed for any [orgSlug] sub-route that doesn't define its
// own loading.tsx. Decouples FCP from the page's server data fetch — the user
// sees a stable skeleton instantly instead of a blank screen.
export default function OrgSegmentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
