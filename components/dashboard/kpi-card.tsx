import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  suffix?: string
  icon: LucideIcon
  color?: "blue" | "green" | "amber" | "red" | "purple"
  trend?: { value: number; label: string }
  trendInverted?: boolean
  subtitle?: string
  secondaryValue?: string
  onClick?: () => void
  className?: string
}

const borderColors = {
  blue: "#3B82F6",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#A855F7",
}

const iconBgColors = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  green: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
}

export function KPICard({
  title,
  value,
  suffix,
  icon: Icon,
  color = "blue",
  trend,
  trendInverted = false,
  subtitle,
  secondaryValue,
  onClick,
  className,
}: KPICardProps) {
  const trendPositive = trend && trend.value > 0
  const trendNegative = trend && trend.value < 0
  const TrendIcon = trendPositive ? TrendingUp : trendNegative ? TrendingDown : Minus

  // When trendInverted, positive trend = bad (red), negative = good (green)
  const trendColor = trend
    ? trendPositive
      ? trendInverted ? "text-red-500" : "text-green-600"
      : trendNegative
        ? trendInverted ? "text-green-600" : "text-red-500"
        : "text-muted-foreground"
    : ""

  return (
    <Card
      className={cn(
        "gap-0 py-0 overflow-hidden shadow-sm",
        onClick && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      style={{ borderLeft: `4px solid ${borderColors[color]}` }}
      onClick={onClick}
    >
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate mb-0.5">{title}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground/70 mb-1.5">{subtitle}</p>
            )}
            <p className="text-3xl font-bold tabular-nums leading-none">
              {value}
              {suffix && <span className="text-xl ml-1 font-semibold">{suffix}</span>}
            </p>
            {secondaryValue && (
              <p className="text-sm text-muted-foreground mt-1">{secondaryValue}</p>
            )}
          </div>
          <div className={cn("rounded-full p-2 shrink-0", iconBgColors[color])}>
            <Icon className="size-4" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-1 mt-3 text-xs font-medium", trendColor)}>
            <TrendIcon className="size-3 shrink-0" />
            <span>
              {trend.value > 0 ? "+" : ""}
              {Math.abs(trend.value).toFixed(1)}
              {"% "}
              {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
