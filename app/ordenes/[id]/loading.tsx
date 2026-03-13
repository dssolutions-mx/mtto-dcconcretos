import { Skeleton } from "@/components/ui/skeleton"

export default function WorkOrderDetailsLoading() {
  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="mb-6">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="mb-6">
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
