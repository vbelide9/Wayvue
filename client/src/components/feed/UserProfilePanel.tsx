// A user's profile as a modal: avatar, name, follower/following counts, Follow/Unfollow,
// and their posts. Portaled to <body> so it isn't clipped.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
    getUserPosts, getFollowCounts, getFollowingSet, follow, unfollow,
    type FeedPost, type PostAuthor,
} from '@/lib/feed';
import { PostCard, Avatar } from './PostCard';

export function UserProfilePanel({ author, onClose }: { author: PostAuthor; onClose: () => void }) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [counts, setCounts] = useState({ followers: 0, following: 0 });
    const [following, setFollowing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const isMe = author.userId === user?.id;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [p, c, set] = await Promise.all([
                getUserPosts(author.userId),
                getFollowCounts(author.userId),
                user ? getFollowingSet() : Promise.resolve(new Set<string>()),
            ]);
            if (cancelled) return;
            setPosts(p); setCounts(c); setFollowing(set.has(author.userId)); setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [author.userId, user]);

    const toggleFollow = async () => {
        if (!user || busy) return;
        const next = !following;
        setFollowing(next);
        setCounts(c => ({ ...c, followers: c.followers + (next ? 1 : -1) }));
        setBusy(true);
        try { next ? await follow(author.userId) : await unfollow(author.userId); }
        catch { setFollowing(!next); setCounts(c => ({ ...c, followers: c.followers + (next ? -1 : 1) })); }
        finally { setBusy(false); }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-background border border-border rounded-3xl shadow-2xl max-w-lg w-full my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="relative h-24 bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
                    <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-5 pb-4 -mt-10">
                    <div className="flex items-end justify-between">
                        <Avatar author={author} size={72} />
                        {!isMe && user && (
                            <button
                                onClick={toggleFollow}
                                disabled={busy}
                                className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-bold transition-colors ${following ? 'bg-secondary text-foreground border border-border' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                            >
                                {following ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                            </button>
                        )}
                    </div>
                    <h2 className="text-xl font-black text-foreground tracking-tight mt-2">{author.name}{isMe && <span className="text-muted-foreground font-normal text-sm"> (you)</span>}</h2>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span><span className="font-bold text-foreground">{counts.followers}</span> followers</span>
                        <span><span className="font-bold text-foreground">{counts.following}</span> following</span>
                        <span><span className="font-bold text-foreground">{posts.length}</span> posts</span>
                    </div>
                </div>

                {/* Posts */}
                <div className="px-4 pb-5 space-y-3 max-h-[55vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : posts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No posts yet.</p>
                    ) : posts.map(p => <PostCard key={p.id} post={p} onDeleted={id => setPosts(ps => ps.filter(x => x.id !== id))} />)}
                </div>
            </div>
        </div>,
        document.body,
    );
}
