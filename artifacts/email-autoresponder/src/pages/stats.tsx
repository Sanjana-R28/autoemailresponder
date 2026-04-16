import { AppLayout } from "@/components/layout/app-layout";
import { useGetEmailStats } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Activity, Mail, Smile, Tag } from "lucide-react";

export default function Stats() {
  const { data: stats, isLoading } = useGetEmailStats();

  if (isLoading || !stats) {
    return (
      <AppLayout>
        <div className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
          <div>
            <Skeleton className="w-64 h-10 mb-2" />
            <Skeleton className="w-96 h-6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Format data for charts
  const sentimentData = [
    { name: "Positive", value: stats.sentimentBreakdown.Positive, color: "hsl(var(--chart-1))" },
    { name: "Neutral", value: stats.sentimentBreakdown.Neutral, color: "hsl(var(--chart-3))" },
    { name: "Negative", value: stats.sentimentBreakdown.Negative, color: "hsl(var(--destructive))" },
  ];

  const intentData = Object.entries(stats.intentBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const areaData = Object.entries(stats.areaBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <AppLayout>
      <div className="flex-1 p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Analytics</h1>
          <p className="text-muted-foreground text-lg">Insights from your automated inbox.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Processed</p>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Positive Sentiment</p>
                <Smile className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-emerald-500">
                {stats.total ? Math.round((stats.sentimentBreakdown.Positive / stats.total) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Top Intent</p>
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold truncate mt-1">
                {intentData.length > 0 ? intentData[0].name : "N/A"}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Top Area</p>
                <Tag className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold truncate mt-1">
                {areaData.length > 0 ? areaData[0].name : "N/A"}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Sentiment Distribution</CardTitle>
              <CardDescription>Overall tone of incoming emails</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Intent Breakdown</CardTitle>
              <CardDescription>What users are asking about</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={120} />
                  <RechartsTooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Emails processed over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.recentActivity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                />
                <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}