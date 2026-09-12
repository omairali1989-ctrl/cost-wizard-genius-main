import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Workspace invitation — CostCraft" },
      {
        name: "description",
        content: "Accept your invitation to join a CostCraft pricing workspace.",
      },
      { property: "og:title", content: "Workspace invitation — CostCraft" },
      { property: "og:description", content: "Join your team's pricing workspace." },
    ],
  }),
  component: InvitePage,
});

interface Preview {
  email: string;
  role: string;
  company_name: string;
  status: string;
  expired: boolean;
}

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["invitation-preview", token],
    enabled: signedIn === true,
    queryFn: async (): Promise<Preview | null> => {
      const { data, error } = await supabase.rpc("invitation_preview", { _token: token });
      if (error) throw error;
      return ((data ?? []) as Preview[])[0] ?? null;
    },
  });

  const accept = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("accept_invitation", { _token: token });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries();
    toast.success("Welcome aboard");
    navigate({ to: "/dashboard", replace: true });
  };

  const decline = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("decline_invitation", { _token: token });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation declined");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display">You have been invited</CardTitle>
          <CardDescription>
            {signedIn === false
              ? "Sign in or create an account with the invited email address to continue."
              : "Review the invitation below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signedIn === null || (signedIn && isLoading) ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : signedIn === false ? (
            <Button asChild className="w-full">
              <Link to="/auth" search={{ next: `/invite/${token}` }}>
                Sign in to continue
              </Link>
            </Button>
          ) : !preview ? (
            <p className="text-sm text-muted-foreground">
              This invitation link is not valid. Ask whoever invited you to send a new one.
            </p>
          ) : preview.status !== "pending" || preview.expired ? (
            <p className="text-sm text-muted-foreground">
              This invitation is no longer active ({preview.expired ? "expired" : preview.status}).
              Ask for a fresh invitation.
            </p>
          ) : (
            <>
              <div className="rounded-md border p-4 text-sm">
                <p className="font-display text-lg font-semibold">{preview.company_name}</p>
                <p className="mt-1 text-muted-foreground">
                  Invited as <span className="font-medium">{roleLabel(preview.role)}</span>
                </p>
                <p className="text-muted-foreground">For {preview.email}</p>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" disabled={busy} onClick={accept}>
                  Accept invitation
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={decline}>
                  Decline
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
