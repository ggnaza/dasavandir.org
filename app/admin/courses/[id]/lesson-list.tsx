"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type LessonListItem = { id: string; title: string };

type Props = {
  courseId: string;
  lessons: LessonListItem[];
};

/**
 * Drag-and-drop (and ▲▼) reorderable lesson list. Both interactions mutate the
 * same local order and persist the full ordered id list to
 * /api/lessons/reorder-bulk, which rewrites each lesson's `order` to its index.
 */
export function LessonList({ courseId, lessons }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<LessonListItem[]>(lessons);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    // A small activation distance so clicking the Edit link / arrows still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persist(next: LessonListItem[], prev: LessonListItem[]) {
    setItems(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lessons/reorder-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, orderedIds: next.map((l) => l.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      setItems(prev); // revert optimistic reorder
      setError(e instanceof Error && e.message ? e.message : "Could not save the new order.");
    } finally {
      setSaving(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((l) => l.id === active.id);
    const newIndex = items.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const prev = items;
    void persist(arrayMove(items, oldIndex, newIndex), prev);
  }

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const prev = items;
    void persist(arrayMove(items, index, target), prev);
  }

  if (items.length === 0) {
    return <p className="text-gray-500 text-sm">No lessons yet. Add your first lesson.</p>;
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <DndContext id="lesson-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((lesson, i) => (
              <SortableLessonRow
                key={lesson.id}
                lesson={lesson}
                index={i}
                courseId={courseId}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                disabled={saving}
                onMove={move}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableLessonRow({
  lesson,
  index,
  courseId,
  isFirst,
  isLast,
  disabled,
  onMove,
}: {
  lesson: LessonListItem;
  index: number;
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMove: (index: number, direction: "up" | "down") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border rounded-lg px-3 py-3 flex items-center gap-2"
    >
      {/* Drag handle — dragging is initiated only from here so the row's links stay clickable. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${lesson.title}`}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none px-1 leading-none"
        title="Drag to reorder"
      >
        ⠿
      </button>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(index, "up")}
          disabled={isFirst || disabled}
          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs"
          title="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onMove(index, "down")}
          disabled={isLast || disabled}
          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs"
          title="Move down"
        >
          ▼
        </button>
      </div>

      <span className="text-sm flex-1 min-w-0">
        <span className="text-gray-400 mr-2">{index + 1}.</span>
        {lesson.title}
      </span>

      <Link
        href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
        className="text-sm text-brand-600 hover:underline shrink-0"
      >
        Edit
      </Link>
    </div>
  );
}
