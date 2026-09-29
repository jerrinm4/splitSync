import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCategories, useAddCategory, useUpdateCategory, useDeleteCategory } from '@/features/expenses/hooks/useCategories'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useToast } from '@/hooks/use-toast'
import { Plus, X, Edit, Save, Tag } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { Label } from '@/components/ui/label'

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
] as const

interface ManageCategoriesModalProps {
  tripId: string;
  trigger?: React.ReactNode;
}

export function ManageCategoriesModal({ tripId, trigger }: ManageCategoriesModalProps) {
  const { data: categories = [], isLoading } = useCategories(tripId)
  const addCategory = useAddCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLORS[0])
  const [newEstimatedBudget, setNewEstimatedBudget] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<string>(CATEGORY_COLORS[0])
  const [editEstimatedBudget, setEditEstimatedBudget] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const estimatedAmountPaise = newEstimatedBudget ? Math.round(parseFloat(newEstimatedBudget) * 100) : 0
    try {
      await addCategory.mutateAsync({
        tripId,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        estimatedAmountPaise
      })
      setNewCategoryName('')
      setNewEstimatedBudget('')
      setNewCategoryColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)] || CATEGORY_COLORS[0])
      toast({ title: 'Category added' })
    } catch (err: any) {
      toast({ title: 'Error adding category', description: err.message, variant: 'destructive' })
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return
    const estimatedAmountPaise = editEstimatedBudget ? Math.round(parseFloat(editEstimatedBudget) * 100) : 0
    try {
      await updateCategory.mutateAsync({
        categoryId: editingId,
        tripId,
        name: editName.trim(),
        color: editColor,
        estimatedAmountPaise
      })
      setEditingId(null)
      toast({ title: 'Category updated' })
    } catch (err: any) {
      toast({ title: 'Error updating category', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteCategory.mutateAsync({ categoryId: deletingId, tripId })
      toast({ title: 'Category deleted' })
    } catch (err: any) {
      toast({ title: 'Error deleting category', description: err.message, variant: 'destructive' })
    }
    setDeletingId(null)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="h-9">
              <Tag className="w-4 h-4 mr-2" /> Manage Categories
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col glass border border-border/50">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Add, rename or remove categories and set their estimated budgets.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6 pt-2 pb-6">
            <form onSubmit={handleAdd} className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/50">
              <h3 className="text-sm font-semibold text-foreground">Add New Category</h3>

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category-name" className="text-xs">Category Name</Label>
                  <Input
                    id="category-name" placeholder="Enter category name"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="bg-background/50 h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category-budget" className="text-xs">Estimated Budget</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    id="category-budget" value={newEstimatedBudget}
                    onChange={e => setNewEstimatedBudget(e.target.value)}
                    className="bg-background/50 h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Color</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_COLORS.map(c => (
                      <button
                        key={c} aria-label={`Choose color ${c}`} aria-pressed={newCategoryColor === c}
                        type="button"
                        className={`w-6 h-6 rounded-full transition-all ${newCategoryColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewCategoryColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full h-9"
                disabled={!newCategoryName.trim() || addCategory.isPending}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Category
              </Button>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Existing Categories</h3>

              {isLoading ? (
                <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                  No categories added yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat: any) => (
                    <div key={cat.id} className="bg-card rounded-lg border border-border/50 p-3 shadow-sm transition-all">
                      {editingId === cat.id ? (
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            <Input
                              aria-label="Edit category name" placeholder="Name"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="h-8 text-sm"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label="Edit category budget" placeholder="Estimated Budget"
                              value={editEstimatedBudget}
                              onChange={e => setEditEstimatedBudget(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {CATEGORY_COLORS.map(c => (
                              <button
                                key={c} aria-label={`Choose color ${c}`} aria-pressed={editColor === c}
                                type="button"
                                className={`w-6 h-6 rounded-full transition-all ${editColor === c ? 'ring-2 ring-offset-1 ring-offset-background ring-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setEditColor(c)}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" onClick={handleSaveEdit} className="flex-1 h-8 text-xs" disabled={!editName.trim() || updateCategory.isPending}>
                              <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="flex-1 h-8 text-xs">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                              <p className="text-[10px] text-muted-foreground font-medium">
                                Budget: {cat.estimated_amount_paise ? formatMoney(cat.estimated_amount_paise) : 'Not set'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              aria-label={`Edit category ${cat.name}`} onClick={() => {
                                setEditingId(cat.id)
                                setEditName(cat.name)
                                setEditColor(cat.color)
                                setEditEstimatedBudget(cat.estimated_amount_paise ? (cat.estimated_amount_paise / 100).toString() : '')
                              }}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete category ${cat.name}`} onClick={() => setDeletingId(cat.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        description="This will remove the category from all associated expenses. The expenses themselves will not be deleted."
        requiredText=""
        isDestructive={true}
      />
    </>
  )
}
