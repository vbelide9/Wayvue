import { MapPin, Navigation, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState, useEffect, useRef } from "react"

interface LocationInputProps {
    label: string
    placeholder: string
    value: string
    onChange: (val: string) => void
    onSelect?: (coords: { lat: number, lng: number, display_name: string }) => void
    icon: "start" | "destination"
}

interface Suggestion {
    place_id: number
    display_name: string
    lat: string
    lon: string
}

export function LocationInput({ label, placeholder, value, onChange, onSelect, icon }: LocationInputProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        if (!value || value.length < 3) {
            setSuggestions([])
            return
        }

        const timeoutId = setTimeout(async () => {
            setIsLoading(true)
            try {
                // Using ArcGIS World Geocoding Service (Free for public use)
                const res = await fetch(
                    `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=${encodeURIComponent(value)}&maxLocations=5`
                )
                if (res.ok) {
                    const data = await res.json()
                    if (data.candidates) {
                        const formattedSuggestions = data.candidates.map((c: any) => ({
                            place_id: Math.random(), // ArcGIS doesn't return stable IDs in this endpoint
                            display_name: c.address,
                            lat: c.location.y,
                            lon: c.location.x
                        }))
                        setSuggestions(formattedSuggestions)
                        setShowSuggestions(true)
                    }
                }
            } catch (error) {
                console.error("Autosuggest failed:", error)
            } finally {
                setIsLoading(false)
            }
        }, 500) // 500ms debounce

        return () => clearTimeout(timeoutId)
    }, [value])

    const handleSelect = (suggestion: Suggestion) => {
        onChange(suggestion.display_name)
        setShowSuggestions(false)
        if (onSelect) {
            onSelect({
                lat: parseFloat(suggestion.lat),
                lng: parseFloat(suggestion.lon),
                display_name: suggestion.display_name
            })
        }
    }

    return (
        <div className="relative group" ref={wrapperRef}>
            <label className="text-sm font-medium text-foreground mb-2 block">{label}</label>
            <div className="relative">
                <div className="absolute left-3 top-3.5 text-muted-foreground transition-colors group-focus-within:text-primary z-10">
                    {icon === "start" ? <Navigation className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>
                <Input
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange(e.target.value)
                        // Don't show suggestions immediately on typing, wait for debounce
                    }}
                    onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true)
                    }}
                    placeholder={placeholder}
                    className="pl-10 bg-card border-border h-11 text-base focus-visible:ring-primary/50"
                />
                {isLoading && (
                    <div className="absolute right-3 top-3.5 text-muted-foreground animate-spin">
                        <Loader2 className="w-4 h-4" />
                    </div>
                )}

                {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {suggestions.map((s) => (
                            <li
                                key={s.place_id}
                                onClick={() => handleSelect(s)}
                                className="px-4 py-2 hover:bg-secondary/50 cursor-pointer text-sm text-foreground border-b border-border/50 last:border-0"
                            >
                                {s.display_name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
