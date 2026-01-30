import { MapPin, Navigation } from "lucide-react"
import { Input } from "@/components/ui/input"

interface LocationInputProps {
    label: string
    placeholder: string
    value: string
    onChange: (val: string) => void
    icon: "start" | "destination"
}

export function LocationInput({ label, placeholder, value, onChange, icon }: LocationInputProps) {
    return (
        <div className="relative group">
            <label className="text-sm font-medium text-foreground mb-2 block">{label}</label>
            <div className="relative">
                <div className="absolute left-3 top-2.5 text-muted-foreground transition-colors group-focus-within:text-primary">
                    {icon === "start" ? <Navigation className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>
                <Input
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="pl-10 bg-card border-border h-11 text-base focus-visible:ring-primary/50"
                />
            </div>
        </div>
    )
}
