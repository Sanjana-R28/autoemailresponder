import { useState } from "react";
import { format } from "date-fns";
import { Inbox, Bot, Search, RefreshCw } from "lucide-react";
import { useGetEmailHistory } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function History() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading, refetch, isRefetching } = useGetEmailHistory({ limit: 50 });

  const emails = data?.emails || [];
  
  const filteredEmails = emails.filter(email => 
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (email.senderEmail && email.senderEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "Positive": return "bg-emerald-500/15 text-emerald-500 border-emerald-500/20";
      case "Negative": return "bg-rose-500/15 text-rose-500 border-rose-500/20";
      default: return "bg-slate-500/15 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Processing History</h1>
            <p className="text-muted-foreground text-lg">A log of all emails analyzed and responded to by the AI.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-6 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search history..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto border border-border rounded-lg bg-card/50">
          <Table>
            <TableHeader className="bg-secondary/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Analysis</TableHead>
                <TableHead className="w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading history...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEmails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="w-8 h-8 opacity-50" />
                      <p>No history found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmails.map((email) => (
                  <TableRow key={email.id} className="group hover:bg-muted/50 transition-colors">
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(email.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[250px]">{email.subject}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[150px]">
                      {email.senderEmail || email.senderName || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={`text-xs ${getSentimentColor(email.sentiment)}`}>
                          {email.sentiment}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-500/15 text-blue-400 border-blue-500/20">
                          {email.intent}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-purple-500/15 text-purple-400 border-purple-500/20">
                          {email.area}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-card border-border">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Bot className="w-5 h-5 text-primary" />
                              Email Details
                            </DialogTitle>
                            <DialogDescription>
                              Analyzed on {format(new Date(email.createdAt), "PPpp")}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 my-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">From</span>
                                <p className="font-medium">{email.senderName} {email.senderEmail ? `<${email.senderEmail}>` : ''}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Subject</span>
                                <p className="font-medium">{email.subject}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Badge variant="outline" className={getSentimentColor(email.sentiment)}>{email.sentiment}</Badge>
                              <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/20">{email.intent}</Badge>
                              <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/20">{email.area}</Badge>
                              <Badge variant="outline" className="bg-secondary text-muted-foreground">Source: {email.source}</Badge>
                            </div>

                            <div className="space-y-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original Message</span>
                              <div className="p-3 rounded-md bg-background border border-border text-sm text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                                {email.body}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Generated Reply</span>
                              <div className="p-4 rounded-md bg-primary/5 border border-primary/20 font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {email.generatedReply}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}