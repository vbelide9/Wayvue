// Group-planning control for the "My Plan" section: an expandable card showing trip
// members and an invite action (copy link now; email invites are a stubbed follow-on).
// Only shows once the trip is saved. Owner can remove members; a member can leave.
import { useState } from 'react';
import { UserPlus, ChevronDown, Link2, Check, Mail, UserMinus, LogOut } from 'lucide-react';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { useAuth } from '@/lib/AuthContext';
import type { TripMember } from '@/lib/groupTrips';

function MemberAvatar({ member }: { member: TripMember }) {
    const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return (
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center border border-border/60">
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

    // Group planning acts on a persisted trip — nothing to show until it's saved.
    if (!tripId) return null;

    const copyLink = async () => {
        const link = await getInvite();
        if (!link) return;
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
    };

    return (
        <div className="border border-border rounded-2xl overflow-hidden bg-card">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
            >
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                    <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-bold text-foreground">Trip members</div>
                    <div className="text-xs text-muted-foreground truncate">
                        {members.length} {members.length === 1 ? 'person' : 'people'} · invite friends to plan together
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="border-t border-border">
                    <div className="py-1">
                        {members.map(m => {
                            const isMe = m.userId === user?.id;
                            const canManage = m.role !== 'owner' && (isOwner || isMe);
                            return (
                                <div key={m.userId} className="px-4 py-2 flex items-center gap-2.5 hover:bg-secondary/40">
                                    <MemberAvatar member={m} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-foreground truncate">
                                            {m.name}{isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.role === 'owner' ? 'Organizer' : 'Member'}</div>
                                    </div>
                                    {canManage && (
                                        manage === m.userId ? (
                                            <button
                                                onClick={async () => { setManage(null); isMe ? await leave() : await kick(m.userId); }}
                                                className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 shrink-0"
                                            >
                                                {isMe ? <><LogOut className="w-3 h-3" /> Leave</> : <><UserMinus className="w-3 h-3" /> Remove</>}
                                            </button>
                                        ) : (
                                            <button onClick={() => setManage(m.userId)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground shrink-0">
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
