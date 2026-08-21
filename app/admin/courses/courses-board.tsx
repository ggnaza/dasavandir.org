"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CloneCourseButton } from "./clone-course-button";
import { DeleteCourseButton } from "./delete-course-button";

export type BoardCourse = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  space_id: string | null;
  enrolled: number;
  creatorName: string | null;
};

type Props = {
  courses: BoardCourse[];
  /** Real spaces (id + label) available as tabs and drop targets. */
  spaces: { id: string; label: string }[];
  /** Non-managers can edit → drag to move courses between spaces. */
  canMove: boolean;
  isManager: boolean;
  initialSpace: string;
};

// Sentinel tab keys that aren't a real space id.
const ALL = "all";
const NONE = "none";

export function CoursesBoard({ courses: initial, spaces, canMove, isManager, initialSpace }: Props) {
  const router = useRouter();
  const [courses, setCourses] = useState<BoardCourse[]>(initial);
  const [selected, setSelected] = useState<string>(initialSpace || ALL);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    // Small activation distance so clicking links inside a card still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const hasUnassigned = courses.some((c) => !c.space_id);

  const tabs = useMemo(
    () => [
      { key: ALL, label: "All" },
      ...spaces.map((s) => ({ key: s.id, label: s.label })),
      ...(hasUnassigned ? [{ key: NONE, label: "No space" }] : []),
    ],
    [spaces, hasUnassigned],
  );

  const countFor = (key: string) =>
    key === ALL
      ? courses.length
      : key === NONE
        ? courses.filter((c) => !c.space_id).length
        : courses.filter((c) => c.space_id === key).length;

  // If the active tab is a per-space one, keep it selected even when it empties
  // out; fall back to "All" only if the tab itself disappeared.
  const activeTabExists = tabs.some((t) => t.key === selected);
  const effectiveSelected = activeTabExists ? selected : ALL;

  const visible =
    effectiveSelected === ALL
      ? courses
      : effectiveSelected === NONE
        ? courses.filter((c) => !c.space_id)
        : courses.filter((c) => c.space_id === effectiveSelected);

  const activeCourse = activeId ? courses.find((c) => c.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const courseId = String(active.id);
    const targetKey = String(over.id);
    // "All" is not a real destination — dropping there is a no-op.
    if (targetKey === ALL) return;

    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    const newSpaceId = targetKey === NONE ? null : targetKey;
    if ((course.space_id ?? null) === newSpaceId) return; // already there

    const prev = courses;
    // Optimistically move the card.
    setCourses(courses.map((c) => (c.id === courseId ? { ...c, space_id: newSpaceId } : c)));
    setError(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id: newSpaceId }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      setCourses(prev); // revert
      setError(e instanceof Error && e.message ? e.message : "Could not move the course.");
    }
  }

  const board = (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Space subtabs — also drop targets when dragging is enabled. */}
      {courses.length > 0 && tabs.length > 1 && (
        <div className="flex gap-1 mb-6 border-b overflow-x-auto">
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              tabKey={tab.key}
              label={tab.label}
              count={countFor(tab.key)}
              active={effectiveSelected === tab.key}
              droppable={canMove && tab.key !== ALL}
              onSelect={() => setSelected(tab.key)}
            />
          ))}
        </div>
      )}

      {courses.length === 0 && (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
          No courses yet.{" "}
          <Link href="/admin/courses/new" className="text-brand-600 hover:underline">
            Create your first course →
          </Link>
        </div>
      )}

      {courses.length > 0 && visible.length === 0 && (
        <p className="text-sm text-gray-500">No courses in this space yet.</p>
      )}

      <div className="space-y-3">
        {visible.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            canMove={canMove}
            isManager={isManager}
            dragging={activeId === course.id}
          />
        ))}
      </div>
    </div>
  );

  if (!canMove) return board;

  return (
    <DndContext
      id="courses-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {board}
      <DragOverlay>
        {activeCourse ? (
          <div className="bg-white border rounded-xl p-5 shadow-lg opacity-90">
            <span className="font-semibold">{activeCourse.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TabButton({
  tabKey,
  label,
  count,
  active,
  droppable,
  onSelect,
}: {
  tabKey: string;
  label: string;
  count: number;
  active: boolean;
  droppable: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tabKey, disabled: !droppable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
      } ${isOver ? "bg-brand-50 rounded-t" : ""}`}
    >
      {label}
      <span className="ml-1.5 text-xs text-gray-400">{count}</span>
    </button>
  );
}

function CourseCard({
  course,
  canMove,
  isManager,
  dragging,
}: {
  course: BoardCourse;
  canMove: boolean;
  isManager: boolean;
  dragging: boolean;
}) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: course.id, disabled: !canMove });

  return (
    <div
      ref={setNodeRef}
      className={`bg-white border rounded-xl p-5 flex items-center justify-between ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {canMove && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${course.title} to another space`}
            title="Drag to move to another space"
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none px-1 leading-none shrink-0"
          >
            ⠿
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/courses/${course.id}/learners`}
              className="font-semibold hover:text-brand-600 hover:underline"
            >
              {course.title}
            </Link>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                course.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {course.published ? "Published" : "Draft"}
            </span>
            <span className="text-xs text-gray-400">{course.enrolled} enrolled</span>
          </div>
          {course.description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{course.description}</p>
          )}
          {course.creatorName && (
            <p className="text-xs text-gray-400 mt-0.5">by {course.creatorName}</p>
          )}
        </div>
      </div>

      {!isManager && (
        <div className="flex items-center ml-4 shrink-0">
          <Link href={`/admin/courses/${course.id}`} className="text-sm text-brand-600 hover:underline">
            Edit →
          </Link>
          <CloneCourseButton courseId={course.id} />
          <DeleteCourseButton courseId={course.id} />
        </div>
      )}
      {isManager && (
        <div className="ml-4 shrink-0">
          <Link
            href={`/admin/courses/${course.id}/learners`}
            className="text-sm text-brand-600 hover:underline font-medium"
          >
            View cohort →
          </Link>
        </div>
      )}
    </div>
  );
}
