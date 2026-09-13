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
  validateSearch: (search: Record<string, unknown>): { next?: string; mode?: "recovery" } => {
    const n = search["next"];
    const next =
      typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\")
        ? n
        : undefined;
    const validated: { next?: string; mode?: "recovery" } = {};
    if (next) validated.next = next;
    if (search["mode"] === "recovery") validated.mode = "recovery";
    return validated;
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
  const { next, mode } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationPassword, setConfirmationPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"signin" | "signup" | "forgot" | "recovery">(
    mode === "recovery" ? "recovery" : "signin",
  );
  const [signupPendingEmail, setSignupPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    const go = () => {
      if (next) window.location.replace(next);
      else navigate({ to: "/dashboard", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && view !== "recovery") go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && view !== "recovery") go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, next, view]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setSignupPendingEmail(email.trim());
  };

  const verifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupPendingEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: signupPendingEmail,
      token: signupCode.trim(),
      type: "signup",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email verified");
  };

  const resendSignup = async () => {
    if (!signupPendingEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: signupPendingEmail });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("A new verification code was sent");
  };

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const redirectTo = new URL("/auth", window.location.origin);
    redirectTo.searchParams.set("mode", "recovery");
    if (next) redirectTo.searchParams.set("next", next);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo.toString(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("If that account exists, a password reset email is on its way");
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmationPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    setPassword("");
    setConfirmationPassword("");
    setView("signin");
    toast.success("Password updated. You can sign in now.");
  };

  const description =
    view === "recovery"
      ? "Choose a new password for your account."
      : view === "forgot"
        ? "Enter your work email and we’ll send a secure reset link."
        : signupPendingEmail
          ? `Enter the six-digit code sent to ${signupPendingEmail}.`
          : "Sign in, or create an account with your work email.";

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
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {view === "recovery" ? (
              <form onSubmit={updatePassword} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    value={confirmationPassword}
                    onChange={(e) => setConfirmationPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  Update password
                </Button>
              </form>
            ) : view === "forgot" ? (
              <form onSubmit={requestReset} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Work email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  Send reset email
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setView("signin")}
                >
                  Back to sign in
                </button>
              </form>
            ) : signupPendingEmail ? (
              <form onSubmit={verifySignup} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-code">Email verification code</Label>
                  <Input
                    id="signup-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={signupCode}
                    onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  Verify email
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  If your email contains a confirmation link instead, open that link to finish.
                </p>
                <div className="flex justify-between gap-3 text-sm">
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => void resendSignup()}
                    disabled={busy}
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setSignupPendingEmail(null);
                      setSignupCode("");
                      setView("signup");
                    }}
                  >
                    Use another email
                  </button>
                </div>
              </form>
            ) : (
              <Tabs value={view} onValueChange={(value) => setView(value as "signin" | "signup")}>
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
                    <button
                      type="button"
                      className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setView("forgot")}
                    >
                      Forgot password?
                    </button>
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
                      Send verification code
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
