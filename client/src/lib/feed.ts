// Social feed data layer (Supabase). Follow-based feed of posts (photos / tips / favorite
// stops) with likes, comments, follows, and reporting. RLS scopes writes to the author;
// posts/comments/likes/follows are publicly readable. Client-side joins to `profiles` for
// authors (user_id ↔ profiles.id, no FK relationship), same as getReviews / listMembers.
import { supabase } from './supabase';

const PAGE = 20;

export interface PostAuthor {
    userId: string;
    name: string;
    avatar: string | null;
}

export interface FeedPost {
    id: string;
    userId: string;
    kind: string;                 // 'tip' | 'photo' | 'stop' | 'trip'
    body: string | null;
    imageUrl: string | null;
    tripId: string | null;
    placeKey: string | null;
    placeName: string | null;
    createdAt: string;
    author: PostAuthor;
    likeCount: number;
    commentCount: number;
    likedByMe: boolean;
}

export interface PostComment {
    id: string;
    body: string;
    createdAt: string;
    userId: string;
    author: PostAuthor;
}

export interface NewPost {
    kind: string;
    body?: string;
    imageUrl?: string | null;
    tripId?: string | null;
    placeKey?: string | null;
    placeName?: string | null;
    /** Users tagged via the @-mention picker — stored + notified. */
    mentionUserIds?: string[];
}

