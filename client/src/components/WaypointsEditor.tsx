import { AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Plus, X } from 'lucide-react';
import { LocationInput } from './LocationInput';

export interface Waypoint {
    id: string;
    name: string;
    lat?: number;
    lng?: number;
}

// Not crypto.randomUUID(): that requires a secure context (https/localhost),
// and this only needs to be unique within one browser session's array.
export function makeWaypointId() {
    return `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface WaypointsEditorProps {
    waypoints: Waypoint[];
    onWaypointsChange: (waypoints: Waypoint[]) => void;
    /** Fired when the stop list is "finalized" (a stop picked with coords, or one
     *  removed) so the caller can re-route immediately — no "Update Route" click needed. */
    onCommit?: (waypoints: Waypoint[]) => void;
}

function WaypointRow({
    wp,
    index,
    onUpdate,
    onRemove,
}: {
    wp: Waypoint;
    index: number;
    onUpdate: (index: number, patch: Partial<Waypoint>) => void;
    onRemove: (index: number) => void;
}) {
    const dragControls = useDragControls();
    return (
        <Reorder.Item
            value={wp}
            dragListener={false}
            dragControls={dragControls}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-visible mb-2 bg-card relative"
            style={{ listStyle: 'none' }}
        >
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onPointerDown={(e) => dragControls.start(e)}
                    className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing touch-none shrink-0"
                    title="Drag to reorder"
                    aria-label={`Drag to reorder stop ${index + 1}`}
                >
                    <GripVertical size={15} />
                </button>
                <div className="flex-1 min-w-0 relative z-30">
                    <LocationInput
                        value={wp.name}
                        onChange={(val) => onUpdate(index, { name: val })}
                        onSelect={(coords) => onUpdate(index, { name: coords.display_name, lat: coords.lat, lng: coords.lng })}
                        label={`Stop ${index + 1}`}
                        variant="minimal"
                        placeholder="Add a stop along the way"
                        icon="destination"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                    title="Remove stop"
                    aria-label={`Remove stop ${index + 1}`}
                >
                    <X size={16} />
                </button>
            </div>
        </Reorder.Item>
    );
}

// Drag-and-drop multi-stop editor (Google Maps style) — grab the handle to
// reorder; the new order is submitted the next time the trip is (re)searched.
export function WaypointsEditor({ waypoints, onWaypointsChange, onCommit }: WaypointsEditorProps) {
    const updateWaypoint = (index: number, patch: Partial<Waypoint>) => {
        const next = waypoints.map((wp, i) => (i === index ? { ...wp, ...patch } : wp));
        onWaypointsChange(next);
        // A patch carrying coords means a stop was picked from autocomplete → re-route now.
        if (patch.lat !== undefined) onCommit?.(next);
    };
    const removeWaypoint = (index: number) => {
        const next = waypoints.filter((_, i) => i !== index);
        onWaypointsChange(next);
        onCommit?.(next);
    };
    const addWaypoint = () => {
        onWaypointsChange([...waypoints, { id: makeWaypointId(), name: '' }]);
    };

    return (
        <div>
            <Reorder.Group
                axis="y"
                values={waypoints}
                onReorder={onWaypointsChange}
                as="div"
                style={{ listStyle: 'none' }}
            >
                <AnimatePresence initial={false}>
                    {waypoints.map((wp, i) => (
                        <WaypointRow key={wp.id} wp={wp} index={i} onUpdate={updateWaypoint} onRemove={removeWaypoint} />
                    ))}
                </AnimatePresence>
            </Reorder.Group>
            <button
                type="button"
                onClick={addWaypoint}
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary">
                    <Plus size={13} />
                </span>
                Add stop
            </button>
        </div>
    );
}
