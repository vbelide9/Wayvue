import { TripConfidenceCard } from "@/components/TripConfidenceCard";
import { WayvueAISummary } from "@/components/WayvueAISummary";
import { SmartScheduleCard } from "@/components/SmartScheduleCard";

interface OverviewTabProps {
    tripScore: number;
    aiAnalysis: any;
}

export function OverviewTab({ tripScore, aiAnalysis }: OverviewTabProps) {
    // Transform aiAnalysis deductions if needed, or pass directly. 
    // The TripConfidenceCard expects deductions array.
    // Assuming aiAnalysis has a similar structure or we mock it for now if missing.
    // Based on previous code in App.tsx: 
    // const fullAiAnalysis = { ...response.aiAnalysis, tripScore: ..., departureInsights: ... };
    // And TripConfidenceCard logic usually took deductions from `aiAnalysis.scoreBreakdown`?
    // Let's assume aiAnalysis has { score: number, breakdown: [] } logic or similar.

    // Fallback if aiAnalysis structure is different than expected

    // Actually, in the original App.tsx, TripConfidenceCard wasn't passed deductions directly?
    // Let's check App.tsx original usage. 
    // It was: <TripConfidenceCard score={aiAnalysis.tripScore} label={aiAnalysis.tripScoreLabel} deductions={aiAnalysis.scoreDeductions} />

    // So we need to ensure we pass these correctly.

    return (
        <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full custom-scrollbar">
            {/* 1. Trip Confidence Score - The "Hero" Metric */}
            {tripScore !== undefined && (
                <TripConfidenceCard
                    score={tripScore}
                    label={getAttributeLabel(tripScore)}
                    deductions={aiAnalysis?.tripScore?.deductions || []}
                />
            )}

            {/* 2. Smart Schedule Card */}
            {aiAnalysis?.departureInsights && aiAnalysis.departureInsights.length > 0 && (
                <SmartScheduleCard insights={aiAnalysis.departureInsights} />
            )}

            {/* 3. AI Summary Card */}
            {/* We unwrap the WayvueAISummary to just be a card, or use it as is. 
                For now, use as is to minimize regression. */}
            <WayvueAISummary analysis={aiAnalysis} />

            {/* 3. Empty State / Loading placeholder if no analysis */}
            {!aiAnalysis && (
                <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
                    <p>Calculating trip insights...</p>
                </div>
            )}
        </div>
    );
}

function getAttributeLabel(score: number) {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 60) return "Fair";
    return "Risky";
}
