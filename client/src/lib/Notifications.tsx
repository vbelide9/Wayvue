// Minimal toast notifications (no external deps). Provider exposes notify(); toasts stack
// bottom-right and auto-dismiss. Used to surface collaborator activity on group trips.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface Toast {
    id: number;
    title: string;
    detail?: string;
    avatar?: string | null;
}

interface NotifyOpts { detail?: string; avatar?: string | null }

const Ctx = createContext<{ notify: (title: string, opts?: NotifyOpts) => void }>({ notify: () => {} });

export const useNotify = () => useContext(Ctx).notify;

function Avatar({ title, avatar }: { title: string; avatar?: string | null }) {
    const initials = title.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '•';
    return (
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-primary/10 text-primary text-xs font-bold flex items-center justify-center border border-border/60">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

    const notify = useCallback((title: string, opts?: NotifyOpts) => {
        const id = nextId.current++;
        setToasts(t => [...t, { id, title, detail: opts?.detail, avatar: opts?.avatar }].slice(-4));
        setTimeout(() => dismiss(id), 5000);
    }, [dismiss]);

    return (
        <Ctx.Provider value={{ notify }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2 w-[min(92vw,340px)] pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className="pointer-events-auto flex items-start gap-3 bg-card border border-border rounded-2xl shadow-xl px-3.5 py-3 animate-in slide-in-from-right-4 fade-in duration-300"
                    >
                        {(t.avatar !== undefined) && <Avatar title={t.title} avatar={t.avatar} />}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground leading-snug">{t.title}</p>
                            {t.detail && <p className="text-xs text-muted-foreground leading-snug mt-0.5">{t.detail}</p>}
                        </div>
                        <button onClick={() => dismiss(t.id)} className="p-1 -m-1 rounded text-muted-foreground/60 hover:text-foreground shrink-0">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}
