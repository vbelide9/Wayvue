// A single feed post: author, body, optional photo + trip/stop chip, like toggle, an
// expandable comment thread, and a ⋯ menu (author → Delete, others → Report).
import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Trash2, Flag, Loader2, MapPin, Route, Send } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNotify } from '@/lib/Notifications';
import {
    toggleLike, getComments, addComment, deleteComment, deletePost, reportPost,
    type FeedPost, type PostComment, type PostAuthor,
} from '@/lib/feed';

function ago(iso: string): string {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 604800) return `${Math.floor(s / 86400)}d`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Avatar({ author, size = 36, onClick }: { author: PostAuthor; size?: number; onClick?: () => void }) {
    const initials = author.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className="rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center border border-border/60 shrink-0 disabled:cursor-default"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {author.avatar ? <img src={author.avatar} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </button>
    );
}

export function PostCard({ post, onOpenProfile, onDeleted }: {
    post: FeedPost;
    onOpenProfile?: (a: PostAuthor) => void;
    onDeleted?: (id: string) => void;
}) {
    const { user } = useAuth();
    const notify = useNotify();
    const [liked, setLiked] = useState(post.likedByMe);
    const [likeCount, setLikeCount] = useState(post.likeCount);
    const [commentCount, setCommentCount] = useState(post.commentCount);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [gone, setGone] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isMine = post.userId === user?.id;

    useEffect(() => {
        if (!menuOpen) return;
        const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [menuOpen]);

    if (gone) return null;

    const onLike = async () => {
        if (!user) return;
        const next = !liked;
        setLiked(next); setLikeCount(c => c + (next ? 1 : -1));
        try { await toggleLike(post.id, liked); }
        catch { setLiked(!next); setLikeCount(c => c + (next ? -1 : 1)); }
    };

    const openComments = async () => {
        setShowComments(v => !v);
        if (!showComments && comments.length === 0) {
            setLoadingComments(true);
            try { setComments(await getComments(post.id)); } finally { setLoadingComments(false); }
        }
    };

    const postComment = async () => {
        const text = commentText.trim();
        if (!text || !user) return;
        setCommentText('');
        try {
            await addComment(post.id, text);
            setComments(await getComments(post.id));
            setCommentCount(c => c + 1);
        } catch (e) { console.error(e); }
    };

    const removeComment = async (id: string) => {
        setComments(cs => cs.filter(c => c.id !== id));
        setCommentCount(c => Math.max(0, c - 1));
        try { await deleteComment(id); } catch (e) { console.error(e); }
    };

    const onDelete = async () => {
        setMenuOpen(false); setGone(true);
        try { await deletePost(post.id); onDeleted?.(post.id); } catch { setGone(false); }
    };

    const onReport = async () => {
        setMenuOpen(false);
        try { await reportPost(post.id); notify('Thanks — this post was reported.'); } catch (e) { console.error(e); }
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-soft">
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Avatar author={post.author} onClick={onOpenProfile ? () => onOpenProfile(post.author) : undefined} />
                    <div className="min-w-0 flex-1">
                        <button onClick={() => onOpenProfile?.(post.author)} className="text-sm font-bold text-foreground hover:underline truncate block text-left">{post.author.name}</button>
                        <span className="text-[11px] text-muted-foreground">{ago(post.createdAt)} ago</span>
                    </div>
                    {user && (
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setMenuOpen(v => !v)} aria-label="Post options" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                                    {isMine ? (
                                        <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-secondary"><Trash2 className="w-4 h-4" /> Delete</button>
                                    ) : (
                                        <button onClick={onReport} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary"><Flag className="w-4 h-4" /> Report</button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Body */}
                {post.body && <p className="text-sm text-foreground/90 leading-relaxed mt-3 whitespace-pre-wrap">{post.body}</p>}

                {/* Trip / stop chip */}
                {(post.placeName || post.tripId) && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                        {post.placeName ? <><MapPin className="w-3.5 h-3.5" /> {post.placeName}</> : <><Route className="w-3.5 h-3.5" /> Shared a trip</>}
                    </div>
                )}
            </div>

            {/* Photo */}
            {post.imageUrl && (
                <img src={post.imageUrl} alt="" className="w-full max-h-[520px] object-cover border-y border-border" referrerPolicy="no-referrer" />
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 px-4 py-2.5">
                <button onClick={onLike} disabled={!user} className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-50`}>
                    <Heart className={`w-4.5 h-4.5 ${liked ? 'fill-red-500' : ''}`} style={{ width: 18, height: 18 }} /> {likeCount}
                </button>
                <button onClick={openComments} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle style={{ width: 18, height: 18 }} /> {commentCount}
                </button>
            </div>

            {/* Comments */}
            {showComments && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                    {loadingComments ? (
                        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    ) : comments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-1">No comments yet.</p>
                    ) : comments.map(c => {
                        const canDelete = c.userId === user?.id || isMine;
                        return (
                            <div key={c.id} className="flex items-start gap-2.5 group/c">
                                <Avatar author={c.author} size={26} onClick={onOpenProfile ? () => onOpenProfile(c.author) : undefined} />
                                <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-foreground">{c.author.name}</span>
                                    <span className="text-[10px] text-muted-foreground ml-2">{ago(c.createdAt)}</span>
                                    <p className="text-sm text-foreground/85 leading-snug whitespace-pre-wrap">{c.body}</p>
                                </div>
                                {canDelete && <button onClick={() => removeComment(c.id)} className="opacity-0 group-hover/c:opacity-100 p-1 text-muted-foreground/50 hover:text-red-500 shrink-0"><Trash2 className="w-3 h-3" /></button>}
                            </div>
                        );
                    })}

                    {user && (
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') postComment(); }}
                                placeholder="Add a comment…"
                                className="flex-1 text-sm bg-secondary/40 border border-border rounded-full px-3.5 py-2 outline-none focus:border-primary/50"
                            />
                            <button onClick={postComment} disabled={!commentText.trim()} aria-label="Send comment" className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
