import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
    icon?: ReactNode;
}

export function CollapsibleSection({ title, children, defaultOpen = true, className = "", icon }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`flex flex-col border-b border-border last:border-0 transition-all duration-300 ${className} ${isOpen ? 'flex-[1_1_auto] min-h-0' : 'flex-none'}`}>
            <button
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors w-full text-left bg-card/50 backdrop-blur-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-bold text-sm tracking-wide text-foreground/90 uppercase">{title}</h3>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {isOpen && (
                <div className="overflow-y-auto min-h-0 flex-1 animate-in slide-in-from-top-1 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    )
}
