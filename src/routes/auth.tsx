import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const n = search["next"];
    return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\")
      ? { next: n }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — CostCraft Pricing Calculator" },
      {
        name: "description",
        content:
          "Sign in to your company workspace to build software project cost estimates and prices.",
      },
      { property: "og:title", content: "Sign in — CostCraft Pricing Calculator" },
      { property: "og:description", content: "Access your software pricing workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const go = () => {
      if (next) window.location.replace(next);
      else navigate({ to: "/dashboard", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, next]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setSent(true);
  };

  const google = async () => {
    setBusy(true);
    const redirectTo = new URL("/auth", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setBusy(false);
      const message = error.message?.toLowerCase().includes("not enabled")
        ? "Google sign-in is not enabled in the Supabase project yet. Enable Google under Authentication > Providers."
        : error.message || "Google sign-in failed. Try email instead.";
      toast.error(message);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
            ₵
          </span>
          <span className="font-display text-lg font-semibold">CostCraft</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Your pricing workspace</CardTitle>
            <CardDescription>
              {sent
                ? "Check your inbox and confirm your email address to finish."
                : "Sign in, or create an account to set up your company."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="mb-4 w-full"
              onClick={google}
              type="button"
              disabled={busy}
            >
              Continue with Google
            </Button>
            <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or use email{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" disabled={busy}>
                    Sign in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">Work email</Label>
                    <Input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">Password</Label>
                    <Input
                      id="password2"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" disabled={busy}>
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
