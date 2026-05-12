import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListOrganizations, useApproveOrganization, useRejectOrganization, useDeleteOrganization, useUpdateOrganization,
  getListOrganizationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Trash2, Edit, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  approved: { label: "Approved", className: "bg-green-500/15 text-green-400 border-green-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export default function AdminPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: orgs, isLoading } = useListOrganizations({ query: { queryKey: getListOrganizationsQueryKey() } });
  const approve = useApproveOrganization();
  const reject = useRejectOrganization();
  const deleteOrg = useDeleteOrganization();
  const updateOrg = useUpdateOrganization();

  const [rejectOrg, setRejectOrg] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editOrg, setEditOrg] = useState<any>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });

  const handleApprove = async (id: string) => {
    try {
      await approve.mutateAsync({ id });
      invalidate();
      toast({ title: "Organization approved" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectOrg) return;
    try {
      await reject.mutateAsync({ id: rejectOrg.id, data: { reason: rejectReason || null } });
      setRejectOrg(null);
      setRejectReason("");
      invalidate();
      toast({ title: "Organization rejected" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOrg.mutateAsync({ id });
      invalidate();
      toast({ title: "Organization deleted" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleSaveEdit = async () => {
    if (!editOrg) return;
    try {
      await updateOrg.mutateAsync({ id: editOrg.id, data: { name: editOrg.name, maxPages: editOrg.maxPages, maxTeamMembers: editOrg.maxTeamMembers, plan: editOrg.plan } });
      setEditOrg(null);
      invalidate();
      toast({ title: "Organization updated" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-7 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Platform Admin</h1>
            <p className="text-sm text-muted-foreground">Manage all organizations</p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Plan</th>
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
              ) : orgs?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-muted-foreground">No organizations</td>
                </tr>
              ) : (
                orgs?.map((org: any) => (
                  <tr key={org.id} data-testid={`row-org-${org.id}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{org.name}</p>
                      {org.rejectedReason && <p className="text-xs text-red-400 mt-0.5">Reason: {org.rejectedReason}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{org.ownerEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{org.plan}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", STATUS_CONFIG[org.status]?.className)}>
                        {STATUS_CONFIG[org.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(org.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {org.status === "pending" && (
                          <>
                            <button
                              data-testid={`button-approve-${org.id}`}
                              onClick={() => handleApprove(org.id)}
                              className="p-1.5 text-green-500 hover:bg-green-500/10 rounded"
                              title="Approve"
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              data-testid={`button-reject-${org.id}`}
                              onClick={() => setRejectOrg(org)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                              title="Reject"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        <button
                          data-testid={`button-edit-${org.id}`}
                          onClick={() => setEditOrg({ ...org })}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          data-testid={`button-delete-${org.id}`}
                          onClick={() => handleDelete(org.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!rejectOrg} onOpenChange={() => setRejectOrg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Organization</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input data-testid="input-reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOrg(null)}>Cancel</Button>
            <Button data-testid="button-confirm-reject" variant="destructive" onClick={handleReject} disabled={reject.isPending}>
              {reject.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOrg} onOpenChange={() => setEditOrg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Organization</DialogTitle></DialogHeader>
          {editOrg && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input data-testid="input-org-name" value={editOrg.name} onChange={(e) => setEditOrg((p: any) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <select
                  data-testid="select-plan"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editOrg.plan}
                  onChange={(e) => setEditOrg((p: any) => ({ ...p, plan: e.target.value }))}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Max Pages</Label>
                  <Input data-testid="input-max-pages" type="number" value={editOrg.maxPages} onChange={(e) => setEditOrg((p: any) => ({ ...p, maxPages: parseInt(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Members</Label>
                  <Input data-testid="input-max-members" type="number" value={editOrg.maxTeamMembers} onChange={(e) => setEditOrg((p: any) => ({ ...p, maxTeamMembers: parseInt(e.target.value) }))} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>Cancel</Button>
            <Button data-testid="button-save-org" onClick={handleSaveEdit} disabled={updateOrg.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
