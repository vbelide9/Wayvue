// A user row for search results / lists: avatar + name (tap → profile) and a Follow toggle.
import { UserPlus, UserCheck } from 'lucide-react';
import { Avatar } from './PostCard';
import type { PostAuthor } from '@/lib/feed';

export function UserRow({ user, isFollowing, onToggleFollow, onOpen, canFollow = true }: {
    user: PostAuthor;
    isFollowing: boolean;
    onToggleFollow: (u: PostAuthor) => void;
    onOpen: (u: PostAuthor) => void;
    canFollow?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 rounded-xl transition-colors">
            <button onClick={() => onOpen(user)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <Avatar author={user} size={40} />
                <span className="text-sm font-semibold text-foreground truncate">{user.name}</span>
            </button>
            {canFollow && (
                <button
                    onClick={() => onToggleFollow(user)}
                    className={`flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-bold shrink-0 transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                >
                    {isFollowing ? <><UserCheck className="w-3.5 h-3.5" /> Following</> : <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
                </button>
            )}
        </div>
    );
}
