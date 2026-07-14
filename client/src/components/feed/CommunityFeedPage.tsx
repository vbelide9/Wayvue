// The road-trip social feed: a "Following" feed + a "Discover" tab (recent posts from
// anyone, so the feed isn't empty before you follow people), a composer, and suggested
// users to follow. Structured like SavedTripsPage.
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Users, Compass, UserPlus, Lock, Globe } from 'lucide-react';
import { WayvueBrand } from '../WayvueBrand';
import { AccountMenu } from '../AccountMenu';
import { useAuth } from '@/lib/AuthContext';
import { getFeed, getDiscover, getSuggestedUsers, getFollowCounts, getUserPosts, follow, type FeedPost, type PostAuthor } from '@/lib/feed';
import { PostComposer } from './PostComposer';
import { PostCard, Avatar } from './PostCard';
import { UserProfilePanel } from './UserProfilePanel';
import { FollowListModal } from './FollowListModal';

type Tab = 'following' | 'discover';

export function CommunityFeedPage({ onBack, prefill }: { onBack: () => void; prefill?: { body?: string; placeKey?: string; placeName?: string; tripId?: string } }) {
    const { user, enabled, profile: me, setPrivacy } = useAuth();
    const [tab, setTab] = useState<Tab>('following');
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [suggested, setSuggested] = useState<PostAuthor[]>([]);
    const [viewingProfile, setViewingProfile] = useState<PostAuthor | null>(null);
    const [myStats, setMyStats] = useState({ posts: 0, followers: 0, following: 0 });
    const [followList, setFollowList] = useState<{ userId: string; mode: 'followers' | 'following' } | null>(null);

    // Your own stats for the Instagram-style profile header.
    useEffect(() => {
        if (!user) return;
        Promise.all([getFollowCounts(user.id), getUserPosts(user.id)])
            .then(([c, p]) => setMyStats({ posts: p.length, followers: c.followers, following: c.following }))
            .catch(() => {});
    }, [user]);

    const fetchTab = useCallback(async (t: Tab): Promise<FeedPost[]> => (t === 'following' ? getFeed() : getDiscover()), []);

    // Load the active tab. Signed-out users only get Discover.
    useEffect(() => {
        let cancelled = false;
        setLoading(true); setHasMore(true);
        (async () => {
            const data = await fetchTab(user ? tab : 'discover');
            if (cancelled) return;
            setPosts(data);
            setHasMore(data.length >= 20);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [tab, user, fetchTab]);

    // Suggested users to follow (for Discover / an empty Following feed).
    useEffect(() => {
        if (user) getSuggestedUsers().then(setSuggested).catch(() => {});
    }, [user]);

    const loadMore = async () => {
        if (loadingMore || posts.length === 0) return;
        setLoadingMore(true);
        const cursor = posts[posts.length - 1].createdAt;
        const more = (user && tab === 'following') ? await getFeed(cursor) : await getDiscover(cursor);
        setPosts(p => [...p, ...more]);
        setHasMore(more.length >= 20);
        setLoadingMore(false);
    };

    const activeTab: Tab = user ? tab : 'discover';

    const followSuggested = async (a: PostAuthor) => {
        setSuggested(s => s.filter(x => x.userId !== a.userId));
        try { await follow(a.userId); if (tab === 'following') setPosts(await getFeed()); } catch { /* ignore */ }
    };

    return (
        <main className="relative min-h-screen text-foreground">
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background">
                <img src="/sequence/ezgif-frame-030.jpg" alt="" className="w-full h-full object-cover opacity-[0.16]" />
                <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,106,42,0.08),transparent_55%)]" />
            </div>

            <nav className="flex justify-between items-center px-6 md:px-12 py-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} aria-label="Back" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <WayvueBrand size="md" tagline onClick={onBack} />
                </div>
                <AccountMenu />
            </nav>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-24">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20"><Users className="w-6 h-6 text-primary" /></div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight">Community</h1>
                        <p className="text-sm text-muted-foreground">Trip photos, tips, and favorite stops from fellow travelers.</p>
                    </div>
                </div>

                {!enabled ? (
                    <p className="text-sm text-muted-foreground text-center py-16">Community features aren’t configured.</p>
                ) : (
                    <>
                        {/* Your profile: Instagram-style stats + privacy toggle */}
                        {user && me && (
                            <div className="bg-card border border-border rounded-2xl p-4 mb-5 shadow-soft">
                                <div className="flex items-center gap-4">
                                    <Avatar author={{ userId: user.id, name: me.display_name || 'You', avatar: me.avatar_url }} size={64} />
                                    <div className="flex-1 grid grid-cols-3">
                                        <div className="text-center">
                                            <div className="text-lg font-black text-foreground">{myStats.posts}</div>
                                            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Posts</div>
                                        </div>
                                        <button onClick={() => setFollowList({ userId: user.id, mode: 'followers' })} className="text-center hover:opacity-70 transition-opacity">
                                            <div className="text-lg font-black text-foreground">{myStats.followers}</div>
                                            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Followers</div>
                                        </button>
                                        <button onClick={() => setFollowList({ userId: user.id, mode: 'following' })} className="text-center hover:opacity-70 transition-opacity">
                                            <div className="text-lg font-black text-foreground">{myStats.following}</div>
                                            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Following</div>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-foreground truncate">{me.display_name || 'You'}</div>
                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            {me.is_private ? <><Lock className="w-3 h-3" /> Private — only followers see your posts</> : <><Globe className="w-3 h-3" /> Public — anyone can see your posts</>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setPrivacy(!me.is_private).catch(() => {})}
                                        aria-label="Toggle account privacy"
                                        className="flex items-center gap-2 shrink-0"
                                    >
                                        <span className="text-xs font-bold text-muted-foreground">{me.is_private ? 'Private' : 'Public'}</span>
                                        <span className={`relative w-10 h-6 rounded-full transition-colors ${me.is_private ? 'bg-primary' : 'bg-border'}`}>
                                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${me.is_private ? 'left-[18px]' : 'left-0.5'}`} />
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mb-5"><PostComposer key={prefill?.placeKey || prefill?.tripId || 'composer'} onPosted={p => { setPosts(prev => [p, ...prev]); setMyStats(s => ({ ...s, posts: s.posts + 1 })); }} prefill={prefill} /></div>

                        {/* Tabs */}
                        <div className="flex items-center gap-1 mb-5 bg-secondary/40 rounded-full p-1 border border-border w-fit">
                            {(['following', 'discover'] as Tab[]).map(t => {
                                const Icon = t === 'following' ? Users : Compass;
                                const active = activeTab === t;
                                const disabled = t === 'following' && !user;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => !disabled && setTab(t)}
                                        disabled={disabled}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-all ${active ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-40`}
                                    >
                                        <Icon className="w-4 h-4" /> {t}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Suggested users */}
                        {activeTab === 'discover' && suggested.length > 0 && (
                            <div className="mb-5 bg-card border border-border rounded-2xl p-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">Suggested travelers</p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {suggested.map(a => (
                                        <div key={a.userId} className="shrink-0 w-32 bg-secondary/40 border border-border rounded-xl p-3 flex flex-col items-center text-center">
                                            <Avatar author={a} size={44} onClick={() => setViewingProfile(a)} />
                                            <span className="text-xs font-bold text-foreground mt-2 truncate w-full">{a.name}</span>
                                            <button onClick={() => followSuggested(a)} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary-foreground bg-primary rounded-full px-3 py-1 hover:bg-primary/90">
                                                <UserPlus className="w-3 h-3" /> Follow
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Feed */}
                        {loading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
                        ) : posts.length === 0 ? (
                            <div className="text-center py-16 px-4 bg-secondary/20 rounded-3xl border border-dashed border-border">
                                <Compass className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-base font-bold text-foreground">{activeTab === 'following' ? 'Your feed is quiet' : 'Nothing here yet'}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {activeTab === 'following' ? 'Follow travelers in Discover, or share the first post.' : 'Be the first to share a trip photo or tip.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map(p => (
                                    <PostCard key={p.id} post={p} onOpenProfile={setViewingProfile} onDeleted={id => setPosts(ps => ps.filter(x => x.id !== id))} />
                                ))}
                                {hasMore && (
                                    <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 text-sm font-bold text-primary hover:text-primary/80 flex items-center justify-center gap-2">
                                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {viewingProfile && <UserProfilePanel author={viewingProfile} onClose={() => setViewingProfile(null)} onOpenProfile={setViewingProfile} />}
            {followList && (
                <FollowListModal
                    userId={followList.userId}
                    mode={followList.mode}
                    onClose={() => setFollowList(null)}
                    onOpenProfile={setViewingProfile}
                />
            )}
        </main>
    );
}
