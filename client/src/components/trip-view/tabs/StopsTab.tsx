import { PlacesRecommendations } from '@/components/PlacesRecommendations';

interface StopsTabProps {
    recommendations: any[];
}

export function StopsTab({ recommendations }: StopsTabProps) {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-4">
                <PlacesRecommendations
                    places={recommendations}
                />
            </div>
        </div>
    );
}
