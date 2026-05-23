import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Key, Copy, Check, RefreshCw, ShieldCheck, AlertCircle, Loader2, Eye, EyeOff, Mail, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ActiveEmailSearch } from "@/components/live/ActiveEmailSearch";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

// Cloudflare Turnstile site key (test key for development)
const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

// Error code to display mapping with Nepali messages
const ERROR_DISPLAY: Record<string, { badge: string; variant: "destructive" | "secondary" | "outline"; message: string }> = {
  EMAIL_NOT_FOUND: { badge: "Not Found", variant: "destructive", message: "Email namilne" },
  PASSWORD_MISMATCH: { badge: "Invalid", variant: "destructive", message: "Password namilne / password milena" },
  SECRET_CODE_INVALID: { badge: "Invalid", variant: "destructive", message: "Vitra code namile / code milena" },
  ACCOUNT_INACTIVE: { badge: "Inactive", variant: "secondary", message: "Inactive" },
  VALIDATION_ERROR: { badge: "Error", variant: "destructive", message: "Required field missing" },
  SESSION_NOT_FOUND: { badge: "Error", variant: "destructive", message: "Session not found. Please start over." },
  SESSION_ALREADY_VERIFIED: { badge: "Info", variant: "secondary", message: "Session already verified" },
  SESSION_EXPIRED: { badge: "Expired", variant: "secondary", message: "Session expired" },
  SESSION_BLOCKED: { badge: "Blocked", variant: "destructive", message: "Too many attempts" },
  OTP_INVALID: { badge: "Invalid", variant: "destructive", message: "Invalid OTP" },
  OTP_EXPIRED: { badge: "Expired", variant: "secondary", message: "OTP expired" },
  RESEND_COOLDOWN: { badge: "Wait", variant: "secondary", message: "Please wait before resending" },
  RESEND_LIMIT: { badge: "Limit", variant: "destructive", message: "Maximum resend limit reached" },
  NO_PRIMARY_ACCOUNT: { badge: "Error", variant: "destructive", message: "No primary account configured" },
  TFA_NOT_CONFIGURED: { badge: "Error", variant: "destructive", message: "2FA not configured" },
  UNKNOWN_ERROR: { badge: "Error", variant: "destructive", message: "Something went wrong" },
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "error-callback": () => void },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export default function Live() {
  const [step, setStep] = useState<"request" | "otp" | "credentials">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  // OTP state
  const [resendAvailableAt, setResendAvailableAt] = useState<Date | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Credentials state
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [hasTotp, setHasTotp] = useState(false);
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRequestPassword, setShowRequestPassword] = useState(false);

  // Auth for admin check
  const { user } = useAuth();
  const { role } = useUserRole();
  const isAdmin = user && role === "ADMIN";

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Load Turnstile script
  useEffect(() => {
    if (document.querySelector('script[src*="turnstile"]')) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  // Render Turnstile widget when in request step
  useEffect(() => {
    if (step !== "request" || !turnstileRef.current) return;

    const renderWidget = () => {
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            setCaptchaToken(token);
            setError(null);
          },
          "error-callback": () => {
            setCaptchaToken(null);
            setError({ code: "CAPTCHA_FAILED", message: "Captcha verification failed. Please try again." });
          },
        });
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          renderWidget();
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (!resendAvailableAt) return;

    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000));
      setResendCooldown(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  // Helper to get error display info
  const getErrorDisplay = (code: string) => {
    return ERROR_DISPLAY[code] || ERROR_DISPLAY.UNKNOWN_ERROR;
  };

  // Helper to determine which field has error
  const getErrorField = (code: string) => {
    if (code === "EMAIL_NOT_FOUND") return "email";
    if (code === "PASSWORD_MISMATCH") return "password";
    return null;
  };

  const handleRequestAccess = async () => {
    if (!email.trim() || !password.trim()) {
      setError({ code: "VALIDATION_ERROR", message: "Please enter both email and password" });
      return;
    }

    if (!captchaToken) {
      setError({ code: "CAPTCHA_REQUIRED", message: "Please complete the captcha verification" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("party-otp", {
        body: {
          action: "request_access",
          email: email.trim().toLowerCase(),
          password: password.trim(),
        },
      });

      // Handle Supabase function invocation errors
      if (fnError) {
        console.error("Function error:", fnError);
        setError({ code: "UNKNOWN_ERROR", message: fnError.message || "Request failed" });
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
          setCaptchaToken(null);
        }
        return;
      }

      // Handle structured response
      if (!data.ok) {
        setError({ code: data.error_code || "UNKNOWN_ERROR", message: data.message || "Request failed" });
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
          setCaptchaToken(null);
        }
        return;
      }

      // Success - show OTP step
      setSessionId(data.data.session_id);
      setResendAvailableAt(new Date(data.data.resend_available_at));
      setStep("otp");
      toast.success("OTP sent to your email");
    } catch (err: any) {
      console.error("Request access error:", err);
      setError({ code: "UNKNOWN_ERROR", message: err.message || "Request failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError({ code: "VALIDATION_ERROR", message: "Please enter the 6-digit OTP" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("party-otp", {
        body: {
          action: "verify_otp",
          session_id: sessionId,
          otp: otp.trim(),
        },
      });

      if (fnError) {
        setError({ code: "UNKNOWN_ERROR", message: fnError.message || "Verification failed" });
        return;
      }

      if (!data.ok) {
        setError({ code: data.error_code || "UNKNOWN_ERROR", message: data.message || "Verification failed" });
        if (data.data?.remaining_attempts !== undefined) {
          setRemainingAttempts(data.data.remaining_attempts);
        }
        return;
      }

      // Success - show credentials
      setCredEmail(data.data.email);
      setCredPassword(data.data.password);
      setHasTotp(data.data.has_totp);
      setStep("credentials");
      toast.success("OTP verified successfully");
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      setError({ code: "UNKNOWN_ERROR", message: err.message || "Verification failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendCount >= 3) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("party-otp", {
        body: {
          action: "resend_otp",
          session_id: sessionId,
        },
      });

      if (fnError) {
        setError({ code: "UNKNOWN_ERROR", message: fnError.message || "Resend failed" });
        return;
      }

      if (!data.ok) {
        setError({ code: data.error_code || "UNKNOWN_ERROR", message: data.message || "Resend failed" });
        return;
      }

      setResendAvailableAt(new Date(data.data.resend_available_at));
      setResendCount(data.data.resend_count);
      setOtp("");
      setRemainingAttempts(null);
      toast.success("New OTP sent to your email");
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      setError({ code: "UNKNOWN_ERROR", message: err.message || "Resend failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCode = async () => {
    setIsLoadingCode(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("party-otp", {
        body: {
          action: "get_code",
          session_id: sessionId,
        },
      });

      if (fnError) {
        setError({ code: "UNKNOWN_ERROR", message: fnError.message || "Failed to get code" });
        return;
      }

      if (!data.ok) {
        setError({ code: data.error_code || "UNKNOWN_ERROR", message: data.message || "Failed to get code" });
        return;
      }

      setTotpCode(data.data.code);
    } catch (err: any) {
      console.error("Get code error:", err);
      setError({ code: "UNKNOWN_ERROR", message: err.message || "Failed to get code. Please try again." });
    } finally {
      setIsLoadingCode(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleOpenGmail = () => {
    // Log gmail click client-side (backend also logs this via session)
    window.open("https://mail.google.com", "_blank");
  };

  const handleReset = () => {
    setStep("request");
    setEmail("");
    setPassword("");
    setOtp("");
    setSessionId(null);
    setCaptchaToken(null);
    setCredEmail("");
    setCredPassword("");
    setHasTotp(false);
    setTotpCode(null);
    setError(null);
    setResendAvailableAt(null);
    setResendCooldown(0);
    setResendCount(0);
    setRemainingAttempts(null);
    widgetIdRef.current = null;
  };

  const errorField = error ? getErrorField(error.code) : null;
  const errorDisplay = error ? getErrorDisplay(error.code) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start sm:justify-center px-4 py-6 gap-4 pb-safe"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))", paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
    >
      {/* Active Email Search Card */}
      <div className="w-full max-w-md">
        <ActiveEmailSearch />
      </div>

      {/* Account Access Card */}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Account Access</CardTitle>
          <CardDescription>
            {step === "request" && "Enter your party credentials to request access"}
            {step === "otp" && "Enter the OTP sent to your email"}
            {step === "credentials" && "Your account credentials"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && errorDisplay && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant={errorDisplay.variant}>{errorDisplay.badge}</Badge>
                  <span>{error.message}</span>
                </div>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <span className="text-xs mt-1">
                    {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {step === "request" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className={errorField === 'email' ? 'text-destructive' : ''}>
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your party email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorField === 'email') {
                      setError(null);
                    }
                  }}
                  disabled={isLoading}
                  className={errorField === 'email' ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className={errorField === 'password' ? 'text-destructive' : ''}>
                  <Lock className="inline h-4 w-4 mr-1" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showRequestPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorField === 'password') {
                        setError(null);
                      }
                    }}
                    disabled={isLoading}
                    className={`pr-10 ${errorField === 'password' ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRequestPassword(!showRequestPassword)}
                    tabIndex={-1}
                  >
                    {showRequestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Turnstile Captcha */}
              <div className="flex justify-center">
                <div ref={turnstileRef} />
              </div>

              <Button className="w-full" onClick={handleRequestAccess} disabled={isLoading || !captchaToken}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Request Access
                  </>
                )}
              </Button>

            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">OTP Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground text-center">
                  OTP sent to {email}. Expires in 3 minutes.
                </p>
              </div>

              <Button className="w-full" onClick={handleVerifyOtp} disabled={isLoading || otp.length !== 6}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify OTP
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendOtp}
                disabled={isLoading || resendCooldown > 0 || resendCount >= 3}
              >
                {resendCooldown > 0 ? (
                  `Resend OTP (${resendCooldown}s)`
                ) : resendCount >= 3 ? (
                  "Max resends reached"
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend OTP ({3 - resendCount} left)
                  </>
                )}
              </Button>

              <Button variant="ghost" className="w-full" onClick={handleReset}>
                Start Over
              </Button>
            </div>
          )}

          {step === "credentials" && (
            <div className="space-y-4">
              {/* Quick Actions */}
              <Button variant="outline" className="w-full" onClick={handleOpenGmail}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Gmail
              </Button>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email / User ID</Label>
                <div className="flex gap-2">
                  <Input value={credEmail} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(credEmail, "email")}>
                    {copiedField === "email" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={credPassword}
                      readOnly
                      className="font-mono pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(credPassword, "password")}>
                    {copiedField === "password" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* TOTP */}
              {hasTotp && (
                <div className="space-y-2">
                  <Label>2FA Code</Label>
                  <div className="flex gap-2">
                    {totpCode ? (
                      <>
                        <Input value={totpCode} readOnly className="font-mono text-xl tracking-widest text-center" />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(totpCode, "totp")}>
                          {copiedField === "totp" ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleGetCode} disabled={isLoadingCode}>
                          <RefreshCw className={`h-4 w-4 ${isLoadingCode ? 'animate-spin' : ''}`} />
                        </Button>
                      </>
                    ) : (
                      <Button className="w-full" onClick={handleGetCode} disabled={isLoadingCode}>
                        {isLoadingCode ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting code...
                          </>
                        ) : (
                          <>
                            <Key className="mr-2 h-4 w-4" />
                            Get Code
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Button variant="ghost" className="w-full" onClick={handleReset}>
                Start Over
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
