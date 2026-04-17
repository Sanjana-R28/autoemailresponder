import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, RefreshCw, Wrench, XCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type DiagnosticCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  action: string;
};

type GmailDiagnostics = {
  readyToConnect: boolean;
  readyToAutoRespond: boolean;
  redirectUri: string | null;
  googleCloudRequiredRedirectUri: string | null;
  requiredScopes: string[];
  connectedAccount: { email: string | null; name: string | null } | null;
  commonAccessDeniedFixes: string[];
  checks: DiagnosticCheck[];
};

async function fetchDiagnostics(): Promise<GmailDiagnostics> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/gmail/diagnostics`);

  if (!response.ok) {
    throw new Error(`Diagnostics failed with status ${response.status}`);
  }

  return response.json();
}

function StatusIcon({ status }: { status: DiagnosticCheck["status"] }) {
  if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === "warn") return <AlertTriangle className="w-5 h-5 text-amber-400" />;
  return <XCircle className="w-5 h-5 text-rose-500" />;
}

function StatusBadge({ status }: { status: DiagnosticCheck["status"] }) {
  const className =
    status === "pass"
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
      : status === "warn"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
        : "bg-rose-500/15 text-rose-500 border-rose-500/20";

  return (
    <Badge variant="outline" className={className}>
      {status === "pass" ? "Ready" : status === "warn" ? "Action needed" : "Missing"}
    </Badge>
  );
}

export default function Diagnostics() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["gmail-diagnostics"],
    queryFn: fetchDiagnostics,
  });

  const copyRedirectUri = async () => {
    if (!data?.googleCloudRequiredRedirectUri) return;
    await navigator.clipboard.writeText(data.googleCloudRequiredRedirectUri);
    toast({ description: "Redirect URL copied" });
  };

  return (
    <AppLayout>
      <div className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Gmail Diagnostics</h1>
            <p className="text-muted-foreground text-lg">
              Check every setup step needed for Gmail connection and automatic replies.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-36 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : isError || !data ? (
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-500">
                <XCircle className="w-5 h-5" />
                Diagnostics unavailable
              </CardTitle>
              <CardDescription>The app could not load Gmail diagnostics. Refresh and try again.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card className="border-border bg-card/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-primary" />
                      Setup Summary
                    </CardTitle>
                    <CardDescription>
                      {data.readyToAutoRespond
                        ? "Gmail is connected and automatic replies are ready."
                        : data.readyToConnect
                          ? "Setup is ready. Connect Gmail to enable automatic replies."
                          : "Some setup steps still need attention before Gmail can connect."}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      data.readyToAutoRespond
                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                        : data.readyToConnect
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                    }
                  >
                    {data.readyToAutoRespond ? "Auto-pilot ready" : data.readyToConnect ? "Ready to connect" : "Needs setup"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Google Cloud Authorized Redirect URI
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <code className="text-sm break-all text-foreground">
                      {data.googleCloudRequiredRedirectUri ?? "No redirect URL available"}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyRedirectUri}
                      disabled={!data.googleCloudRequiredRedirectUri}
                      className="gap-2 shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                      Open Google Credentials
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener noreferrer">
                      Open Gmail API
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.checks.map((check) => (
                <Card key={check.id} className="border-border bg-card/50">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <StatusIcon status={check.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold">{check.label}</h3>
                          <StatusBadge status={check.status} />
                        </div>
                        <p className="text-sm text-muted-foreground break-words">{check.detail}</p>
                        {check.status !== "pass" && (
                          <p className="text-sm text-foreground mt-3 rounded-md border border-border bg-background/50 p-3">
                            {check.action}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle>Access denied fixes</CardTitle>
                <CardDescription>Use these when Google shows “access denied” during Gmail authorization.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {data.commonAccessDeniedFixes.map((fix) => (
                    <li key={fix} className="flex gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle>Required Gmail permissions</CardTitle>
                <CardDescription>These scopes are requested so the app can read unread messages and send replies.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.requiredScopes.map((scope) => (
                    <code key={scope} className="block rounded-md border border-border bg-background/50 p-3 text-xs break-all">
                      {scope}
                    </code>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}