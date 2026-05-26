"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#000000", "#374151", "#6B7280", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899",
];

type Props = { value: string; onChange: (val: string) => void };

export function LessonContentEditor({ value, onChange }: Props) {
  const [mounted, setMounted] = useState(false);
  const initialised = useRef(false);
  const [imagePopover, setImagePopover] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "min-h-[320px] px-4 py-3 focus:outline-none text-sm text-gray-800",
      },
    },
  });

  // Sync external value only on first mount
  useEffect(() => {
    if (editor && !initialised.current && value) {
      editor.commands.setContent(value);
      initialised.current = true;
    }
  }, [editor, value]);

  function insertImageUrl() {
    if (!imageUrl.trim() || !editor) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl("");
    setImagePopover(false);
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (file.size > 10 * 1024 * 1024) { alert("Max image size is 10MB."); return; }
    setImageUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
    if (!res.ok) { alert(await res.text()); setImageUploading(false); return; }
    const { url } = await res.json();
    editor.chain().focus().setImage({ src: url }).run();
    setImageUploading(false);
    setImagePopover(false);
    e.target.value = "";
  }

  if (!mounted || !editor) return (
    <div>
      <label className="block text-sm font-medium mb-1">Content</label>
      <div className="border rounded-xl h-48 bg-white flex items-center justify-center text-sm text-gray-400">
        Loading editor…
      </div>
    </div>
  );

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-sm font-medium transition ${active ? "bg-gray-200" : "hover:bg-gray-100"}`;

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Content</label>
      <div className="border rounded-xl bg-white">
        {/* Toolbar */}
        <div className="relative flex flex-wrap items-center gap-1 px-3 py-2 border-b bg-gray-50 rounded-t-xl">

          {/* Heading size */}
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().setHeading({ level: Number(val) as 1|2|3 }).run();
            }}
            value={
              editor.isActive("heading", { level: 1 }) ? "1" :
              editor.isActive("heading", { level: 2 }) ? "2" :
              editor.isActive("heading", { level: 3 }) ? "3" : "p"
            }
            className="text-sm border rounded px-2 py-1 bg-white focus:outline-none"
          >
            <option value="p">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Bold */}
          <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
            <strong>B</strong>
          </button>

          {/* Italic */}
          <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
            <em>I</em>
          </button>

          {/* Underline */}
          <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}>
            <span className="underline">U</span>
          </button>

          {/* Strikethrough */}
          <button type="button" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}>
            <span className="line-through">S</span>
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Text align */}
          <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))}>⬤≡</button>
          <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))}>≡</button>
          <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))}>≡⬤</button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Bullet list */}
          <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>

          {/* Ordered list */}
          <button type="button" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>

          {/* Blockquote */}
          <button type="button" title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>❝</button>

          {/* Horizontal rule */}
          <button type="button" title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>―</button>

          {/* Table */}
          {editor.isActive("table") ? (
            <>
              <button type="button" title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()} className={btn(false)}>+col</button>
              <button type="button" title="Add row after" onClick={() => editor.chain().focus().addRowAfter().run()} className={btn(false)}>+row</button>
              <button type="button" title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()} className={btn(false)}>-col</button>
              <button type="button" title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()} className={btn(false)}>-row</button>
              <button type="button" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} className={btn(false) + " text-red-500"}>✕tbl</button>
            </>
          ) : (
            <button type="button" title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={btn(false)}>⊞ Table</button>
          )}

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Text color */}
          <div className="flex items-center gap-1 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={`Color: ${color}`}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition"
                style={{ backgroundColor: color }}
              />
            ))}
            <label title="Custom color" className="w-5 h-5 rounded-full border border-gray-300 overflow-hidden cursor-pointer hover:scale-110 transition flex items-center justify-center text-xs">
              <input
                type="color"
                className="opacity-0 absolute w-0 h-0"
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
              +
            </label>
          </div>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Image */}
          <div className="relative">
            <button
              type="button"
              title="Insert image"
              onClick={() => setImagePopover((v) => !v)}
              className={btn(imagePopover)}
            >
              🖼 Image
            </button>
            {imagePopover && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-xl shadow-lg p-3 w-72 space-y-2">
                <p className="text-xs font-medium text-gray-600">Insert image</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Paste image URL…"
                    className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), insertImageUrl())}
                  />
                  <button
                    type="button"
                    onClick={insertImageUrl}
                    className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700"
                  >
                    Insert
                  </button>
                </div>
                <div className="text-xs text-gray-400 text-center">— or —</div>
                <label className="cursor-pointer flex items-center gap-2 border-2 border-dashed rounded-lg p-2 hover:bg-gray-50 transition">
                  <span className="text-sm">📁</span>
                  <span className="text-xs text-gray-600">
                    {imageUploading ? "Uploading…" : "Upload from computer"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={imageUploading}
                    onChange={handleImageFile}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setImagePopover(false); setImageUrl(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Editor body */}
        <div className="rounded-b-xl overflow-hidden">
          <EditorContent editor={editor} />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">Use the toolbar above to format text — no markdown needed.</p>
    </div>
  );
}
