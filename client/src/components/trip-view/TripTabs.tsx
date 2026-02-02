import { LayoutDashboard, CloudSun, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type TabId = 'overview' | 'forecast' | 'stops' | 'road';

interface TripTabsProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

export function TripTabs({ activeTab, onTabChange }: TripTabsProps) {
    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'forecast', label: 'Forecast', icon: CloudSun },
        { id: 'stops', label: 'Stops', icon: MapPin },
        { id: 'road', label: 'Road', icon: AlertTriangle },
    ] as const;

    return (
        <div className="flex items-center p-1 bg-muted/30 rounded-lg shrink-0 overflow-x-auto scrollbar-none gap-1">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <Button
                        key={tab.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => onTabChange(tab.id)}
                        className={`flex-1 min-w-fit h-9 px-3 text-xs font-medium transition-all ${isActive
                            ? "bg-background shadow-sm text-foreground hover:bg-background"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            }`}
                    >
                        <Icon className={`w-3.5 h-3.5 mr-1.5 ${isActive ? "text-primary" : ""}`} />
                        {tab.label}
                    </Button>
                );
            })}
        </div>
    );
}
