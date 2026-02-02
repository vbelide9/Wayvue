import { RoadConditionCard, type RoadCondition } from '@/components/RoadConditionCard';

interface RoadTabProps {
    roadConditions: RoadCondition[];
    onSegmentSelect: (condition: RoadCondition) => void;
}

export function RoadTab({ roadConditions, onSegmentSelect }: RoadTabProps) {
    if (!roadConditions || roadConditions.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                No major road alerts reported along this route.
            </div>
        );
    }

    return (
        <div className="h-full animate-in fade-in slide-in-from-right-2 duration-300">
            <RoadConditionCard
                conditions={roadConditions}
                onSegmentSelect={onSegmentSelect}
            />
        </div>
    );
}
