import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Settings as SettingsIcon, UserCog, FileText, RefreshCw, KeyRound } from 'lucide-react';
import {
  useNetworthCategories, useSaveCategory, useDeleteCategory,
  useNetworthSettings, useSaveSettings, type NetworthCategory,
} from '@/hooks/useNetworth';
import { NETWORTH_GROUPS, type NetworthGroup, type NetworthType } from '@/lib/networthFormat';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import UserManagement from '@/pages/UserManagement';
import AccessLogs from '@/pages/AccessLogs';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export default function NetworthSettings() {
  const { data: categories = [] } = useNetworthCategories();
  const { data: settings } = useNetworthSettings();
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();
  const saveSettings = useSaveSettings();

  const [tab, setTab] = useState('general');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<NetworthCategory> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [goalStart, setGoalStart] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalLabel, setGoalLabel] = useState('');
  const [refreshingRate, setRefreshingRate] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (settings) {
      setGoalStart(String(settings.goal_start_npr || ''));
      setGoalTarget(String(settings.goal_target_npr || ''));
      setGoalLabel(settings.goal_label || '');
    }
  }, [settings]);

  const refreshRate = async () => {
    setRefreshingRate(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-usd-npr-rate');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      toast.success(`USD→NPR rate updated: ${data.rate}`);
      qc.invalidateQueries({ queryKey: ['networth-settings'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshingRate(false);
    }
  };

  const openNew = (preset?: { type: NetworthType; group_name: NetworthGroup }) => {
    setEditing({
      name: '',
      type: preset?.type || 'ASSET',
      group_name: preset?.group_name || 'INCOME',
      is_active: true,
    });
    setDialogOpen(true);
  };
  const openEdit = (c: NetworthCategory) => {
    setEditing(c);
    setDialogOpen(true);
  };
  const handleSave = () => {
    if (!editing?.name || !editing?.type || !editing?.group_name) return;
    saveCategory.mutate(editing, { onSuccess: () => setDialogOpen(false) });
  };

  const incomeItems = categories.filter((c) => c.group_name === 'INCOME');
  const expenseItems = categories.filter((c) => c.group_name === 'EXPENSE');
  const assetItems = categories.filter(
    (c) => c.type === 'ASSET' && c.group_name !== 'INCOME',
  );
  const liabilityItems = categories.filter(
    (c) => c.type === 'LIABILITY' && c.group_name !== 'EXPENSE',
  );

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Net Worth categories, goal, users, and activity logs"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <UserCog className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="active-accounts" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Active Accounts
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* USD → NPR Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>USD → NPR Rate</CardTitle>
              <Button size="sm" variant="outline" onClick={refreshRate} disabled={refreshingRate}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshingRate ? 'animate-spin' : ''}`} />
                Refresh now
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-muted-foreground text-xs">Today's Rate</Label>
                <p className="text-2xl font-bold font-mono text-primary">
                  {settings?.usd_npr_rate ? `NPR ${Number(settings.usd_npr_rate).toFixed(2)}` : '—'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Last Updated</Label>
                <p className="text-sm">
                  {settings?.usd_npr_updated_at
                    ? format(new Date(settings.usd_npr_updated_at), 'd-MMM-yy, h:mm a')
                    : 'Never'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Auto Schedule</Label>
                <p className="text-sm">Daily 6:00 AM (NPT)</p>
              </div>
            </CardContent>
          </Card>

          {/* Goal */}
          <Card>
            <CardHeader>
              <CardTitle>Goal Tracker</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Goal Label</Label>
                <Input value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} placeholder="2027 Goal" />
              </div>
              <div>
                <Label>Start (NPR)</Label>
                <Input
                  type="text" inputMode="decimal" value={goalStart}
                  onChange={(e) => setGoalStart(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div>
                <Label>Target (NPR)</Label>
                <Input
                  type="text" inputMode="decimal" value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={!settings || saveSettings.isPending}
                  onClick={() =>
                    settings &&
                    saveSettings.mutate({
                      id: settings.id,
                      goal_start_npr: parseFloat(goalStart) || 0,
                      goal_target_npr: parseFloat(goalTarget) || 0,
                      goal_label: goalLabel || 'Net Worth Goal',
                    })
                  }
                >
                  Save Goal
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Income & Expense — 2-column extensible lists */}
          <div className="grid gap-4 md:grid-cols-2">
            <CategoryColumn
              title="Income"
              accentClass="text-emerald-600 border-emerald-500/40"
              items={incomeItems}
              onAdd={() => openNew({ type: 'ASSET', group_name: 'INCOME' })}
              onEdit={openEdit}
              onDelete={(id) => setConfirmId(id)}
            />
            <CategoryColumn
              title="Expense"
              accentClass="text-amber-600 border-amber-500/40"
              items={expenseItems}
              onAdd={() => openNew({ type: 'LIABILITY', group_name: 'EXPENSE' })}
              onEdit={openEdit}
              onDelete={(id) => setConfirmId(id)}
            />
          </div>

          {/* Assets & Liabilities — consolidated 2-column lists */}
          <div className="grid gap-4 md:grid-cols-2">
            <CategoryColumn
              title="Assets"
              accentClass="text-sky-600 border-sky-500/40"
              items={assetItems}
              onAdd={() => openNew({ type: 'ASSET', group_name: 'LIQUID_ASSETS' })}
              onEdit={openEdit}
              onDelete={(id) => setConfirmId(id)}
            />
            <CategoryColumn
              title="Liabilities"
              accentClass="text-rose-600 border-rose-500/40"
              items={liabilityItems}
              onAdd={() => openNew({ type: 'LIABILITY', group_name: 'SHORT_TERM_LIABILITIES' })}
              onEdit={openEdit}
              onDelete={(id) => setConfirmId(id)}
            />
          </div>
        </TabsContent>

        <TabsContent value="active-accounts">
          <SettingsModal embedded open={false} onOpenChange={() => undefined} />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement embedded />
        </TabsContent>

        <TabsContent value="logs">
          <AccessLogs embedded />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit' : 'New'} Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editing?.name || ''}
                onChange={(e) => setEditing((p) => ({ ...p!, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={editing?.type}
                onValueChange={(v) => setEditing((p) => ({ ...p!, type: v as NetworthType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="LIABILITY">Liability</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group</Label>
              <Select
                value={editing?.group_name}
                onValueChange={(v) => setEditing((p) => ({ ...p!, group_name: v as NetworthGroup }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NETWORTH_GROUPS.filter((g) => g.type === editing?.type).map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveCategory.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Delete category?"
        description="Existing entries will keep their category name but lose the link."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmId) deleteCategory.mutate(confirmId);
          setConfirmId(null);
        }}
      />
    </AppLayout>
  );
}

function CategoryColumn({
  title, accentClass, items, onAdd, onEdit, onDelete,
}: {
  title: string;
  accentClass: string;
  items: NetworthCategory[];
  onAdd: () => void;
  onEdit: (c: NetworthCategory) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className={`border-2 ${accentClass.split(' ').filter((c) => c.startsWith('border-')).join(' ')}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className={`text-base font-bold ${accentClass.split(' ').filter((c) => c.startsWith('text-')).join(' ')}`}>
          {title}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />Add
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground italic">
            No categories yet
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
