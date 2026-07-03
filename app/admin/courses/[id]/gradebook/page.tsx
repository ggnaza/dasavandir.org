import { redirect } from "next/navigation";

// Gradebook moved under the Analytics tab (it is now the default Analytics view).
// Keep this route as a redirect so old links / bookmarks still work.
export default function GradebookRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/courses/${params.id}/analytics`);
}
