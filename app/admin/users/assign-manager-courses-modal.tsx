"use client";
import { useEffect, useState } from "react";

type Course = { id: string; title: string };

export function AssignManagerCoursesModal({
  managerId,
  managerEmail,
  managerName,
  isOpen,
  onClose,
}: {
  managerId: string;
  managerEmail: string;
  managerName: string;
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
      fetch(`/api/admin/moderators?manager_id=${managerId}`).then((r) => r.json()),
    ]).then(([coursesData, assignedCourses]) => {
      setAllCourses(coursesData.courses || []);
      setAssigned(new Set((assignedCourses as Course[]).map((c) => c.id)));
    });
  }, [isOpen, managerId]);

  async function toggle(courseId: string) {
    setLoading(true);
    const isAssigned = assigned.has(courseId);
    if (isAssigned) {
      await fetch("/api/admin/moderators", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_id: managerId, course_id: courseId }),
      });
    } else {
      await fetch("/api/admin/moderators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId, email: managerEmail }),
      });
    }
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
          <h2 className="font-semibold text-lg">Assign Courses — {managerName}</h2>
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
                className="w-4 h-4 accent-purple-600"
              />
              <span className="text-sm font-medium">{course.title}</span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Done</button>
        </div>
      </div>
    </div>
  );
}
