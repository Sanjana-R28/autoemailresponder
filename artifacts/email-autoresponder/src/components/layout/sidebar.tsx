import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, BarChart3, Inbox, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/history", label: "History", icon: History },
    { href: "/stats", label: "Analytics", icon: BarChart3 },
    { href: "/diagnostics", label: "Diagnostics", icon: Wrench },
  ];

  return (
    <div className="w-64 border-r border-border bg-sidebar flex flex-col h-screen overflow-y-auto">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
          <Inbox className="w-5 h-5" />
        </div>
        <span className="font-semibold text-lg tracking-tight text-sidebar-foreground">Responder.ai</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const active = location === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors font-medium text-sm",
                active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <link.icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="bg-secondary p-4 rounded-lg flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Status</p>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium">All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}