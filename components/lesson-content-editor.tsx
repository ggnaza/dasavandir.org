"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#000000", "#374151", "#6B7280", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899",
];

type Props = { value: string; onChange: (val: string) => void };

export function LessonContentEditor({ value, onChange }: Props) {
  const [mounted, setMounted] = useState(false);
  const initialised = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
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
      <div className="border rounded-xl overflow-hidden bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b bg-gray-50">

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
        </div>

        {/* Editor body */}
        <EditorContent editor={editor} />
      </div>
      <p className="text-xs text-gray-400 mt-1">Use the toolbar above to format text — no markdown needed.</p>
    </div>
  );
}
