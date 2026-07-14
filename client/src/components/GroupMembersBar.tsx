// Trip header control for group planning: a members avatar-stack + an Invite popover
// (copy link now; email invites are a stubbed follow-on). Only shows once the trip is
// saved. Clicking a member (as owner) offers Remove; a non-owner sees Leave trip.
import { useEffect, useRef, useState } from 'react';
import { Users, Link2, Check, Mail, UserMinus, LogOut } from 'lucide-react';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { useAuth } from '@/lib/AuthContext';
import type { TripMember } from '@/lib/groupTrips';

function MemberAvatar({ member, ring = true }: { member: TripMember; ring?: boolean }) {
    const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return (
        <div
            title={`${member.name}${member.role === 'owner' ? ' (organizer)' : ''}`}
            className={`w-7 h-7 rounded-full overflow-hidden bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center ${ring ? 'ring-2 ring-card' : 'border border-border/60'}`}
        >
            {member.avatar ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function GroupMembersBar() {
    const { tripId } = useTripPlan();
    const { user } = useAuth();
    const { members, isOwner, getInvite, kick, leave } = useGroupTrip();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [manage, setManage] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setManage(null); } };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    // Nothing to show until the trip is saved (group planning acts on a persisted trip).
    if (!tripId) return null;

    const copyLink = async () => {
        const link = await getInvite();
        if (!link) return;
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
    };

    const shown = members.slice(0, 4);
    const extra = members.length - shown.length;

    return (
        <div className="relative shrink-0" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                aria-label="Trip members"
                className="flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full bg-secondary/50 border border-border/50 hover:bg-secondary hover:border-primary/40 transition-colors"
            >
                {members.length > 0 ? (
                    <div className="flex -space-x-2">
                        {shown.map(m => <MemberAvatar key={m.userId} member={m} />)}
                        {extra > 0 && (
                            <div className="w-7 h-7 rounded-full bg-secondary ring-2 ring-card text-[10px] font-bold text-muted-foreground flex items-center justify-center">+{extra}</div>
                        )}
                    </div>
                ) : (
                    <Users className="w-4 h-4 text-muted-foreground" />
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl z-[1100] overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trip members</span>
                        <span className="text-xs font-semibold text-muted-foreground">{members.length}</span>
                    </div>

                    <div className="max-h-56 overflow-y-auto py-1">
                        {members.map(m => {
                            const isMe = m.userId === user?.id;
                            const canManage = (isOwner && m.role !== 'owner') || (isMe && m.role !== 'owner');
                            return (
                                <div key={m.userId} className="px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/50">
                                    <MemberAvatar member={m} ring={false} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-foreground truncate">{m.name}{isMe && <span className="text-muted-foreground font-normal"> (you)</span>}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.role === 'owner' ? 'Organizer' : 'Member'}</div>
                                    </div>
                                    {canManage && (
                                        manage === m.userId ? (
                                            <button
                                                onClick={async () => { setManage(null); isMe ? await leave() : await kick(m.userId); }}
                                                className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                                            >
                                                {isMe ? <><LogOut className="w-3 h-3" /> Leave</> : <><UserMinus className="w-3 h-3" /> Remove</>}
                                            </button>
                                        ) : (
                                            <button onClick={() => setManage(m.userId)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                                                {isMe ? 'Leave' : 'Manage'}
                                            </button>
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-2 border-t border-border space-y-1">
                        <button
                            onClick={copyLink}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4 text-primary" />}
                            {copied ? 'Link copied!' : 'Copy invite link'}
                        </button>
                        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground/60 cursor-not-allowed">
                            <Mail className="w-4 h-4" />
                            Email invites <span className="ml-auto text-[10px] uppercase tracking-wider">Soon</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
