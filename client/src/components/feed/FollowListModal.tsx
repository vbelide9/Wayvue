// Followers / Following list (Instagram-style), opened by tapping a profile's counts.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { getFollowers, getFollowing, type PostAuthor } from '@/lib/feed';
import { Avatar } from './PostCard';

export function FollowListModal({ userId, mode, onClose, onOpenProfile }: {
    userId: string;
    mode: 'followers' | 'following';
    onClose: () => void;
    onOpenProfile: (a: PostAuthor) => void;
}) {
    const [users, setUsers] = useState<PostAuthor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (mode === 'followers' ? getFollowers(userId) : getFollowing(userId)).then(u => {
            if (!cancelled) { setUsers(u); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, [userId, mode]);

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-bold capitalize">{mode}</span>
                    <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : users.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">No {mode} yet.</p>
                    ) : users.map(u => (
                        <button
                            key={u.userId}
                            onClick={() => { onClose(); onOpenProfile(u); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
                        >
                            <Avatar author={u} size={38} />
                            <span className="text-sm font-semibold text-foreground truncate">{u.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}
