import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Minus } from 'lucide-react';
import { type NetworthType, type NetworthGroup } from '@/lib/networthFormat';
import type { NetworthCategory, NetworthSubcategory } from '@/hooks/useNetworth';
import { cn } from '@/lib/utils';
import { SearchableSelect } from './SearchableSelect';

function useSubsInline() {
  return useQuery({
    queryKey: ['networth-subcategories'],
    queryFn: async (): Promise<NetworthSubcategory[]> => {
      const { data, error } = await supabase
        .from('networth_subcategories' as never)
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as NetworthSubcategory[];
    },
  });
}

export interface EntryDraft {
  type: NetworthType;
  group_name: NetworthGroup | '';
  category_id: string;
  subcategory_id: string;
  amount_signed: string;
  source: string;
  description: string;
  entry_date: string;
}

interface Props {
  value: EntryDraft;
  onChange: (patch: Partial<EntryDraft>) => void;
  categories: NetworthCategory[];
  layout?: 'grid' | 'row';
  showDate?: boolean;
}

export function EntryFields({
  value, onChange, categories, layout = 'grid', showDate = true,
}: Props) {
  // Categories filtered by Asset/Liability type, excluding INCOME/EXPENSE source buckets
  const categoriesForType = useMemo(
    () => categories.filter(
      (c) => c.type === value.type && c.group_name !== 'INCOME' && c.group_name !== 'EXPENSE',
    ),
    [categories, value.type],
  );

  // Source list switches by amount sign: + -> INCOME, - -> EXPENSE
  const isNegative = value.amount_signed.trim().startsWith('-');
  const sourceGroup: NetworthGroup = isNegative ? 'EXPENSE' : 'INCOME';
  const sourceOptions = useMemo(
    () => categories.filter((c) => c.group_name === sourceGroup),
    [categories, sourceGroup],
  );

  const { data: subcategories = [] } = useSubsInline();
  const subsForCategory = useMemo(
    () => subcategories.filter((s) => s.category_id === value.category_id && s.is_active),
    [subcategories, value.category_id],
  );

  const handleType = (t: NetworthType) => {
    onChange({ type: t, category_id: '', subcategory_id: '', group_name: '' });
  };
  const handleCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    onChange({
      category_id: id,
      subcategory_id: '',
      group_name: (cat?.group_name as NetworthGroup) || '',
    });
  };
  const handleAmount = (raw: string) => {
    const cleaned = raw.replace(/[^\d.\-]/g, '').replace(/(?!^)-/g, '');
    onChange({ amount_signed: cleaned });
  };
  const toggleSign = () => {
    const v = value.amount_signed.trim();
    if (!v || v === '-') return onChange({ amount_signed: v === '-' ? '' : '-' });
    onChange({ amount_signed: v.startsWith('-') ? v.slice(1) : '-' + v });
  };

  // ---- ROW LAYOUT (compact bulk) ----
  if (layout === 'row') {
    return (
      <>
        {showDate && (
          <Input
            type="date"
            value={value.entry_date}
            onChange={(e) => onChange({ entry_date: e.target.value })}
            className="h-9"
          />
        )}
        <Select value={value.type} onValueChange={(v) => handleType(v as NetworthType)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ASSET">Asset</SelectItem>
            <SelectItem value="LIABILITY">Liability</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={value.category_id || undefined}
          onValueChange={handleCategory}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {categoriesForType.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">None</div>
            ) : categoriesForType.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchableSelect
          value={value.subcategory_id}
          onChange={(v) => onChange({ subcategory_id: v })}
          disabled={!value.category_id}
          placeholder="Subcategory"
          options={subsForCategory.map((s) => ({ value: s.id, label: s.name }))}
          className="h-9"
        />
        <div className="flex">
          <Button
            type="button" variant="outline" size="icon"
            className={cn(
              'h-9 w-9 rounded-r-none border-r-0 shrink-0',
              isNegative ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
            )}
            onClick={toggleSign}
            title="Toggle sign"
          >
            {isNegative ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
          <Input
            type="text" inputMode="decimal"
            value={value.amount_signed}
            onChange={(e) => handleAmount(e.target.value)}
            className={cn(
              'h-9 rounded-l-none font-mono text-right',
              isNegative ? 'text-rose-700' : 'text-emerald-700',
            )}
            placeholder="0.00"
          />
        </div>
        <Select
          value={value.source || undefined}
          onValueChange={(v) => onChange({ source: v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={isNegative ? 'Expense' : 'Income'} />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">None</div>
            ) : sourceOptions.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Note"
          className="h-9"
        />
      </>
    );
  }

  // ---- GRID LAYOUT (single add/edit) ----
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {showDate && (
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={value.entry_date}
            onChange={(e) => onChange({ entry_date: e.target.value })}
          />
        </div>
      )}

      <div>
        <Label>Type</Label>
        <Select value={value.type} onValueChange={(v) => handleType(v as NetworthType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ASSET">Asset</SelectItem>
            <SelectItem value="LIABILITY">Liability</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Category</Label>
        <Select
          value={value.category_id || undefined}
          onValueChange={handleCategory}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categoriesForType.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No categories</div>
            ) : categoriesForType.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Subcategory</Label>
        <SearchableSelect
          value={value.subcategory_id}
          onChange={(v) => onChange({ subcategory_id: v })}
          disabled={!value.category_id}
          placeholder={value.category_id ? 'Select subcategory' : 'Pick category first'}
          options={subsForCategory.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>

      <div>
        <Label>Amount (NPR)</Label>
        <div className="flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              'rounded-r-none border-r-0',
              isNegative ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
            )}
            onClick={toggleSign}
            title="Toggle sign"
          >
            {isNegative ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
          <Input
            type="text"
            inputMode="decimal"
            value={value.amount_signed}
            onChange={(e) => handleAmount(e.target.value)}
            className={cn(
              'rounded-l-none font-mono text-right',
              isNegative ? 'text-rose-700' : 'text-emerald-700',
            )}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <Label>
          Source <span className="text-xs text-muted-foreground">({isNegative ? 'Expense' : 'Income'})</span>
        </Label>
        <Select
          value={value.source || undefined}
          onValueChange={(v) => onChange({ source: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
          <SelectContent>
            {sourceOptions.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No {isNegative ? 'Expense' : 'Income'} categories defined
              </div>
            ) : sourceOptions.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2">
        <Label>Description</Label>
        <Input
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Optional note"
        />
      </div>
    </div>
  );
}

export function blankDraft(): EntryDraft {
  return {
    type: 'ASSET',
    group_name: '',
    category_id: '',
    subcategory_id: '',
    amount_signed: '',
    source: '',
    description: '',
    entry_date: new Date().toISOString().slice(0, 10),
  };
}

export function draftToEntry(
  d: EntryDraft,
  categories: NetworthCategory[],
  subcategories: NetworthSubcategory[] = [],
): {
  entry_date: string; type: NetworthType; category_id: string | null;
  category_name: string; subcategory_id: string | null; subcategory_name: string | null;
  amount_npr: number; description: string | null; source: string | null;
} | null {
  const cat = categories.find((c) => c.id === d.category_id);
  const amt = parseFloat(d.amount_signed.replace(/[^\d.\-]/g, '')) || 0;
  if (!d.entry_date || !cat || amt === 0) return null;
  const sub = subcategories.find((s) => s.id === d.subcategory_id);
  return {
    entry_date: d.entry_date,
    type: cat.type,
    category_id: cat.id,
    category_name: cat.name,
    subcategory_id: sub?.id || null,
    subcategory_name: sub?.name || null,
    amount_npr: amt,
    description: d.description || null,
    source: d.source || null,
  };
}

export function entryToDraft(
  e: { entry_date: string; type: NetworthType; category_id: string | null;
       subcategory_id?: string | null;
       amount_npr: number; description: string | null; source: string | null; },
  categories: NetworthCategory[],
): EntryDraft {
  const cat = categories.find((c) => c.id === e.category_id);
  return {
    type: e.type,
    group_name: (cat?.group_name as NetworthGroup) || '',
    category_id: cat?.id || '',
    subcategory_id: e.subcategory_id || '',
    amount_signed: e.amount_npr < 0 ? String(e.amount_npr) : (e.type === 'LIABILITY' ? `-${e.amount_npr}` : String(e.amount_npr)),
    source: e.source || '',
    description: e.description || '',
    entry_date: e.entry_date,
  };
}

