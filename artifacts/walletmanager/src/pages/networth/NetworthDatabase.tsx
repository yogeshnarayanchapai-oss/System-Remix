import { useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Search, Upload, Download, Trash2, FileUp } from 'lucide-react';
import {
  useNetworthCategories, useNetworthEntries, useSaveEntry,
  useDeleteEntry, useBulkInsertEntries,
  useNetworthSubcategories, useSaveSubcategory, useDeleteSubcategory, type NetworthEntry,
} from '@/hooks/useNetworth';
import { dayOfWeek, formatNprFull, formatNprShort, type NetworthType } from '@/lib/networthFormat';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import {
  EntryFields, blankDraft, draftToEntry, entryToDraft, type EntryDraft,
} from '@/components/networth/EntryFields';

export default function NetworthDatabase() {
  const { data: entries = [], isLoading } = useNetworthEntries();
  const { data: categories = [] } = useNetworthCategories();
  const saveEntry = useSaveEntry();
  const deleteEntry = useDeleteEntry();
  const bulkInsert = useBulkInsertEntries();
  const { data: subcategories = [] } = useNetworthSubcategories();
  const saveSubcategory = useSaveSubcategory();
  const deleteSubcategory = useDeleteSubcategory();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // ---- Subcategory Tabs (chips) ----
  const [activeTab, setActiveTab] = useState<string | null>(null); // subcategory name
  const [showAllTabs, setShowAllTabs] = useState(false);
  const [tabSearch, setTabSearch] = useState('');
  const TAB_LIMIT = 10;

  // ---- Add Subcategory modal ----
  const [subOpen, setSubOpen] = useState(false);
  const [subEditingId, setSubEditingId] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subCategoryId, setSubCategoryId] = useState<string>('');

  const today = new Date();
  const [datePreset, setDatePreset] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM'>('THIS_MONTH');
  const [filterFrom, setFilterFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [filterTo, setFilterTo] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));

  const handleDatePreset = (v: 'THIS_MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM') => {
    setDatePreset(v);
    const t = new Date();
    if (v === 'THIS_MONTH') {
      setFilterFrom(format(startOfMonth(t), 'yyyy-MM-dd'));
      setFilterTo(format(endOfMonth(t), 'yyyy-MM-dd'));
    } else if (v === 'LAST_MONTH') {
      const lm = subMonths(t, 1);
      setFilterFrom(format(startOfMonth(lm), 'yyyy-MM-dd'));
      setFilterTo(format(endOfMonth(lm), 'yyyy-MM-dd'));
    } else if (v === 'ALL') {
      setFilterFrom('');
      setFilterTo('');
    }
  };

  // ---- Add / Edit single ----
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(blankDraft());

  const openNew = (presetSubcategoryName?: string) => {
    setEditingId(null);
    const d = blankDraft();
    if (presetSubcategoryName) {
      const sub = subcategories.find((s) => s.name === presetSubcategoryName);
      if (sub) {
        const cat = categories.find((c) => c.id === sub.category_id);
        d.subcategory_id = sub.id;
        if (cat) {
          d.type = cat.type;
          d.category_id = cat.id;
          d.group_name = cat.group_name;
        }
      } else {
        // fallback: derive from previous entry of this subcategory
        const prev = entries.find((e) => e.subcategory_name === presetSubcategoryName);
        if (prev) {
          d.type = prev.type;
          if (prev.category_id) d.category_id = prev.category_id;
          if (prev.subcategory_id) d.subcategory_id = prev.subcategory_id;
        }
      }
    }
    setDraft(d);
    setOpen(true);
  };
  const openEdit = (e: NetworthEntry) => {
    setEditingId(e.id);
    setDraft(entryToDraft(e, categories));
    setOpen(true);
  };
  const handleSave = () => {
    const parsed = draftToEntry(draft, categories, subcategories);
    if (!parsed) {
      toast.error('Pick category and enter a non-zero amount');
      return;
    }
    saveEntry.mutate(
      editingId ? { id: editingId, ...parsed } : parsed,
      { onSuccess: () => setOpen(false) },
    );
  };

  // ---- Bulk ----
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<EntryDraft[]>([]);

  const openBulk = () => {
    setBulkRows(Array.from({ length: 5 }, blankDraft));
    setBulkOpen(true);
  };
  const updateBulkRow = (i: number, patch: Partial<EntryDraft>) => {
    setBulkRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addBulkRow = () => setBulkRows((r) => [...r, blankDraft()]);
  const removeBulkRow = (i: number) => setBulkRows((r) => r.filter((_, idx) => idx !== i));

  const handleBulkSave = () => {
    const valid = bulkRows
      .map((r) => draftToEntry(r, categories, subcategories))
      .filter(Boolean) as Parameters<typeof bulkInsert.mutate>[0];
    if (!valid.length) {
      toast.error('Add at least one row with category and amount');
      return;
    }
    bulkInsert.mutate(valid, { onSuccess: () => setBulkOpen(false) });
  };

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let rows = entries;
    if (activeTab) {
      // Tab click bypasses date filters; shows all entries for that subcategory
      rows = rows.filter((r) => r.subcategory_name === activeTab);
    } else {
      if (filterFrom) rows = rows.filter((r) => r.entry_date >= filterFrom);
      if (filterTo) rows = rows.filter((r) => r.entry_date <= filterTo);
      if (filterType !== 'ALL') rows = rows.filter((r) => r.type === filterType);
      if (filterCategory !== 'ALL') rows = rows.filter((r) => r.category_name === filterCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.category_name.toLowerCase().includes(q) ||
          r.subcategory_name?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.source?.toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return a.entry_date.localeCompare(b.entry_date) || (a.created_at || '').localeCompare(b.created_at || '');
        case 'amount_desc': return b.amount_npr - a.amount_npr;
        case 'amount_asc': return a.amount_npr - b.amount_npr;
        default: return b.entry_date.localeCompare(a.entry_date) || (b.created_at || '').localeCompare(a.created_at || '');
      }
    });
    return rows;
  }, [entries, search, filterType, filterCategory, sortBy, filterFrom, filterTo, activeTab]);

  // ---- Subcategory chip data: includes ALL defined subcategories + any orphan subcategory_names found in entries ----
  const subChips = useMemo(() => {
    const map = new Map<string, { name: string; type: NetworthType; categoryName: string; total: number; count: number }>();
    // Seed from defined subcategories
    for (const s of subcategories) {
      const cat = categories.find((c) => c.id === s.category_id);
      if (!cat) continue;
      map.set(s.name, { name: s.name, type: cat.type, categoryName: cat.name, total: 0, count: 0 });
    }
    // Aggregate entries
    for (const e of entries) {
      if (!e.subcategory_name) continue;
      const cur = map.get(e.subcategory_name) || {
        name: e.subcategory_name, type: e.type, categoryName: e.category_name, total: 0, count: 0,
      };
      cur.total += Number(e.amount_npr || 0);
      cur.count += 1;
      map.set(e.subcategory_name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [subcategories, categories, entries]);

  const filteredChips = useMemo(() => {
    const q = (tabSearch || search).trim().toLowerCase();
    if (!q) return subChips;
    return subChips.filter((c) => c.name.toLowerCase().includes(q) || c.categoryName.toLowerCase().includes(q));
  }, [subChips, search, tabSearch]);

  const visibleChips = showAllTabs ? filteredChips : filteredChips.slice(0, TAB_LIMIT);
  const activeChip = activeTab ? subChips.find((c) => c.name === activeTab) : null;

  // CSV export
  const handleExportCsv = () => {
    const header = ['Date', 'Day', 'Type', 'Category', 'Amount (NPR)', 'Description', 'Source'];
    const rows = filtered.map((r) => [
      r.entry_date,
      dayOfWeek(r.entry_date),
      r.type,
      r.category_name,
      r.amount_npr,
      (r.description || '').replace(/"/g, '""'),
      (r.source || '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `networth-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV import
  const handleImportCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error('CSV is empty');
      return;
    }
    const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
    const idx = (name: string) => headers.findIndex((h) => h.includes(name));
    const dateIdx = idx('date');
    const typeIdx = idx('type');
    const catIdx = idx('category');
    const amtIdx = idx('amount');
    const descIdx = idx('description');
    const srcIdx = idx('source');
    if (dateIdx < 0 || typeIdx < 0 || catIdx < 0 || amtIdx < 0) {
      toast.error('CSV must have Date, Type, Category, Amount columns');
      return;
    }

    const parseLine = (line: string) => {
      const cells: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
        else cur += ch;
      }
      cells.push(cur);
      return cells;
    };

    const rows = lines.slice(1).map((l) => {
      const c = parseLine(l);
      const catName = c[catIdx]?.trim();
      const cat = categories.find((cc) => cc.name.toLowerCase() === catName?.toLowerCase());
      const typeRaw = c[typeIdx]?.trim().toUpperCase();
      const type: NetworthType = (typeRaw === 'LIABILITY' || typeRaw === 'LIABILITIES') ? 'LIABILITY' : 'ASSET';
      return {
        entry_date: c[dateIdx]?.trim() || format(new Date(), 'yyyy-MM-dd'),
        type: cat?.type || type,
        category_id: cat?.id || null,
        category_name: catName || 'Uncategorized',
        amount_npr: Math.abs(parseFloat(c[amtIdx]?.replace(/[^\d.-]/g, '') || '0')) || 0,
        description: descIdx >= 0 ? c[descIdx]?.trim() || null : null,
        source: srcIdx >= 0 ? c[srcIdx]?.trim() || null : null,
      };
    });
    bulkInsert.mutate(rows);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Net Worth Database"
        description={`${entries.length} entries`}
        actions={
          <>
            <input
              ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportCsv(f);
                e.target.value = '';
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Import / Export">
                  <FileUp className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />Import CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv}>
                  <Download className="mr-2 h-4 w-4" />Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" />Add Entry</Button>
            <Button onClick={openBulk}><Plus className="mr-2 h-4 w-4" />Bulk Entry</Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search description, category, source..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={datePreset} onValueChange={(v) => handleDatePreset(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="THIS_MONTH">This Month</SelectItem>
              <SelectItem value="LAST_MONTH">Last Month</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="CUSTOM">Custom</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'CUSTOM' && (
            <>
              <Input type="date" className="w-40" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              <Input type="date" className="w-40" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </>
          )}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="ASSET">Assets</SelectItem>
              <SelectItem value="LIABILITY">Liabilities</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || datePreset !== 'THIS_MONTH' || filterFrom || filterTo || filterType !== 'ALL' || filterCategory !== 'ALL' || activeTab) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                handleDatePreset('THIS_MONTH');
                setFilterFrom('');
                setFilterTo('');
                setFilterType('ALL');
                setFilterCategory('ALL');
                setActiveTab(null);
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Subcategory Tabs - compact row */}
      {subChips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1">
          {visibleChips.map((c) => {
            const isActive = activeTab === c.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setActiveTab(isActive ? null : c.name)}
                onDoubleClick={() => {
                  const sub = subcategories.find((s) => s.name === c.name);
                  if (sub) {
                    setSubEditingId(sub.id);
                    setSubName(sub.name);
                    setSubCategoryId(sub.category_id);
                    setSubOpen(true);
                  }
                }}
                className={`px-2 py-0.5 rounded border text-[11px] leading-tight transition ${
                  isActive
                    ? 'border-primary ring-1 ring-primary/40 bg-background'
                    : c.type === 'ASSET'
                      ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-400'
                      : 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-400'
                }`}
              >
                {c.name}
              </button>
            );
          })}
          <button
            type="button"
            title="Add subcategory"
            onClick={() => { setSubEditingId(null); setSubName(''); setSubCategoryId(categories[0]?.id || ''); setSubOpen(true); }}
            className="px-1.5 py-0.5 rounded border border-dashed text-[11px] leading-tight text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
          </button>
          {filteredChips.length > TAB_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllTabs((s) => !s)}
              className="px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground hover:underline"
            >
              {showAllTabs ? 'See less' : `See more (${filteredChips.length - TAB_LIMIT})`}
            </button>
          )}
        </div>
      )}
      {activeChip && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1">
          <div className="text-[11px]">
            <span className="font-semibold text-foreground">{activeChip.name}</span> ·{' '}
            <span className={`font-mono ${activeChip.type === 'LIABILITY' ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatNprShort(activeChip.total)} ({activeChip.count} {activeChip.count === 1 ? 'entry' : 'entries'})
            </span>
          </div>
          <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => openNew(activeChip.name)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount (NPR)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No entries</TableCell></TableRow>
              ) : (
                filtered.map((r, i) => (
                  <TableRow
                    key={r.id}
                    className={r.type === 'ASSET' ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-red-50/50 dark:bg-red-950/20'}
                  >
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{format(new Date(r.entry_date), 'd-MMM-yy')}</TableCell>
                    <TableCell>
                      <span className={r.type === 'ASSET' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {r.type}
                      </span>
                    </TableCell>
                    <TableCell>{r.category_name}</TableCell>
                    <TableCell className={`text-right font-mono ${r.amount_npr < 0 || r.type === 'LIABILITY' ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                      {r.amount_npr < 0
                        ? formatNprFull(r.amount_npr)
                        : formatNprFull(Math.round(r.amount_npr)).replace(/\.00$/, '')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell>{r.source}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(r)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmId(r.id)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit single */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'New Entry'}</DialogTitle>
          </DialogHeader>
          <EntryFields
            value={draft}
            onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
            categories={categories}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveEntry.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-[98vw] sm:max-w-[1200px]">
          <DialogHeader>
            <DialogTitle>Bulk Entry</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto pr-1">
            <div className="grid gap-2 px-1 pb-2 text-xs font-semibold text-muted-foreground"
              style={{ gridTemplateColumns: '120px 100px 130px 130px 150px 130px 1fr 36px' }}>
              <div>Date</div>
              <div>Type</div>
              <div>Category</div>
              <div>Subcategory</div>
              <div className="text-right">Amount</div>
              <div>Source</div>
              <div>Description</div>
              <div></div>
            </div>
            <div className="space-y-1">
              {bulkRows.map((row, i) => (
                <div key={i} className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: '120px 100px 130px 130px 150px 130px 1fr 36px' }}>
                  <EntryFields
                    value={row}
                    onChange={(p) => updateBulkRow(i, p)}
                    categories={categories}
                    layout="row"
                  />
                  <Button
                    variant="ghost" size="icon" className="h-9 w-9"
                    onClick={() => removeBulkRow(i)}
                    disabled={bulkRows.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={addBulkRow}>
              <Plus className="mr-1 h-3.5 w-3.5" />Add Row
            </Button>
            <p className="text-xs text-muted-foreground">
              Empty rows are skipped. Sign chooses Income vs Expense source.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkSave} disabled={bulkInsert.isPending}>
              Save All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subcategory */}
      <Dialog open={subOpen} onOpenChange={(o) => { setSubOpen(o); if (!o) setSubEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{subEditingId ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Gold, Jagga, Computer" />
            </div>
            <div>
              <Label>Parent Category</Label>
              <Select value={subCategoryId || undefined} onValueChange={setSubCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select parent category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-xs text-muted-foreground">({c.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {subEditingId ? (
              <Button
                variant="destructive"
                onClick={() => {
                  if (!subEditingId) return;
                  if (!confirm('Delete this subcategory?')) return;
                  deleteSubcategory.mutate(subEditingId, {
                    onSuccess: () => { setSubOpen(false); setSubEditingId(null); },
                  });
                }}
                disabled={deleteSubcategory.isPending}
              >
                Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!subName.trim()) { toast.error('Enter a name'); return; }
                  if (!subCategoryId) { toast.error('Pick parent category'); return; }
                  saveSubcategory.mutate(
                    { id: subEditingId || undefined, name: subName.trim(), category_id: subCategoryId },
                    { onSuccess: () => { setSubOpen(false); setSubEditingId(null); } },
                  );
                }}
                disabled={saveSubcategory.isPending}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Delete entry?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (confirmId) deleteEntry.mutate(confirmId); setConfirmId(null); }}
      />
    </AppLayout>
  );
}
