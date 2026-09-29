import { useState } from 'react'
import { useAddMemberGroup, useUpdateMemberGroup, useDeleteMemberGroup } from '@/features/members/hooks/useMemberGroups'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Users, Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ManageGroupsModalProps {
  tripId: string
  members: any[]
  groups: any[]
  trigger?: React.ReactNode
}

export function ManageGroupsModal({ tripId, members, groups, trigger }: ManageGroupsModalProps) {
  const [open, setOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())

  const addGroup = useAddMemberGroup()
  const updateGroup = useUpdateMemberGroup()
  const deleteGroup = useDeleteMemberGroup()
  const { toast } = useToast()

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetForm()
    }
  }

  const resetForm = () => {
    setEditingGroupId(null)
    setName('')
    setSelectedMemberIds(new Set())
  }

  const handleEdit = (group: any) => {
    setEditingGroupId(group.id)
    setName(group.name)
    setSelectedMemberIds(new Set(group.member_ids || []))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Group name is required', variant: 'destructive' })
      return
    }

    try {
      if (editingGroupId) {
        await updateGroup.mutateAsync({
          groupId: editingGroupId,
          tripId,
          updates: {
            name: name.trim(),
            member_ids: Array.from(selectedMemberIds)
          }
        })
        toast({ title: 'Group updated' })
      } else {
        await addGroup.mutateAsync({
          tripId,
          name: name.trim(),
          memberIds: Array.from(selectedMemberIds)
        })
        toast({ title: 'Group created' })
      }
      resetForm()
    } catch (err: any) {
      toast({ title: 'Failed to save group', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this group?')) {
      try {
        await deleteGroup.mutateAsync({ groupId, tripId })
        toast({ title: 'Group deleted' })
        if (editingGroupId === groupId) resetForm()
      } catch (err: any) {
        toast({ title: 'Failed to delete group', description: err.message, variant: 'destructive' })
      }
    }
  }

  const toggleMember = (memberId: string) => {
    const next = new Set(selectedMemberIds)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    setSelectedMemberIds(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button aria-label="Manage member groups" variant="outline" className="rounded-full shadow-sm">
            <Users className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Groups</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass border border-border/50 max-w-md max-h-[90vh] overflow-y-auto no-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Manage Member Groups
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {groups.length > 0 && !editingGroupId && (
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Existing Groups</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                    <div>
                      <div className="font-semibold text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.member_ids?.length || 0} members</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={`Edit group ${g.name}`} onClick={() => handleEdit(g)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label={`Delete group ${g.name}`} onClick={() => handleDelete(g.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 p-4 rounded-xl border border-border/50 bg-background/30">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-bold text-sm">
                {editingGroupId ? 'Edit Group' : 'Create New Group'}
              </Label>
              {editingGroupId && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={resetForm}>
                  <X className="w-3 h-3 mr-1" /> Cancel Edit
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-name" className="text-xs">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-background/80 h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex justify-between items-center">
                <span>Select Members</span>
                <span className="text-muted-foreground font-normal">{selectedMemberIds.size} selected</span>
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-1 p-1 rounded-md border border-border/30 bg-background/50">
                {members.map(m => (
                  <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-background/80 rounded-md cursor-pointer transition-colors">
                    <Checkbox
                      checked={selectedMemberIds.has(m.id)}
                      onCheckedChange={() => toggleMember(m.id)}
                    />
                    <span className={`text-sm ${m.status === 'INACTIVE' ? 'text-muted-foreground italic' : ''}`}>
                      {m.name} {m.status === 'INACTIVE' ? '(Inactive)' : ''}
                    </span>
                  </label>
                ))}
                {members.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">No members found.</div>
                )}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={addGroup.isPending || updateGroup.isPending}>
              {editingGroupId ? (
                <><Save className="w-4 h-4 mr-2" /> Save Changes</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Create Group</>
              )}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
