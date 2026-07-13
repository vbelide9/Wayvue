// Single source of truth for the Wayvue brand lockup — logo mark + wordmark.
// Use everywhere the product identifies itself so the branding stays consistent.

interface WayvueBrandProps {
    /** Overall scale of the lockup */
    size?: 'sm' | 'md' | 'lg';
    /** Show the "Trip Intelligence" tagline under the wordmark */
    tagline?: boolean;
    /** Hide the wordmark and render the logo mark only */
    markOnly?: boolean;
    onClick?: () => void;
    className?: string;
}

const SIZES = {
    sm: { box: 'w-7 h-7', word: 'text-base', tag: 'text-[9px]' },
    md: { box: 'w-10 h-10', word: 'text-lg', tag: 'text-[10px]' },
    lg: { box: 'w-12 h-12', word: 'text-2xl', tag: 'text-[11px]' },
};

export function WayvueBrand({ size = 'md', tagline = false, markOnly = false, onClick, className = '' }: WayvueBrandProps) {
    const s = SIZES[size];
    const content = (
        <>
            <div className={`${s.box} rounded-full bg-card border border-primary/25 shadow-amber-soft overflow-hidden flex items-center justify-center shrink-0`}>
                <img src="/logo.svg" alt="Wayvue logo" className="w-[78%] h-[78%] object-contain" />
            </div>
            {!markOnly && (
                <div className="text-left leading-none">
                    <span className={`${s.word} font-display font-bold tracking-tight text-foreground block`}>Wayvue</span>
                    {tagline && (
                        <span className={`${s.tag} text-muted-foreground font-semibold tracking-[0.18em] uppercase block mt-1`}>
                            Trip Intelligence
                        </span>
                    )}
                </div>
            )}
        </>
    );

    if (onClick) {
        return (
            <button onClick={onClick} aria-label="Wayvue home" className={`flex items-center gap-2.5 group ${className}`}>
                {content}
            </button>
        );
    }
    return <div className={`flex items-center gap-2.5 ${className}`}>{content}</div>;
}