/** Extract #hashtags (lowercased, no '#') from post text. */
export function extractHashtags(body: string): string[] {
    const tags = (body.match(/#(\w{1,50})/g) || []).map(t => t.slice(1).toLowerCase());
    return [...new Set(tags)];
}

async function currentUserId(): Promise<string> {
    const { data } = await supabase!.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw new Error('Sign in to continue.');
    return uid;
}

function authorOf(pmap: Map<string, any>, uid: string): PostAuthor {
    const p = pmap.get(uid);
    return { userId: uid, name: p?.display_name || 'Traveler', avatar: p?.avatar_url || null };
}

// Hydrate raw post rows with author profile, like/comment counts, and the caller's likes.
async function hydratePosts(rows: any[]): Promise<FeedPost[]> {
    if (!supabase || rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const userIds = [...new Set(rows.map(r => r.user_id))];
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const [profilesRes, statsRes, likesRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
        supabase.from('post_stats').select('post_id, like_count, comment_count').in('post_id', ids),
        uid ? supabase.from('post_likes').select('post_id').eq('user_id', uid).in('post_id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profilesRes.data || []).map(p => [p.id, p]));
    const smap = new Map((statsRes.data || []).map(s => [s.post_id, s]));
    const liked = new Set((likesRes.data || []).map((l: any) => l.post_id));
    return rows.map(r => ({
        id: r.id, userId: r.user_id, kind: r.kind, body: r.body, imageUrl: r.image_url,
        tripId: r.trip_id, placeKey: r.place_key, placeName: r.place_name, createdAt: r.created_at,
        author: authorOf(pmap, r.user_id),
        likeCount: Number(smap.get(r.id)?.like_count || 0),
        commentCount: Number(smap.get(r.id)?.comment_count || 0),
        likedByMe: liked.has(r.id),
    }));
}

// ── Feed ─────────────────────────────────────────────────────────────────────

/** Posts from the people you follow (+ your own), newest first. Cursor = last createdAt. */
export async function getFeed(cursor?: string): Promise<FeedPost[]> {
    if (!supabase) return [];
    const uid = await currentUserId();
    const [{ data: fol }, blocked] = await Promise.all([
        supabase.from('follows').select('followee_id').eq('follower_id', uid),
        getBlockedIds(),
    ]);
    const authorIds = [uid, ...(fol || []).map(f => f.followee_id)].filter(id => !blocked.has(id));
    let q = supabase.from('posts').select('*').in('user_id', authorIds).order('created_at', { ascending: false }).limit(PAGE);
    if (cursor) q = q.lt('created_at', cursor);
    const { data, error } = await q;
    if (error) { console.error('[feed] getFeed failed:', error); return []; }
    return hydratePosts(data || []);
}

/** Recent posts from anyone (solves the empty feed before you follow people). Chronological —
 *  used for pagination / load-more. See getDiscoverRanked for the ranked first page. */
export async function getDiscover(cursor?: string): Promise<FeedPost[]> {
    if (!supabase) return [];
    let q = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(PAGE);
    if (cursor) q = q.lt('created_at', cursor);
    const { data, error } = await q;
    if (error) { console.error('[feed] getDiscover failed:', error); return []; }
    const blocked = await getBlockedIds();
    return hydratePosts((data || []).filter(p => !blocked.has(p.user_id)));
}

/** Ranked Discover for the first screen: recent posts ordered by an engagement-over-time
 *  score (likes + 2×comments, decayed by age) so lively posts surface, not just the newest. */
export async function getDiscoverRanked(): Promise<FeedPost[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) { console.error('[feed] getDiscoverRanked failed:', error); return []; }
    const blocked = await getBlockedIds();
    const hydrated = await hydratePosts((data || []).filter(p => !blocked.has(p.user_id)));
    const now = Date.now();
    const score = (p: FeedPost) => {
        const hours = Math.max(0, (now - new Date(p.createdAt).getTime()) / 3.6e6);
        return (p.likeCount + 2 * p.commentCount + 1) / Math.pow(hours + 2, 1.4);
    };
    return hydrated.sort((a, b) => score(b) - score(a)).slice(0, PAGE);
}

/** A single user's posts (for their profile). */
export async function getUserPosts(userId: string): Promise<FeedPost[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) { console.error('[feed] getUserPosts failed:', error); return []; }
    return hydratePosts(data || []);
}

export async function createPost(input: NewPost): Promise<FeedPost | null> {
    if (!supabase) return null;
    const uid = await currentUserId();
    const body = input.body?.trim() || null;
    const { data, error } = await supabase.from('posts').insert({
        user_id: uid, kind: input.kind, body,
        image_url: input.imageUrl ?? null, trip_id: input.tripId ?? null,
        place_key: input.placeKey ?? null, place_name: input.placeName ?? null,
    }).select().single();
    if (error) throw error;

    // Extract #hashtags + record @mentions (best-effort — a failure here shouldn't lose the post).
    const tags = body ? extractHashtags(body) : [];
    const mentionIds = [...new Set((input.mentionUserIds || []).filter(id => id !== uid))];
    await Promise.allSettled([
        tags.length ? supabase.from('post_hashtags').insert(tags.map(tag => ({ post_id: data.id, tag }))) : Promise.resolve(),
        mentionIds.length ? supabase.from('post_mentions').insert(mentionIds.map(user_id => ({ post_id: data.id, user_id }))) : Promise.resolve(),
        ...mentionIds.map(rid => pushNotification(rid, 'mention', { postId: data.id })),
    ]);
    return (await hydratePosts([data]))[0] || null;
}

export async function deletePost(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
}

// ── Likes ────────────────────────────────────────────────────────────────────

export async function toggleLike(postId: string, liked: boolean, authorId?: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    if (liked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: uid });
        if (error && error.code !== '23505') throw error; // ignore duplicate like
        if (authorId) pushNotification(authorId, 'like', { postId });
    }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function getComments(postId: string): Promise<PostComment[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('post_comments').select('id, body, created_at, user_id').eq('post_id', postId).order('created_at', { ascending: true });
    if (error || !data || data.length === 0) return [];
    const blocked = await getBlockedIds();
    const visible = data.filter(c => !blocked.has(c.user_id));
    const userIds = [...new Set(visible.map(c => c.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));
    return visible.map(c => ({ id: c.id, body: c.body, createdAt: c.created_at, userId: c.user_id, author: authorOf(pmap, c.user_id) }));
}

export async function addComment(postId: string, body: string, authorId?: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    const trimmed = body.trim();
    if (!trimmed) return;
    const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: uid, body: trimmed }).select('id').single();
    if (error) throw error;
    if (authorId) pushNotification(authorId, 'comment', { postId, commentId: data?.id });
}

export async function deleteComment(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', id);
    if (error) throw error;
}

// ── Follows ───────────────────────────────────────────────────────────────────

export async function follow(userId: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    const { error } = await supabase.from('follows').insert({ follower_id: uid, followee_id: userId });
    if (error && error.code !== '23505') throw error;
    pushNotification(userId, 'follow');
}

export async function unfollow(userId: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    const { error } = await supabase.from('follows').delete().eq('follower_id', uid).eq('followee_id', userId);
    if (error) throw error;
}

/** Set of user ids the caller follows — for follow-state on cards + the feed query. */
export async function getFollowingSet(): Promise<Set<string>> {
    if (!supabase) return new Set();
    const uid = await currentUserId();
    const { data } = await supabase.from('follows').select('followee_id').eq('follower_id', uid);
    return new Set((data || []).map(f => f.followee_id));
}

/** Whether a user's profile is private (followers-only posts). */
export async function getUserPrivacy(userId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data } = await supabase.from('profiles').select('is_private').eq('id', userId).maybeSingle();
    return !!data?.is_private;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
    if (!supabase) return { followers: 0, following: 0 };
    const [f1, f2] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
    return { followers: f1.count || 0, following: f2.count || 0 };
}

