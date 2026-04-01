"use client"

import { useActivities } from "@/hooks/use-activities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, formatDate } from "@/lib/utils"
import { Activity, FileText, AlertTriangle, Package, Building2 } from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: FileText,
  anomaly: AlertTriangle,
  product: Package,
  supplier: Building2,
}

interface ActivityTimelineProps { className?: string }

export function ActivityTimeline({ className }: ActivityTimelineProps) {
  const { activities, loading } = useActivities(15)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4" />
          Activité récente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          <div className="px-6 pb-4 space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente</p>
            ) : (
              activities.map((activity) => {
                const Icon = iconMap[activity.entityType] || Activity
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="bg-muted rounded-full p-1.5 shrink-0 mt-0.5">
                      <Icon className="size-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(activity.created)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
