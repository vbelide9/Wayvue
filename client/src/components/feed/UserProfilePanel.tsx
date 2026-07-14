// A user's profile as a modal: avatar, name, follower/following counts, Follow/Unfollow,
// and their posts. Portaled to <body> so it isn't clipped.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, UserCheck, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
    getUserPosts, getFollowCounts, getFollowingSet, getUserPrivacy, follow, unfollow,
    type FeedPost, type PostAuthor,
} from '@/lib/feed';
import { PostCard, Avatar } from './PostCard';
import { FollowListModal } from './FollowListModal';

export function UserProfilePanel({ author, onClose, onOpenProfile }: { author: PostAuthor; onClose: () => void; onOpenProfile?: (a: PostAuthor) => void }) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [counts, setCounts] = useState({ followers: 0, following: 0 });
    const [following, setFollowing] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);
    const isMe = author.userId === user?.id;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [p, c, set, priv] = await Promise.all([
                getUserPosts(author.userId),
                getFollowCounts(author.userId),
                user ? getFollowingSet() : Promise.resolve(new Set<string>()),
                getUserPrivacy(author.userId),
            ]);
            if (cancelled) return;
            setPosts(p); setCounts(c); setFollowing(set.has(author.userId)); setIsPrivate(priv); setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [author.userId, user]);

    // A private account you don't follow hides its posts (RLS returns none).
    const locked = isPrivate && !following && !isMe;

    const toggleFollow = async () => {
        if (!user || busy) return;
        const next = !following;
        setFollowing(next);
        setCounts(c => ({ ...c, followers: c.followers + (next ? 1 : -1) }));
        setBusy(true);
        try {
            next ? await follow(author.userId) : await unfollow(author.userId);
            // Following a private account unlocks their posts; refetch either way.
            if (isPrivate) setPosts(next ? await getUserPosts(author.userId) : []);
        }
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
                    <h2 className="flex items-center gap-1.5 text-xl font-black text-foreground tracking-tight mt-2">
                        {author.name}
                        {isPrivate && <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-label="Private account" />}
                        {isMe && <span className="text-muted-foreground font-normal text-sm">(you)</span>}
                    </h2>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <button onClick={() => setFollowList('followers')} className="hover:text-foreground transition-colors"><span className="font-bold text-foreground">{counts.followers}</span> followers</button>
                        <button onClick={() => setFollowList('following')} className="hover:text-foreground transition-colors"><span className="font-bold text-foreground">{counts.following}</span> following</button>
                        <span><span className="font-bold text-foreground">{posts.length}</span> posts</span>
                    </div>
                </div>

                {/* Posts */}
                <div className="px-4 pb-5 space-y-3 max-h-[55vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : locked ? (
                        <div className="text-center py-10 px-4">
                            <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                            <p className="text-sm font-bold text-foreground">This account is private</p>
                            <p className="text-xs text-muted-foreground mt-1">Follow {author.name} to see their posts.</p>
                        </div>
                    ) : posts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No posts yet.</p>
                    ) : posts.map(p => <PostCard key={p.id} post={p} onDeleted={id => setPosts(ps => ps.filter(x => x.id !== id))} />)}
                </div>
            </div>

            {followList && (
                <FollowListModal
                    userId={author.userId}
                    mode={followList}
                    onClose={() => setFollowList(null)}
                    onOpenProfile={a => { setFollowList(null); onOpenProfile?.(a); }}
                />
            )}
        </div>,
        document.body,
    );
}