async function hydrateAuthors(ids: string[]): Promise<PostAuthor[]> {
    if (!supabase || ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', unique);
    const pmap = new Map((data || []).map(p => [p.id, p]));
    return unique.map(id => authorOf(pmap, id));
}

/** Users who follow `userId`. */
export async function getFollowers(userId: string): Promise<PostAuthor[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('follows').select('follower_id').eq('followee_id', userId);
    return hydrateAuthors((data || []).map(f => f.follower_id));
}

/** Users `userId` follows. */
export async function getFollowing(userId: string): Promise<PostAuthor[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('follows').select('followee_id').eq('follower_id', userId);
    return hydrateAuthors((data || []).map(f => f.followee_id));
}

/** People to follow: recent posters first, then other recent travelers you don't follow. */
export async function getSuggestedUsers(): Promise<PostAuthor[]> {
    if (!supabase) return [];
    const uid = await currentUserId();
    const [{ data: recent }, { data: fol }, { data: profs }] = await Promise.all([
        supabase.from('posts').select('user_id').order('created_at', { ascending: false }).limit(80),
        supabase.from('follows').select('followee_id').eq('follower_id', uid),
        supabase.from('profiles').select('id, display_name, avatar_url').order('created_at', { ascending: false }).limit(60),
    ]);
    const blocked = await getBlockedIds();
    const followed = new Set([uid, ...(fol || []).map(f => f.followee_id), ...blocked]);
    const pmap = new Map((profs || []).map(p => [p.id, p]));
    const activeIds = [...new Set((recent || []).map(r => r.user_id))].filter(id => !followed.has(id));
    const activeSet = new Set(activeIds);
    const otherIds = (profs || []).map(p => p.id).filter(id => !followed.has(id) && !activeSet.has(id));
    const ordered = [...activeIds, ...otherIds].slice(0, 12);
    // Some active posters may not be in the recent-profiles page — fetch their profiles.
    const missing = ordered.filter(id => !pmap.has(id));
    if (missing.length) {
        const { data: extra } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', missing);
        (extra || []).forEach(p => pmap.set(p.id, p));
    }
    return ordered.map(id => authorOf(pmap, id));
}

/** Search travelers by display name (for the Discover search box). */
export async function searchUsers(query: string): Promise<PostAuthor[]> {
    if (!supabase) return [];
    const q = query.trim();
    if (!q) return [];
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const escaped = q.replace(/[%_]/g, m => `\\${m}`); // treat % and _ as literals
    const [{ data }, blocked] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').ilike('display_name', `%${escaped}%`).limit(20),
        getBlockedIds(),
    ]);
    return (data || []).filter(p => p.id !== uid && !blocked.has(p.id)).map(p => ({ userId: p.id, name: p.display_name || 'Traveler', avatar: p.avatar_url || null }));
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function reportPost(postId: string, reason?: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    const { error } = await supabase.from('post_reports').insert({ post_id: postId, user_id: uid, reason: reason ?? null });
    if (error && error.code !== '23505') throw error; // already reported → treat as done
}

// ── Photo upload (mirrors AuthContext.uploadAvatar) ────────────────────────────

export async function uploadPostPhoto(file: File): Promise<string> {
    if (!supabase) throw new Error('Community features aren’t configured.');
    const uid = await currentUserId();
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Image must be under 8 MB.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('post-photos').upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from('post-photos').getPublicUrl(path);
    // Optional NSFW screening: if a moderation provider is configured server-side and flags the
    // image, remove it and reject. No-op (allow) when unconfigured. Best-effort otherwise.
    try {
        await screenImageUrl(data.publicUrl);
    } catch (e) {
        await supabase.storage.from('post-photos').remove([path]).catch(() => {});
        throw e;
    }
    return data.publicUrl;
}

