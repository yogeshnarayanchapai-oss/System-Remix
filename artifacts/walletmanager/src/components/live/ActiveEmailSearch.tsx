import { useState } from 'react';
import { Search, Loader2, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type EmailStatus = 'active' | 'inactive' | 'not_found' | null;

interface SearchResult {
  status: EmailStatus;
  message: string;
}

const statusConfig: Record<Exclude<EmailStatus, null>, { icon: React.ReactNode; className: string; label: string }> = {
  active: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: 'bg-success text-success-foreground',
    label: 'Active',
  },
  inactive: {
    icon: <XCircle className="h-4 w-4" />,
    className: 'bg-destructive text-destructive-foreground',
    label: 'Inactive',
  },
  not_found: {
    icon: <AlertCircle className="h-4 w-4" />,
    className: 'bg-warning text-warning-foreground',
    label: 'Not Found',
  },
};

export function ActiveEmailSearch() {
  const [emailQuery, setEmailQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const trimmedEmail = emailQuery.trim();
    
    if (!trimmedEmail) {
      setError('Please enter an email address');
      setResult(null);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Use fetch directly since invoke doesn't support query params
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/active-email-status?email=${encodeURIComponent(trimmedEmail)}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          setError(responseData.error || 'Invalid email');
        } else {
          setError('Could not check status. Try again.');
        }
        return;
      }

      // Map status to message
      const statusMessages: Record<string, string> = {
        active: 'This email is Active.',
        inactive: 'This email is Inactive.',
        not_found: 'Email not found in Wallet Accounts.',
      };

      setResult({
        status: responseData.status as EmailStatus,
        message: statusMessages[responseData.status] || 'Unknown status',
      });

    } catch (err) {
      console.error('Search error:', err);
      setError('Could not check status. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Active Email Search</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter email"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            disabled={loading}
            size="default"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && result.status && (
          <div className="space-y-2">
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusConfig[result.status].className}`}>
              {statusConfig[result.status].icon}
              {statusConfig[result.status].label}
            </div>
            {/* Message */}
            <p className="text-sm text-muted-foreground">{result.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
