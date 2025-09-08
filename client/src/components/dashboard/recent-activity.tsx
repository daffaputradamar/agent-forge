import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export default function RecentActivity() {
  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  // Generate activity items from recent data
  const activities = [
    ...(conversations?.slice(0, 2).map(conv => ({
      id: conv.id,
      message: `New conversation started`,
      timestamp: conv.createdAt,
      type: "conversation" as const,
    })) || []),
    ...(agents?.slice(0, 3).map(agent => ({
      id: agent.id,
      message: `Agent "${agent.name}" ${agent.status === 'active' ? 'is active' : 'was created'}`,
      timestamp: agent.createdAt,
      type: "agent" as const,
    })) || []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

  const getActivityColor = (type: string) => {
    switch (type) {
      case "conversation":
        return "bg-primary";
      case "agent":
        return "bg-green-600";
      default:
        return "bg-blue-600";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No recent activity
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full mt-2`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" data-testid={`activity-${activity.type}-${activity.id}`}>
                    {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
