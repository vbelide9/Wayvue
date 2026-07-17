// Renders post/comment text with #hashtags (clickable) and @mentions (highlighted). Splits on
// whitespace so tokens stay intact. Multi-word mention display names only highlight their
// first token — the mention record + notification (stored server-side) are unaffected.
export function RichText({ text, onHashtag }: { text: string; onHashtag?: (tag: string) => void }) {
    const parts = text.split(/(\s+)/);
    return (
        <>
            {parts.map((part, i) => {
                const tag = /^#(\w{1,50})$/.exec(part);
                if (tag) {
                    return (
                        <button key={i} onClick={() => onHashtag?.(tag[1].toLowerCase())} className="text-primary font-semibold hover:underline">
                            {part}
                        </button>
                    );
                }
                if (/^@\w[\w.]*$/.test(part)) {
                    return <span key={i} className="text-primary font-semibold">{part}</span>;
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}
