import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListLeads, useCreateLead, useUpdateLead, useDeleteLead, useGetLeadStats, useListPages,
  getListLeadsQueryKey, getGetLeadStatsQueryKey, getListPagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  pulled: { label: "Pulled", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  hot: { label: "Hot", color: "bg-red-500/15 text-red-400 border-red-500/20" },
  follow_up: { label: "Follow Up", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  closed: { label: "Closed", color: "bg-green-500/15 text-green-400 border-green-500/20" },
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editLead, setEditLead] = useState<any>(null);
  const [newLead, setNewLead] = useState({ fullName: "", phone: "", product: "", notes: "", status: "new" });

  const filters = statusFilter ? { status: statusFilter } : {};
  const { data: leads, isLoading } = useListLeads(filters, { query: { queryKey: getListLeadsQueryKey(filters) } });
  const { data: stats } = useGetLeadStats({ query: { queryKey: getGetLeadStatsQueryKey() } });
  const { data: pages } = useListPages({ query: { queryKey: getListPagesQueryKey() } });
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey(filters) });
    qc.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
  };

  const handleCreate = async () => {
    try {
      await createLead.mutateAsync({ data: newLead });
      setShowAdd(false);
      setNewLead({ fullName: "", phone: "", product: "", notes: "", status: "new" });
      invalidate();
      toast({ title: "Lead created" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateLead.mutateAsync({ id, data: { status } });
    invalidate();
  };

  const handleDelete = async (id: string) => {
    await deleteLead.mutateAsync({ id });
    invalidate();
    toast({ title: "Lead deleted" });
  };

  const handleSaveEdit = async () => {
    if (!editLead) return;
    await updateLead.mutateAsync({ id: editLead.id, data: { fullName: editLead.fullName, phone: editLead.phone, product: editLead.product, notes: editLead.notes } });
    setEditLead(null);
    invalidate();
    toast({ title: "Lead updated" });
  };

  const filtered = leads?.filter((l: any) => !search || l.fullName.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <AppLayout>
      <div className="p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{stats?.total ?? 0} total leads</p>
          </div>
          <Button data-testid="button-add-lead" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} className="mr-1" /> Add Lead
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[{ value: "", label: "All", count: stats?.total }, { value: "new", label: "New", count: stats?.new }, { value: "hot", label: "Hot", count: stats?.hot }, { value: "follow_up", label: "Follow Up", count: stats?.follow_up }, { value: "closed", label: "Closed", count: stats?.closed }].map(({ value, label, count }) => (
            <button
              key={value}
              data-testid={`filter-${label.toLowerCase().replace(" ", "-")}`}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                statusFilter === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {label} {count !== undefined && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          ))}
        </div>

        <Input
          data-testid="input-search-leads"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i}><td colSpan={6} className="px-5 py-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No leads found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((lead: any) => (
                  <tr key={lead.id} data-testid={`row-lead-${lead.id}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <button className="font-medium text-foreground hover:underline text-left" onClick={() => setEditLead(lead)}>{lead.fullName}</button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{lead.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[120px]">{lead.product ?? "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        data-testid={`select-status-${lead.id}`}
                        className={cn("text-xs px-2 py-1 rounded border font-medium bg-transparent cursor-pointer", STATUS_CONFIG[lead.status]?.color)}
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      >
                        {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button data-testid={`button-delete-${lead.id}`} onClick={() => handleDelete(lead.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input data-testid="input-lead-name" value={newLead.fullName} onChange={(e) => setNewLead(p => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input data-testid="input-lead-phone" value={newLead.phone} onChange={(e) => setNewLead(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Input data-testid="input-lead-product" value={newLead.product} onChange={(e) => setNewLead(p => ({ ...p, product: e.target.value }))} placeholder="What are they interested in?" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                data-testid="select-lead-status"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={newLead.status}
                onChange={(e) => setNewLead(p => ({ ...p, status: e.target.value }))}
              >
                {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                data-testid="input-lead-notes"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                value={newLead.notes}
                onChange={(e) => setNewLead(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button data-testid="button-confirm-lead" onClick={handleCreate} disabled={createLead.isPending}>
              {createLead.isPending ? "Adding..." : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editLead} onOpenChange={() => setEditLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
          {editLead && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input data-testid="input-edit-name" value={editLead.fullName} onChange={(e) => setEditLead((p: any) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input data-testid="input-edit-phone" value={editLead.phone ?? ""} onChange={(e) => setEditLead((p: any) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Input data-testid="input-edit-product" value={editLead.product ?? ""} onChange={(e) => setEditLead((p: any) => ({ ...p, product: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  data-testid="input-edit-notes"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                  value={editLead.notes ?? ""}
                  onChange={(e) => setEditLead((p: any) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLead(null)}>Cancel</Button>
            <Button data-testid="button-save-lead" onClick={handleSaveEdit} disabled={updateLead.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
