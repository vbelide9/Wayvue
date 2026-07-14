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
    const { data: fol } = await supabase.from('follows').select('followee_id').eq('follower_id', uid);
    const authorIds = [uid, ...(fol || []).map(f => f.followee_id)];
    let q = supabase.from('posts').select('*').in('user_id', authorIds).order('created_at', { ascending: false }).limit(PAGE);
    if (cursor) q = q.lt('created_at', cursor);
    const { data, error } = await q;
    if (error) { console.error('[feed] getFeed failed:', error); return []; }
    return hydratePosts(data || []);
}

/** Recent posts from anyone (solves the empty feed before you follow people). */
export async function getDiscover(cursor?: string): Promise<FeedPost[]> {
    if (!supabase) return [];
    let q = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(PAGE);
    if (cursor) q = q.lt('created_at', cursor);
    const { data, error } = await q;
    if (error) { console.error('[feed] getDiscover failed:', error); return []; }
    return hydratePosts(data || []);
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
    const { data, error } = await supabase.from('posts').insert({
        user_id: uid, kind: input.kind, body: input.body?.trim() || null,
        image_url: input.imageUrl ?? null, trip_id: input.tripId ?? null,
        place_key: input.placeKey ?? null, place_name: input.placeName ?? null,
    }).select().single();
    if (error) throw error;
    return (await hydratePosts([data]))[0] || null;
}

export async function deletePost(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
}

// ── Likes ────────────────────────────────────────────────────────────────────

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    if (liked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: uid });
        if (error && error.code !== '23505') throw error; // ignore duplicate like
    }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function getComments(postId: string): Promise<PostComment[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('post_comments').select('id, body, created_at, user_id').eq('post_id', postId).order('created_at', { ascending: true });
    if (error || !data || data.length === 0) return [];
    const userIds = [...new Set(data.map(c => c.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));
    return data.map(c => ({ id: c.id, body: c.body, createdAt: c.created_at, userId: c.user_id, author: authorOf(pmap, c.user_id) }));
}

export async function addComment(postId: string, body: string): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    const trimmed = body.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: uid, body: trimmed });
    if (error) throw error;
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

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
    if (!supabase) return { followers: 0, following: 0 };
    const [f1, f2] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
    return { followers: f1.count || 0, following: f2.count || 0 };
}

/** Recent posters you don't follow yet (simple discovery). */
export async function getSuggestedUsers(): Promise<PostAuthor[]> {
    if (!supabase) return [];
    const uid = await currentUserId();
    const [{ data: recent }, { data: fol }] = await Promise.all([
        supabase.from('posts').select('user_id').order('created_at', { ascending: false }).limit(80),
        supabase.from('follows').select('followee_id').eq('follower_id', uid),
    ]);
    const followed = new Set([uid, ...(fol || []).map(f => f.followee_id)]);
    const candidateIds = [...new Set((recent || []).map(r => r.user_id))].filter(id => !followed.has(id)).slice(0, 10);
    if (candidateIds.length === 0) return [];
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', candidateIds);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));
    return candidateIds.map(id => authorOf(pmap, id));
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
    return data.publicUrl;
}
