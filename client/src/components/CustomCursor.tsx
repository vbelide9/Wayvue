import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function CustomCursor() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            if (!isVisible) setIsVisible(true);
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseOver = (e: MouseEvent) => {
            let target = e.target as HTMLElement | null;
            let foundClickable = false;

            // Bubble up to check if any parent is clickable to handle complex elements
            while (target && target !== document.body) {
                if (
                    window.getComputedStyle(target).cursor === 'pointer' ||
                    target.tagName.toLowerCase() === 'a' ||
                    target.tagName.toLowerCase() === 'button'
                ) {
                    foundClickable = true;
                    break;
                }
                target = target.parentElement;
            }

            setIsHovering(foundClickable);
        };

        const handleMouseLeave = () => {
            setIsVisible(false);
        };

        window.addEventListener('mousemove', updateMousePosition);
        window.addEventListener('mouseover', handleMouseOver);
        document.body.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            window.removeEventListener('mousemove', updateMousePosition);
            window.removeEventListener('mouseover', handleMouseOver);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [isVisible]);

    const variants = {
        default: {
            x: mousePosition.x - 8,
            y: mousePosition.y - 8,
            width: 16,
            height: 16,
            backgroundColor: '#ffffff',
            mixBlendMode: 'difference' as any,
            opacity: isVisible ? 1 : 0,
        },
        hover: {
            x: mousePosition.x - 32,
            y: mousePosition.y - 32,
            width: 64,
            height: 64,
            backgroundColor: '#ffffff',
            mixBlendMode: 'difference' as any,
            opacity: isVisible ? 1 : 0,
        }
    };

    return (
        <motion.div
            className="fixed top-0 left-0 rounded-full pointer-events-none z-[9999] hidden md:block"
            variants={variants}
            animate={isHovering ? "hover" : "default"}
            transition={{ type: "tween", ease: "backOut", duration: 0.15 }}
        />
    );
}
