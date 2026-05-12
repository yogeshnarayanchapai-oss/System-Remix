import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetSettings, useUpdateSettings, useListTeamMembers, useInviteTeamMember, useRemoveTeamMember, useUpdateTeamMember,
  getGetSettingsQueryKey, getListTeamMembersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Trash2, UserPlus } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: members } = useListTeamMembers({ query: { queryKey: getListTeamMembersQueryKey() } });
  const updateSettings = useUpdateSettings();
  const invite = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateMember = useUpdateTeamMember();

  const [form, setForm] = useState({
    facebookAppId: "",
    facebookAppSecret: "",
    facebookWebhookToken: "",
    aiTone: "professional",
    notificationsEnabled: true,
  });
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", role: "agent" as "admin" | "manager" | "agent" });

  useEffect(() => {
    if (settings) {
      setForm({
        facebookAppId: settings.facebookAppId ?? "",
        facebookAppSecret: settings.facebookAppSecret ?? "",
        facebookWebhookToken: settings.facebookWebhookToken ?? "",
        aiTone: settings.aiTone ?? "professional",
        notificationsEnabled: settings.notificationsEnabled ?? true,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ data: { ...form, facebookAppId: form.facebookAppId || null, facebookAppSecret: form.facebookAppSecret || null, facebookWebhookToken: form.facebookWebhookToken || null } });
      qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleInvite = async () => {
    try {
      await invite.mutateAsync({ data: inviteData });
      setShowInvite(false);
      setInviteData({ email: "", role: "agent" });
      qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
      toast({ title: "Member invited" });
    } catch {
      toast({ title: "Failed to invite", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-7 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your workspace settings</p>
        </div>

        <Tabs defaultValue="facebook">
          <TabsList>
            <TabsTrigger value="facebook">Facebook</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          <TabsContent value="facebook" className="mt-5 space-y-5">
            {isLoading ? (
              <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Facebook App ID</Label>
                  <Input data-testid="input-fb-app-id" value={form.facebookAppId} onChange={(e) => setForm(p => ({ ...p, facebookAppId: e.target.value }))} placeholder="Your Facebook App ID" />
                </div>
                <div className="space-y-1.5">
                  <Label>Facebook App Secret</Label>
                  <Input data-testid="input-fb-secret" type="password" value={form.facebookAppSecret} onChange={(e) => setForm(p => ({ ...p, facebookAppSecret: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label>Webhook Verification Token</Label>
                  <Input data-testid="input-webhook-token" value={form.facebookWebhookToken} onChange={(e) => setForm(p => ({ ...p, facebookWebhookToken: e.target.value }))} placeholder="Custom verification token" />
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Switch
                    data-testid="switch-notifications"
                    checked={form.notificationsEnabled}
                    onCheckedChange={(v) => setForm(p => ({ ...p, notificationsEnabled: v }))}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive alerts for new messages</p>
                  </div>
                </div>
                <Button data-testid="button-save-settings" onClick={handleSave} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-5 space-y-5">
            <div className="space-y-1.5">
              <Label>AI Tone</Label>
              <select
                data-testid="select-ai-tone"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.aiTone}
                onChange={(e) => setForm(p => ({ ...p, aiTone: e.target.value }))}
              >
                {["professional", "friendly", "casual", "formal"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Controls the tone of AI-generated replies</p>
            </div>
            <Button data-testid="button-save-ai" onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save"}
            </Button>
          </TabsContent>

          <TabsContent value="team" className="mt-5 space-y-4">
            <div className="flex justify-end">
              <Button data-testid="button-invite" size="sm" onClick={() => setShowInvite(true)}>
                <UserPlus size={14} className="mr-1" /> Invite Member
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
              {members?.map((member: any) => (
                <div key={member.id} data-testid={`row-member-${member.id}`} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary/10 text-primary shrink-0">
                    {(member.fullName ?? member.email ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{member.fullName ?? member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <select
                    data-testid={`select-role-${member.id}`}
                    className="text-xs h-7 rounded border border-input bg-background px-2"
                    value={member.role}
                    onChange={async (e) => {
                      await updateMember.mutateAsync({ id: member.id, data: { role: e.target.value as "admin" | "manager" | "agent" } });
                      qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="agent">Agent</option>
                  </select>
                  {member.userId !== user?.id && (
                    <button
                      data-testid={`button-remove-${member.id}`}
                      onClick={async () => {
                        await removeMember.mutateAsync({ id: member.id });
                        qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
                        toast({ title: "Member removed" });
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {!members?.length && (
                <p className="px-5 py-6 text-xs text-muted-foreground">No team members yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input data-testid="input-invite-email" type="email" value={inviteData.email} onChange={(e) => setInviteData(p => ({ ...p, email: e.target.value }))} placeholder="team@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                data-testid="select-invite-role"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={inviteData.role}
                onChange={(e) => setInviteData(p => ({ ...p, role: e.target.value as "admin" | "manager" | "agent" }))}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="agent">Agent</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button data-testid="button-confirm-invite" onClick={handleInvite} disabled={invite.isPending}>
              {invite.isPending ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
