import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Plus, 
  Users, 
  Edit2, 
  Trash2,
  Phone,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  EyeOff as EyeOffIcon
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  useParties, 
  useCreateParty, 
  useUpdateParty, 
  useDeleteParty 
} from '@/hooks/useParties';
import { usePartyBalanceSummary } from '@/hooks/useDashboard';
import { formatNPR } from '@/lib/format';
import { Party } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

export default function Parties() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ party_name: '', phone: '', note: '', default_rate: '', secret_code: '', email: '' });
  const [search, setSearch] = useState('');
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [showSecretCode, setShowSecretCode] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Admin check
  const { user } = useAuth();
  const { role } = useUserRole();
  const isAdmin = user && role === "ADMIN";

  const { data: parties, isLoading } = useParties();
  const { data: partySummary, error: partySummaryError } = usePartyBalanceSummary();
  
  const createParty = useCreateParty();
  const updateParty = useUpdateParty();
  const deleteParty = useDeleteParty();

  const getSummary = (partyId: string) => {
    return partySummary?.find(s => s.id === partyId);
  };

  const filteredParties = parties?.filter(p => {
    const matchesSearch = p.party_name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (hideZeroBalance) {
      const summary = getSummary(p.id);
      const net = summary?.net || 0;
      return net !== 0;
    }
    return true;
  });

  const handleCreate = async () => {
    if (!form.party_name.trim()) return;
    
    // Validate email if provided
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Validate password minimum 8 characters if provided
    if (form.secret_code.trim() && form.secret_code.trim().length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    try {
      await createParty.mutateAsync({
        party_name: form.party_name.trim(),
        phone: form.phone.trim() || undefined,
        note: form.note.trim() || undefined,
        default_rate: form.default_rate ? parseFloat(form.default_rate) : undefined,
        secret_code: form.secret_code.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      
      setForm({ party_name: '', phone: '', note: '', default_rate: '', secret_code: '', email: '' });
      setEmailError(null);
      setShowCreate(false);
    } catch (error: any) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        setEmailError('This email is already in use by another party');
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingParty || !form.party_name.trim()) return;
    
    // Validate email if provided
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Validate password minimum 8 characters if provided
    if (form.secret_code.trim() && form.secret_code.trim().length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    try {
      await updateParty.mutateAsync({
        id: editingParty.id,
        party_name: form.party_name.trim(),
        phone: form.phone.trim() || undefined,
        note: form.note.trim() || undefined,
        default_rate: form.default_rate ? parseFloat(form.default_rate) : null,
        secret_code: form.secret_code.trim() || null,
        email: form.email.trim() || null,
      });
      
      setForm({ party_name: '', phone: '', note: '', default_rate: '', secret_code: '', email: '' });
      setEmailError(null);
      setEditingParty(null);
    } catch (error: any) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        setEmailError('This email is already in use by another party');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteParty.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Parties" 
        description="Manage clients, vendors, and contacts"
        actions={
          <Button onClick={() => {
            setForm({ party_name: '', phone: '', note: '', default_rate: '', secret_code: '', email: '' });
            setEmailError(null);
            setShowCreate(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Party
          </Button>
        }
      />
      {partySummaryError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Party balances unavailable</AlertTitle>
          <AlertDescription>Per-party balance summaries could not be loaded. Check that the party-summary migration has been applied.</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search parties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <Button
              variant={hideZeroBalance ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHideZeroBalance(!hideZeroBalance)}
            >
              {hideZeroBalance ? 'Hide ≤0' : 'Show All'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Parties Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="table-container">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Default Rate</TableHead>
                  <TableHead className="text-right">Receivable (NPR)</TableHead>
                  <TableHead className="text-right">Payable (NPR)</TableHead>
                  <TableHead className="text-right">Net (NPR)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(9)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredParties?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState 
                        icon={<Users className="h-6 w-6" />}
                        title={search ? 'No parties found' : 'No parties yet'}
                        description={search ? 'Try a different search term' : 'Add your first party to start tracking transactions'}
                        action={!search && (
                          <Button onClick={() => setShowCreate(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Party
                          </Button>
                        )}
                        className="my-8"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParties?.map((party) => {
                    const summary = getSummary(party.id);
                    return (
                      <TableRow key={party.id}>
                        <TableCell className="font-medium">{party.party_name}</TableCell>
                        <TableCell>
                          {party.phone ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {party.phone}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {party.default_rate ? party.default_rate.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right currency-positive">
                          {formatNPR(summary?.receivable || 0)}
                        </TableCell>
                        <TableCell className="text-right currency-negative">
                          {formatNPR(summary?.payable || 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNPR(Math.abs(summary?.net || 0))}
                        </TableCell>
                        <TableCell>
                          {summary && summary.net !== 0 ? (
                            <StatusBadge variant={summary.status === 'RECEIVABLE' ? 'receivable' : 'payable'}>
                              {summary.status}
                            </StatusBadge>
                          ) : (
                            <StatusBadge variant="settled">SETTLED</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {party.note || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                            onClick={() => {
                                if (!isAdmin) { toast.error("Contact Admin to perform this action"); return; }
                                setForm({ 
                                  party_name: party.party_name, 
                                  phone: party.phone || '', 
                                  note: party.note || '',
                                  default_rate: party.default_rate?.toString() || '',
                                  secret_code: party.secret_code || '',
                                  email: (party as any).email || ''
                                });
                                setEmailError(null);
                                setEditingParty(party);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { if (!isAdmin) { toast.error("Contact Admin to perform this action"); return; } setDeleteId(party.id); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Link to={`/receivable-payable?party=${party.id}`}>
                              <Button variant="ghost" size="icon">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreate || !!editingParty} 
        onOpenChange={() => {
          setShowCreate(false);
          setEditingParty(null);
          setForm({ party_name: '', phone: '', note: '', default_rate: '', secret_code: '', email: '' });
          setEmailError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingParty ? 'Edit Party' : 'Add Party'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label>Party Name *</Label>
              <Input
                placeholder="e.g., Acme Corp"
                value={form.party_name}
                onChange={(e) => setForm({ ...form, party_name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-field">
              <Label>Phone</Label>
              <Input
                placeholder="+1-555-0123"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-field">
              <Label>Default Rate</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g., 133.00"
                value={form.default_rate}
                onChange={(e) => setForm({ ...form, default_rate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-fills rate when this party is selected in transactions
              </p>
            </div>
            <div className="form-field">
              <Label>Note</Label>
              <Textarea
                placeholder="Optional notes..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
              />
            </div>
            <div className="form-field">
              <Label>Party Email (for /live and /userlogin access)</Label>
              <Input
                type="email"
                placeholder="party@example.com"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setEmailError(null);
                }}
                className={emailError ? 'border-destructive' : ''}
              />
              {emailError && (
                <p className="text-xs text-destructive mt-1">{emailError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Used for OTP verification on /live and login on /userlogin
              </p>
            </div>
            <div className="form-field">
              <Label>Party Password (for /live access)</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecretCode ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={form.secret_code}
                  onChange={(e) => setForm({ ...form, secret_code: e.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    // Generate 13-character secure random code
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
                    const array = new Uint32Array(13);
                    crypto.getRandomValues(array);
                    const code = Array.from(array, (num) => chars[num % chars.length]).join('');
                    setForm({ ...form, secret_code: code });
                    setShowSecretCode(true);
                  }}
                  title="Generate secure password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSecretCode(!showSecretCode)}
                    title={showSecretCode ? "Hide password" : "Show password"}
                  >
                    {showSecretCode ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Required with email. Used for authentication on /live page
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreate(false);
                setEditingParty(null);
                setForm({ party_name: '', phone: '', note: '', default_rate: '', secret_code: '', email: '' });
                setEmailError(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingParty ? handleUpdate : handleCreate}
              disabled={!form.party_name.trim() || createParty.isPending || updateParty.isPending}
            >
              {editingParty ? 'Save Changes' : 'Add Party'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Party"
        description="Are you sure you want to delete this party? This action cannot be undone if the party has transactions."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </AppLayout>
  );
}
