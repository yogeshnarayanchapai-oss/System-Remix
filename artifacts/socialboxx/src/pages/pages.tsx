import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListPages, useListPageGroups, useCreatePage, useDeletePage, useUpdatePage,
  useCreatePageGroup, useDeletePageGroup,
  getListPagesQueryKey, getListPageGroupsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function PagesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: pages, isLoading } = useListPages({ query: { queryKey: getListPagesQueryKey() } });
  const { data: groups } = useListPageGroups({ query: { queryKey: getListPageGroupsQueryKey() } });
  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const updatePage = useUpdatePage();
  const createGroup = useCreatePageGroup();
  const deleteGroup = useDeletePageGroup();

  const [showAddPage, setShowAddPage] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editPage, setEditPage] = useState<any>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [newPage, setNewPage] = useState({ pageId: "", pageName: "", pageAccessToken: "", groupId: "" });
  const [newGroupName, setNewGroupName] = useState("");
  const [search, setSearch] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListPagesQueryKey() });
    qc.invalidateQueries({ queryKey: getListPageGroupsQueryKey() });
  };

  const handleAddPage = async () => {
    try {
      await createPage.mutateAsync({ data: { ...newPage, groupId: newPage.groupId || null } });
      setShowAddPage(false);
      setNewPage({ pageId: "", pageName: "", pageAccessToken: "", groupId: "" });
      invalidate();
      toast({ title: "Page connected" });
    } catch {
      toast({ title: "Failed to connect page", variant: "destructive" });
    }
  };

  const handleAddGroup = async () => {
    try {
      await createGroup.mutateAsync({ data: { name: newGroupName } });
      setShowAddGroup(false);
      setNewGroupName("");
      invalidate();
      toast({ title: "Group created" });
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" });
    }
  };

  const handleDeletePage = async (id: string) => {
    try {
      await deletePage.mutateAsync({ id });
      invalidate();
      toast({ title: "Page disconnected" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, field: "aiEnabled" | "automationEnabled", val: boolean) => {
    await updatePage.mutateAsync({ id, data: { [field]: val } });
    invalidate();
  };

  const handleSaveEdit = async () => {
    if (!editPage) return;
    try {
      await updatePage.mutateAsync({ id: editPage.id, data: { pageName: editPage.pageName, aiInstructions: editPage.aiInstructions, productName: editPage.productName, productDescription: editPage.productDescription } });
      setEditPage(null);
      invalidate();
      toast({ title: "Page updated" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const filtered = pages?.filter((p: any) => p.pageName.toLowerCase().includes(search.toLowerCase())) ?? [];
  const ungrouped = filtered.filter((p: any) => !p.groupId);
  const toggleGroup = (id: string) => setCollapsedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <AppLayout>
      <div className="p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Connected Pages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{pages?.length ?? 0} pages connected</p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-add-group" variant="outline" size="sm" onClick={() => setShowAddGroup(true)}>
              <Plus size={14} className="mr-1" /> New Group
            </Button>
            <Button data-testid="button-add-page" size="sm" onClick={() => setShowAddPage(true)}>
              <Plus size={14} className="mr-1" /> Connect Page
            </Button>
          </div>
        </div>

        <Input
          data-testid="input-search"
          placeholder="Search pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
        ) : (
          <div className="space-y-4">
            {groups?.map((group: any) => {
              const groupPages = filtered.filter((p: any) => p.groupId === group.id);
              const collapsed = collapsedGroups.has(group.id);
              return (
                <div key={group.id} className="rounded-lg border border-border overflow-hidden">
                  <button
                    data-testid={`button-group-${group.id}`}
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted text-sm font-medium text-foreground"
                  >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {group.name}
                    <Badge variant="secondary" className="ml-1 text-xs">{groupPages.length}</Badge>
                    <span className="flex-1" />
                    <button
                      onClick={async (e) => { e.stopPropagation(); await deleteGroup.mutateAsync({ id: group.id }); invalidate(); }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  </button>
                  {!collapsed && (
                    <div className="divide-y divide-border">
                      {groupPages.map((page: any) => <PageRow key={page.id} page={page} onDelete={handleDeletePage} onToggle={handleToggle} onEdit={setEditPage} />)}
                      {groupPages.length === 0 && <p className="px-5 py-3 text-xs text-muted-foreground">No pages in this group</p>}
                    </div>
                  )}
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ungrouped</div>
                <div className="divide-y divide-border">
                  {ungrouped.map((page: any) => <PageRow key={page.id} page={page} onDelete={handleDeletePage} onToggle={handleToggle} onEdit={setEditPage} />)}
                </div>
              </div>
            )}

            {filtered.length === 0 && !isLoading && (
              <div className="text-center py-16 text-muted-foreground">
                <Globe size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pages connected yet</p>
                <Button size="sm" className="mt-3" onClick={() => setShowAddPage(true)}>Connect your first page</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showAddPage} onOpenChange={setShowAddPage}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connect Facebook Page</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Page ID</Label>
              <Input data-testid="input-page-id" value={newPage.pageId} onChange={(e) => setNewPage(p => ({ ...p, pageId: e.target.value }))} placeholder="Facebook Page ID" />
            </div>
            <div className="space-y-1.5">
              <Label>Page Name</Label>
              <Input data-testid="input-page-name" value={newPage.pageName} onChange={(e) => setNewPage(p => ({ ...p, pageName: e.target.value }))} placeholder="My Business Page" />
            </div>
            <div className="space-y-1.5">
              <Label>Access Token</Label>
              <Input data-testid="input-access-token" value={newPage.pageAccessToken} onChange={(e) => setNewPage(p => ({ ...p, pageAccessToken: e.target.value }))} placeholder="Page access token" type="password" />
            </div>
            <div className="space-y-1.5">
              <Label>Group (optional)</Label>
              <select
                data-testid="select-group"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={newPage.groupId}
                onChange={(e) => setNewPage(p => ({ ...p, groupId: e.target.value }))}
              >
                <option value="">No group</option>
                {groups?.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPage(false)}>Cancel</Button>
            <Button data-testid="button-confirm-add" onClick={handleAddPage} disabled={createPage.isPending}>
              {createPage.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Page Group</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Group Name</Label>
            <Input data-testid="input-group-name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. E-commerce Pages" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGroup(false)}>Cancel</Button>
            <Button data-testid="button-confirm-group" onClick={handleAddGroup} disabled={createGroup.isPending}>
              {createGroup.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPage} onOpenChange={() => setEditPage(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Page Settings</DialogTitle></DialogHeader>
          {editPage && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Page Name</Label>
                <Input data-testid="input-edit-name" value={editPage.pageName} onChange={(e) => setEditPage((p: any) => ({ ...p, pageName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>AI Instructions</Label>
                <textarea
                  data-testid="input-ai-instructions"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                  value={editPage.aiInstructions ?? ""}
                  onChange={(e) => setEditPage((p: any) => ({ ...p, aiInstructions: e.target.value }))}
                  placeholder="Instructions for AI replies..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Product Name</Label>
                <Input data-testid="input-product-name" value={editPage.productName ?? ""} onChange={(e) => setEditPage((p: any) => ({ ...p, productName: e.target.value }))} placeholder="What product does this page sell?" />
              </div>
              <div className="space-y-1.5">
                <Label>Product Description</Label>
                <textarea
                  data-testid="input-product-description"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                  value={editPage.productDescription ?? ""}
                  onChange={(e) => setEditPage((p: any) => ({ ...p, productDescription: e.target.value }))}
                  placeholder="Brief product description..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPage(null)}>Cancel</Button>
            <Button data-testid="button-save-edit" onClick={handleSaveEdit} disabled={updatePage.isPending}>
              {updatePage.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function PageRow({ page, onDelete, onToggle, onEdit }: { page: any; onDelete: (id: string) => void; onToggle: (id: string, field: "aiEnabled" | "automationEnabled", val: boolean) => void; onEdit: (page: any) => void; }) {
  return (
    <div data-testid={`row-page-${page.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-primary/10 text-primary">
        {page.pageName[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{page.pageName}</p>
        <p className="text-xs text-muted-foreground">{page.pageId}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Switch data-testid={`switch-ai-${page.id}`} checked={page.aiEnabled} onCheckedChange={(v) => onToggle(page.id, "aiEnabled", v)} />
          <span className="text-xs text-muted-foreground">AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch data-testid={`switch-auto-${page.id}`} checked={page.automationEnabled} onCheckedChange={(v) => onToggle(page.id, "automationEnabled", v)} />
          <span className="text-xs text-muted-foreground">Auto</span>
        </div>
        <Badge variant={page.connectionStatus === "active" ? "default" : "secondary"} className="text-xs">
          {page.connectionStatus}
        </Badge>
        <button data-testid={`button-edit-${page.id}`} onClick={() => onEdit(page)} className="p-1.5 text-muted-foreground hover:text-foreground">
          <Edit size={13} />
        </button>
        <button data-testid={`button-delete-${page.id}`} onClick={() => onDelete(page.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
