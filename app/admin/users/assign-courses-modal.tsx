"use client";
import { useEffect, useState } from "react";

type Course = { id: string; title: string };
type Access = { course_id: string; courses: { id: string; title: string } };

export function AssignCoursesModal({
  creatorId,
  creatorName,
  isOpen,
  onClose,
}: {
  creatorId: string;
  creatorName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      fetch("/api/admin/courses").then((r) => r.json()),
      fetch(`/api/admin/course-access?creator_id=${creatorId}`).then((r) => r.json()),
    ]).then(([courses, access]) => {
      setAllCourses(courses.courses || []);
      setAssigned(new Set((access as Access[]).map((a) => a.course_id)));
    });
  }, [isOpen, creatorId]);

  async function toggle(courseId: string) {
    setLoading(true);
    const isAssigned = assigned.has(courseId);
    await fetch("/api/admin/course-access", {
      method: isAssigned ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: creatorId, course_id: courseId }),
    });
    setAssigned((prev) => {
      const next = new Set(prev);
      isAssigned ? next.delete(courseId) : next.add(courseId);
      return next;
    });
    setLoading(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-semibold text-lg">Assign Courses — {creatorName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
          {allCourses.length === 0 && <p className="text-gray-500 text-sm">No courses found.</p>}
          {allCourses.map((course) => (
            <label key={course.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={assigned.has(course.id)}
                onChange={() => toggle(course.id)}
                disabled={loading}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm font-medium">{course.title}</span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Done</button>
        </div>
      </div>
    </div>
  );
}