/** Ask the server to screen an uploaded image by URL. Throws only when a configured provider
 *  actively flags it; degrades to "allow" when unconfigured or unreachable. */
async function screenImageUrl(url: string): Promise<void> {
    let flagged: string | null = null;
    try {
        const res = await fetch('/api/moderate/image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
        });
        if (!res.ok) return;
        const j = await res.json();
        if (j && j.ok === false) flagged = j.reason || 'This image was flagged as inappropriate and can’t be posted.';
    } catch { /* network / endpoint missing → allow */ }
    if (flagged) throw new Error(flagged);
}

// ── Notifications ───────────────────────────────────────────────────────────────

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention';

export interface FeedNotification {
    id: string;
    type: NotificationType;
    read: boolean;
    createdAt: string;
    actor: PostAuthor;
    postId: string | null;
}

/** Best-effort insert of a notification for someone else's benefit (never for yourself). */
async function pushNotification(recipientId: string, type: NotificationType, opts?: { postId?: string | null; commentId?: string | null }): Promise<void> {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid || uid === recipientId) return;
    await supabase.from('notifications').insert({
        recipient_id: recipientId, actor_id: uid, type,
        post_id: opts?.postId ?? null, comment_id: opts?.commentId ?? null,
    });
}

export async function listNotifications(): Promise<FeedNotification[]> {
    if (!supabase) return [];
    const uid = await currentUserId();
    const { data, error } = await supabase
        .from('notifications')
        .select('id, type, read, created_at, actor_id, post_id')
        .eq('recipient_id', uid)
        .order('created_at', { ascending: false })
        .limit(40);
    if (error || !data) return [];
    const actors = await hydrateAuthors(data.map(n => n.actor_id));
    const amap = new Map(actors.map(a => [a.userId, a]));
    return data.map(n => ({
        id: n.id, type: n.type as NotificationType, read: n.read, createdAt: n.created_at,
        actor: amap.get(n.actor_id) || { userId: n.actor_id, name: 'Traveler', avatar: null },
        postId: n.post_id,
    }));
}

export async function unreadNotificationCount(): Promise<number> {
    if (!supabase) return 0;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return 0;
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', uid).eq('read', false);
    return count || 0;
}

export async function markNotificationsRead(): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', uid).eq('read', false);
}

// ── Blocking ────────────────────────────────────────────────────────────────────

/** All user ids involved in a block with me (either direction) — hidden from my feeds. */
export async function getBlockedIds(): Promise<Set<string>> {
    if (!supabase) return new Set();
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return new Set();
    const { data: rows } = await supabase.from('user_blocks').select('blocker_id, blocked_id').or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
    const set = new Set<string>();
    (rows || []).forEach(r => { set.add(r.blocker_id === uid ? r.blocked_id : r.blocker_id); });
    return set;
}

/** People I've blocked (for the "Blocked" management list). */
export async function getMyBlocks(): Promise<PostAuthor[]> {
    if (!supabase) return [];
    const uid = await currentUserId();
    const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid);
    return hydrateAuthors((data || []).map(r => r.blocked_id));
}

export async function blockUser(userId: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    // Blocking implies unfollowing both ways.
    await Promise.allSettled([
        supabase.from('user_blocks').insert({ blocker_id: uid, blocked_id: userId }),
        supabase.from('follows').delete().eq('follower_id', uid).eq('followee_id', userId),
        supabase.from('follows').delete().eq('follower_id', userId).eq('followee_id', uid),
    ]);
}

export async function unblockUser(userId: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    await supabase.from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', userId);
}

// ── Hashtags ────────────────────────────────────────────────────────────────────

/** Posts tagged with a #hashtag (newest first). */
export async function getPostsByHashtag(tag: string): Promise<FeedPost[]> {
    if (!supabase) return [];
    const clean = tag.replace(/^#/, '').toLowerCase();
    const { data: rows } = await supabase.from('post_hashtags').select('post_id').eq('tag', clean).limit(60);
    const ids = (rows || []).map(r => r.post_id);
    if (ids.length === 0) return [];
    const { data } = await supabase.from('posts').select('*').in('id', ids).order('created_at', { ascending: false });
    const blocked = await getBlockedIds();
    return hydratePosts((data || []).filter(p => !blocked.has(p.user_id)));
}
