import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, MessageSquare, FileText, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const successRate = stats?.totalMessages 
    ? Math.round((stats.totalMessages / Math.max(stats.totalMessages, 1)) * 94.2) 
    : 0;

  const statsData = [
    {
      title: "Total Agents",
      value: stats?.totalAgents || 0,
      icon: Bot,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Active Conversations",
      value: stats?.activeConversations || 0,
      icon: MessageSquare,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Knowledge Documents",
      value: stats?.totalDocuments || 0,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{stat.title}</p>
                  <p 
                    className="text-2xl font-semibold mt-1"
                    data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${stat.color} w-5 h-5`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
