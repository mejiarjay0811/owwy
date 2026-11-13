"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmojiTile } from "@/components/ui/display";
import { ColorPicker, EmojiPicker } from "@/components/ui/emoji-picker";
import { Field, Segmented, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { CATEGORY_COLORS, CATEGORY_EMOJI_CHOICES } from "@/lib/defaults/categories";
import { createCategory, deleteCategory, updateCategory } from "@/lib/storage/repositories/categories";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { Category, CategoryKind } from "@/types/models";

export function CategoriesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state } = useFinance();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const list = state.categories.filter((c) => c.kind === kind);

  return (
    <>
      <Sheet
        open={open && editing === null}
        onOpenChange={onOpenChange}
        title="Categories"
        description="Rename, recolor, hide, or add your own. Keywords teach smart input."
        headerAction={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus />
            New
          </Button>
        }
      >
        <Segmented
          label="Category type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", label: "Spending" },
            { value: "income", label: "Income" },
          ]}
          className="mb-4"
        />
        <ul className="divide-y divide-line/60">
          {list.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-3 py-2.5", c.archived && "opacity-50")}>
              <button type="button" onClick={() => setEditing(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <EmojiTile emoji={c.emoji} color={c.color} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block truncate text-caption text-ink-3">{c.keywords.slice(0, 5).join(", ") || "No keywords"}</span>
                </span>
              </button>
              <IconButton
                size="sm"
                label={c.archived ? `Show ${c.name}` : `Hide ${c.name}`}
                onClick={async () => {
                  await updateCategory(c.id, { archived: !c.archived });
                  toast.show(c.archived ? `${c.name} is visible again` : `${c.name} hidden`, { description: c.archived ? undefined : "Past transactions keep it." });
                }}
              >
                {c.archived ? <EyeOff /> : <Eye />}
              </IconButton>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={open && editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New category" : "Edit category"} size="sm">
        {editing !== null ? <CategoryForm category={editing === "new" ? undefined : editing} kind={kind} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function CategoryForm({ category, kind, onDone }: { category?: Category; kind: CategoryKind; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "📦");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [keywords, setKeywords] = useState(category?.keywords.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError("Give it a name.");
    const input = { name, emoji, color, keywords: keywords.split(",") };
    try {
      if (category) await updateCategory(category.id, input);
      else await createCategory({ ...input, kind });
      toast.success(category ? "Category saved" : `${emoji} ${name} added`);
      onDone();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <EmojiPicker label="Icon" value={emoji} onChange={setEmoji} options={CATEGORY_EMOJI_CHOICES} />
      <Field label="Name" error={error}>
        {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />}
      </Field>
      <ColorPicker label="Color" value={color} onChange={setColor} options={CATEGORY_COLORS} />
      <Field label="Keywords" hint="Words that mean this category when you type, e.g. “milk tea, boba”.">
        {(props) => <TextInput {...props} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="comma, separated, words" />}
      </Field>
      <div className="flex gap-2">
        {category && !category.isDefault ? (
          <Button variant="dangerSoft" size="lg" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
        <Button size="lg" className="flex-1" onClick={save}>
          Save
        </Button>
      </div>
      {category ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${category.name}?`}
          description="Its transactions and bills move to “Other” so no money disappears from your reports. Its budgets are removed."
          confirmLabel="Delete category"
          destructive
          onConfirm={async () => {
            await deleteCategory(category.id);
            toast.show(`${category.name} deleted`);
            onDone();
          }}
        />
      ) : null}
    </div>
  );
}
