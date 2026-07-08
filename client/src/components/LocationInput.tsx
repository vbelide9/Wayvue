import { MapPin, Navigation, Loader2, Locate } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState, useEffect, useRef } from "react"

interface LocationInputProps {
    label: string
    placeholder: string
    value: string
    onChange: (val: string) => void
    onSelect?: (coords: { lat: number, lng: number, display_name: string }) => void
    icon: "start" | "destination"
    variant?: "default" | "minimal"
}

interface Suggestion {
    place_id: number
    display_name: string
    lat: string
    lon: string
}

export function LocationInput({ label, placeholder, value, onChange, onSelect, icon, variant = "default" }: LocationInputProps) {
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
                        // Only show suggestions if the input is currently focused
                        if (wrapperRef.current?.contains(document.activeElement)) {
                            setShowSuggestions(true)
                        }
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
            {variant !== "minimal" && <label className="text-sm font-medium text-foreground mb-2 block">{label}</label>}
            <div className="relative">
                <div className="absolute left-3 top-3.5 transition-colors group-focus-within:text-primary z-10 text-muted-foreground">
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

                        // Clear if it's a default value
                        const defaultValues = ["New York, NY", "Buffalo, NY", "Start", "End"];
                        if (defaultValues.includes(value)) {
                            onChange("");
                        }
                    }}
                    placeholder={placeholder}
                    className="pl-10 pr-10 h-11 text-base rounded-xl transition-all duration-300 bg-secondary/60 backdrop-blur-xl border border-border text-foreground font-medium placeholder:text-muted-foreground/70 hover:bg-secondary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 outline-none shadow-sm"
                />
                {/* Current Location Button (Only for Start input and when empty or explicitly requested, but standard pattern is always show on right) */}
                {icon === "start" && !isLoading && (
                    <button
                        type="button"
                        onClick={() => {
                            if (navigator.geolocation) {
                                setIsLoading(true);
                                navigator.geolocation.getCurrentPosition(async (pos) => {
                                    try {
                                        const { latitude, longitude } = pos.coords;
                                        // Reverse Geocode using ArcGIS
                                        const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${longitude},${latitude}`);
                                        if (res.ok) {
                                            const data = await res.json();
                                            if (data.address) {
                                                const address = data.address.LongLabel || data.address.Match_addr;
                                                onChange(address);
                                                if (onSelect) {
                                                    onSelect({
                                                        lat: latitude,
                                                        lng: longitude,
                                                        display_name: address
                                                    });
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.error("Geolocation failed", e);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }, (err) => {
                                    console.error("Geolocation error", err);
                                    setIsLoading(false);
                                    alert("Could not access location. Please enable permissions.");
                                });
                            }
                        }}
                        className="absolute right-3 top-3.5 text-muted-foreground hover:text-primary transition-colors z-20"
                        title="Use Current Location"
                        aria-label="Use current location"
                    >
                        <Locate className="w-4 h-4" />
                    </button>
                )}

                {isLoading && (
                    <div className="absolute right-3 top-3.5 text-muted-foreground animate-spin z-30">
                        <Loader2 className="w-4 h-4" />
                    </div>
                )}

                {showSuggestions && suggestions.length > 0 && (
                    <ul data-lenis-prevent className="absolute top-full left-0 right-0 z-50 mt-2 bg-card border border-border rounded-xl shadow-soft-lg max-h-60 overflow-y-auto no-scrollbar">
                        {suggestions.map((s) => (
                            <li
                                key={s.place_id}
                                onClick={() => handleSelect(s)}
                                className="px-4 py-3 hover:bg-secondary cursor-pointer text-sm text-foreground font-medium border-b border-border last:border-0 transition-colors"
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
