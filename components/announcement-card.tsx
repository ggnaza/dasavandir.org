"use client";
import { useState } from "react";

const EMOJIS = ["👍", "❤️", "🎉", "🙌", "💡"];

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface Comment {
  id: string;
  body: string;
  user_id: string;
  author: string;
  created_at: string;
}

interface Props {
  id: string;
  title: string;
  body: string;
  author: string;
  courseTitle: string;
  createdAt: string;
  reactions: Reaction[];
  comments: Comment[];
  currentUserId: string;
}

export function AnnouncementCard({
  id,
  title,
  body,
  author,
  courseTitle,
  createdAt,
  reactions: initialReactions,
  comments: initialComments,
  currentUserId,
}: Props) {
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function toggleReaction(emoji: string) {
    const existing = reactions.find((r) => r.emoji === emoji);
    const reacted = existing?.reacted ?? false;

    setReactions((prev) => {
      const has = prev.find((r) => r.emoji === emoji);
      if (reacted) {
        const updated = prev.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
        );
        return updated.filter((r) => r.count > 0);
      }
      if (has) {
        return prev.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r));
      }
      return [...prev, { emoji, count: 1, reacted: true }];
    });

    await fetch(`/api/announcements/${id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);

    const res = await fetch(`/api/announcements/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText }),
    });

    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setCommentText("");
    }
    setSubmitting(false);
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/announcements/${id}/comments/${commentId}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="bg-white border rounded-xl p-5">
      {/* Header */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-brand-600 mb-1">{courseTitle}</p>
        <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
          <span>{author}</span>
          <span>·</span>
          <span>{new Date(createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Body */}
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{body}</p>

      {/* Reactions row */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {EMOJIS.map((emoji) => {
          const r = reactions.find((rx) => rx.emoji === emoji);
          const count = r?.count ?? 0;
          const reacted = r?.reacted ?? false;
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-colors ${
                reacted
                  ? "bg-brand-50 border-brand-300 text-brand-700 font-medium"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-xs">{count}</span>}
            </button>
          );
        })}

        <button
          onClick={() => setShowComments((o) => !o)}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span>💬</span>
          <span className="text-xs">
            {comments.length > 0 ? comments.length : ""}{" "}
            {showComments ? "Hide" : "Comment"}
          </span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-4 border-t pt-4 space-y-3">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No comments yet. Be the first!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-700">{c.author}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{c.body}</p>
              </div>
              {c.user_id === currentUserId && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors mt-1 text-lg leading-none"
                  title="Delete comment"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <form onSubmit={submitComment} className="flex gap-2 pt-1">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {submitting ? "…" : "Post"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
