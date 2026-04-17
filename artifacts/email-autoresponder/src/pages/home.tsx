import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Copy, Check, Inbox, Bot, Play, Mail, XCircle, RefreshCw } from "lucide-react";
import { useProcessEmail, useGetGmailStatus, useGetGmailAuthUrl, useGmailAutorespond, useRevokeGmailAccess } from "@workspace/api-client-react";
import type { EmailAnalysisResult } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const emailFormSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  senderName: z.string().optional(),
  senderEmail: z.string().optional(),
});

function ResultCard({ result }: { result: EmailAnalysisResult }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(result.generatedReply);
    setCopied(true);
    toast({ description: "Reply copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const sentimentColor = 
    result.sentiment === "Positive" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" :
    result.sentiment === "Negative" ? "bg-rose-500/15 text-rose-500 border-rose-500/20" :
    "bg-slate-500/15 text-slate-400 border-slate-500/20";

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="border-b border-border/50 bg-secondary/50 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Analysis Complete
            </CardTitle>
            <CardDescription className="mt-1">AI has processed this email and drafted a response.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Badge variant="outline" className={sentimentColor}>{result.sentiment}</Badge>
            <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/20">{result.intent}</Badge>
            <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/20">{result.area}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Generated Reply</h4>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              <span className={copied ? "text-emerald-500" : "text-muted-foreground"}>{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
          <div className="p-4 rounded-lg bg-background/50 border border-border font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {result.generatedReply}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [result, setResult] = useState<EmailAnalysisResult | null>(null);

  const processEmail = useProcessEmail();
  const { data: gmailStatus, refetch: refetchGmailStatus, isLoading: isLoadingGmailStatus } = useGetGmailStatus();
  const { data: authUrl } = useGetGmailAuthUrl({ query: { enabled: !gmailStatus?.connected } });
  const autorespond = useGmailAutorespond();
  const revokeAccess = useRevokeGmailAccess();

  const form = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      subject: "",
      body: "",
      senderName: "",
      senderEmail: "",
    },
  });

  const getErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error ? error.message : fallback;
  };

  const onSubmit = (values: z.infer<typeof emailFormSchema>) => {
    processEmail.mutate({ data: values }, {
      onSuccess: (data) => {
        setResult(data);
        toast({ title: "Email processed successfully" });
      },
      onError: (error) => {
        toast({ title: "Failed to process email", description: getErrorMessage(error, "Please try again."), variant: "destructive" });
      }
    });
  };

  const handleAutoRespond = () => {
    autorespond.mutate(undefined, {
      onSuccess: (data) => {
        if (data.success && data.analysis) {
          setResult(data.analysis);
          toast({ title: "Auto-respond complete", description: data.message });
        } else {
          toast({ title: "Notice", description: data.message });
        }
      },
      onError: (error) => {
        toast({ title: "Auto-respond failed", description: getErrorMessage(error, "Please try again."), variant: "destructive" });
      }
    });
  };

  const handleRevoke = () => {
    revokeAccess.mutate(undefined, {
      onSuccess: () => {
        refetchGmailStatus();
        toast({ title: "Gmail disconnected" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Command Center</h1>
          <p className="text-muted-foreground text-lg">Test the AI manually or connect your inbox for autonomous processing.</p>
        </div>

        <Tabs defaultValue="manual" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="manual" className="gap-2"><Bot className="w-4 h-4" /> Manual Test</TabsTrigger>
            <TabsTrigger value="gmail" className="gap-2"><Mail className="w-4 h-4" /> Gmail Auto-Pilot</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Manual Input</CardTitle>
                <CardDescription>Paste an email below to see how the AI categorizes it and drafts a reply.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="senderName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Name (optional)</FormLabel>
                          <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="senderEmail" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Email (optional)</FormLabel>
                          <FormControl><Input placeholder="john@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl><Input placeholder="Issue with my recent invoice" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="body" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Body</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Paste the email content here..." className="min-h-[150px] resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={processEmail.isPending} className="w-full gap-2">
                      {processEmail.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      {processEmail.isPending ? "Processing with AI..." : "Process Email"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gmail" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Gmail Integration</CardTitle>
                <CardDescription>Connect your account to automatically respond to unread emails.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGmailStatus ? (
                  <Skeleton className="w-full h-24 rounded-lg" />
                ) : gmailStatus?.connected ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{gmailStatus.name || 'Connected Account'}</p>
                          <p className="text-sm text-muted-foreground">{gmailStatus.email}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleRevoke} disabled={revokeAccess.isPending} className="gap-2">
                        <XCircle className="w-4 h-4" /> Disconnect
                      </Button>
                    </div>
                    
                    <div className="p-6 rounded-lg border border-primary/20 bg-primary/5 flex flex-col items-center text-center gap-4">
                      <Bot className="w-12 h-12 text-primary" />
                      <div>
                        <h3 className="text-lg font-medium mb-1">Auto-Pilot Ready</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Clicking the button below will fetch your latest unread email, analyze it, and immediately send an AI-generated reply.
                        </p>
                      </div>
                      <Button 
                        size="lg" 
                        onClick={handleAutoRespond} 
                        disabled={autorespond.isPending}
                        className="gap-2 shadow-lg shadow-primary/25"
                      >
                        {autorespond.isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        {autorespond.isPending ? "Processing Inbox..." : "Process Latest Unread Email"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-lg gap-4">
                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                      <Inbox className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Not Connected</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        Link your Gmail account to enable autonomous email processing and responding.
                      </p>
                    </div>
                    {authUrl?.url ? (
                      <Button asChild size="lg" className="mt-4">
                        <a href={authUrl.url} target="_blank" rel="noopener noreferrer">Connect Gmail</a>
                      </Button>
                    ) : (
                      <div className="mt-4 space-y-2">
                        <Button disabled size="lg">Gmail setup needed</Button>
                        <p className="text-xs text-muted-foreground max-w-md">
                          Add Gmail OAuth client credentials as secrets, then restart the API server.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="mt-8">
            <ResultCard result={result} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}