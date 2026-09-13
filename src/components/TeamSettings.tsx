import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Mail, RefreshCw, RotateCcw, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useInvalidate, type WorkspaceData } from "@/lib/workspace";
import { ROLES, roleLabel, type RoleValue } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Member {
  user_id: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

const inviteUrl = (token: string) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/invite/${token}`;

export function TeamSettings({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const invalidate = useInvalidate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleValue>("calculator_user");
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const {
    data: members = [],
    isFetching: membersFetching,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ["members", companyId],
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc("company_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const {
    data: invitations = [],
    isFetching: invitationsFetching,
    refetch: refetchInvitations,
  } = useQuery({
    queryKey: ["invitations", companyId],
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, token, status, expires_at, responded_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toast.success("Invitation link copied");
    } catch {
      toast.error("Copy failed — select the link and copy it manually.");
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    if (members.some((m) => (m.email ?? "").toLowerCase() === clean)) {
      toast.error("That person is already in your workspace.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        company_id: companyId,
        email: clean,
        role: role as never,
        invited_by: workspace.userId,
      })
      .select("id, token")
      .single();
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "There is already a pending invitation for that email."
          : error.message,
      );
      return;
    }
    await logActivity(companyId, "invited", "invitation", data.id, { email: clean, role });
    setLastLink(inviteUrl(data.token));
    setEmail("");
    invalidate(["invitations", "audit"]);
    toast.success("Invitation created — share the link below.");
  };

  const setStatus = async (inv: Invitation, status: string, action: string) => {
    const { error } = await supabase.from("invitations").update({ status }).eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, action, "invitation", inv.id, { email: inv.email });
    invalidate(["invitations", "audit"]);
    toast.success(status === "revoked" ? "Invitation revoked" : "Invitation updated");
  };

  const resend = async (inv: Invitation) => {
    const { data, error } = await supabase
      .from("invitations")
      .update({ expires_at: new Date(Date.now() + 14 * 864e5).toISOString() })
      .eq("id", inv.id)
      .select("token")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "resent", "invitation", inv.id, { email: inv.email });
    setLastLink(inviteUrl(data.token));
    invalidate(["invitations", "audit"]);
    toast.success("Fresh link ready to share.");
  };

  const changeRole = async (member: Member, next: string) => {
    const { error } = await supabase.rpc("set_member_role", {
      _user_id: member.user_id,
      _role: next as never,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate(["members", "audit", "workspace"]);
    toast.success(`${member.full_name ?? member.email} is now ${roleLabel(next)}`);
  };

  const remove = async () => {
    if (!pendingRemoval) return;
    const { error } = await supabase.rpc("remove_member", { _user_id: pendingRemoval.user_id });
    setPendingRemoval(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate(["members", "audit"]);
    toast.success("Member removed");
  };

  const pending = useMemo(() => invitations.filter((i) => i.status === "pending"), [invitations]);
  const past = useMemo(() => invitations.filter((i) => i.status !== "pending"), [invitations]);
  const refreshTeam = async () => {
    await Promise.all([refetchMembers(), refetchInvitations()]);
    toast.success("Team status refreshed");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Invite someone</CardTitle>
          <CardDescription>
            Creates a single-use link that only works for that email address and expires in 14 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[2fr_1.4fr_auto]">
            <Input
              aria-label="name@company.com"
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={busy}>
              <Mail className="size-4" /> Create invitation
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            {ROLES.find((r) => r.value === role)?.description}
          </p>
          {lastLink && (
            <div className="mt-4 rounded-md border border-accent bg-accent/15 p-3">
              <p className="text-sm font-medium">Send this link to the person you invited</p>
              <p className="mt-1 break-all font-mono text-xs">{lastLink}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(lastLink).then(
                    () => toast.success("Copied"),
                    () => toast.error("Copy failed"),
                  );
                }}
              >
                <Copy className="size-4" /> Copy link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Members</CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardDescription>
              Approved invitations appear here automatically. Role changes take effect on the next
              action.
            </CardDescription>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshTeam()}
              disabled={membersFetching || invitationsFetching}
            >
              <RefreshCw className={`size-4 ${membersFetching ? "animate-spin" : ""}`} />
              Refresh team
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const current = m.roles[0] ?? "viewer";
                const isSelf = m.user_id === workspace.userId;
                return (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-medium">
                      {m.full_name ?? "—"}
                      {isSelf && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={current} onValueChange={(v) => changeRole(m, v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue>{roleLabel(current)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingRemoval(m)}
                          aria-label={`Remove ${m.email}`}
                        >
                          <UserMinus className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No team members have joined yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Pending invitations</CardTitle>
          <CardDescription>
            {pending.length === 0 ? "Nobody is waiting to join." : `${pending.length} waiting.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
            >
              <span className="font-medium">{i.email}</span>
              <Badge variant="secondary">{roleLabel(i.role)}</Badge>
              <span className="text-xs text-muted-foreground">
                expires {new Date(i.expires_at).toLocaleDateString()}
              </span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => copy(i.token)}>
                  <Copy className="size-4" /> Copy link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resend(i)}>
                  <RotateCcw className="size-4" /> Resend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatus(i, "revoked", "revoked")}
                >
                  <Trash2 className="size-4" /> Revoke
                </Button>
              </div>
            </div>
          ))}
          {past.length > 0 && (
            <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
              {past.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{i.email}</span>
                  <Badge variant={i.status === "accepted" ? "default" : "secondary"}>
                    {i.status === "accepted"
                      ? "Added to team"
                      : i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                  </Badge>
                  {i.status === "accepted" && <Badge variant="outline">{roleLabel(i.role)}</Badge>}
                  {i.responded_at && (
                    <span>updated {new Date(i.responded_at).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingRemoval} onOpenChange={(o) => !o && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this person?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.full_name ?? pendingRemoval?.email} will lose access to this
              workspace immediately. Estimates they saved stay in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
