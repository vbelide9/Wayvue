// Notifications center: a bell with an unread badge that opens a dropdown of recent activity
// — who liked / commented on your posts, followed you, or mentioned you. Polls the unread
// count; marks everything read when opened. No-ops when signed out.
import { useEffect, useRef, useState } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Avatar } from './PostCard';
import {
    listNotifications, unreadNotificationCount, markNotificationsRead,
    type FeedNotification, type NotificationType, type PostAuthor,
} from '@/lib/feed';

const VERB: Record<NotificationType, string> = {
    like: 'liked your post',
    comment: 'commented on your post',
    follow: 'started following you',
    mention: 'mentioned you',
};
const ICON: Record<NotificationType, typeof Heart> = {
    like: Heart, comment: MessageCircle, follow: UserPlus, mention: AtSign,
};

function ago(iso: string): string {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 604800) return `${Math.floor(s / 86400)}d`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationsBell({ onOpenProfile }: { onOpenProfile?: (a: PostAuthor) => void }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState(0);
    const [items, setItems] = useState<FeedNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Poll unread count.
    useEffect(() => {
        if (!user) { setCount(0); return; }
        let alive = true;
        const load = () => unreadNotificationCount().then(c => { if (alive) setCount(c); }).catch(() => {});
        load();
        const t = setInterval(load, 30000);
        return () => { alive = false; clearInterval(t); };
    }, [user]);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    if (!user) return null;

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next) {
            setLoading(true);
            try {
                setItems(await listNotifications());
                if (count > 0) { await markNotificationsRead(); setCount(0); }
            } finally { setLoading(false); }
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={toggle} aria-label="Notifications" className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Bell className="w-5 h-5" />
                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-card border border-border rounded-2xl shadow-2xl z-[60] overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-bold text-foreground">Notifications</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-10 px-4">No notifications yet. Likes, comments, follows, and mentions show up here.</p>
                        ) : items.map(n => {
                            const Icon = ICON[n.type];
                            return (
                                <button key={n.id} onClick={() => { onOpenProfile?.(n.actor); setOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/60 transition-colors ${n.read ? '' : 'bg-primary/[0.04]'}`}>
                                    <div className="relative shrink-0">
                                        <Avatar author={n.actor} size={36} />
                                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center">
                                            <Icon className="w-2.5 h-2.5 text-primary" />
                                        </span>
                                    </div>
                                    <p className="text-sm text-foreground leading-snug flex-1">
                                        <span className="font-bold">{n.actor.name}</span> <span className="text-muted-foreground">{VERB[n.type]}</span>
                                        <span className="text-muted-foreground/70 text-xs"> · {ago(n.createdAt)}</span>
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
