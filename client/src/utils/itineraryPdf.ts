// Full-itinerary PDF export, built with jsPDF (no server round-trip needed).
import { jsPDF } from 'jspdf';

export interface ItineraryData {
    start: string;
    destination: string;
    isRoundTrip: boolean;
    departureDate?: string;
    departureTime?: string;
    returnDate?: string;
    returnTime?: string;
    preference?: string;
    stops?: string[];
    metrics: { distance?: string; time?: string; fuel?: string; ev?: string; tollCost?: string; tollEstimated?: boolean };
    tripScore?: { score: number; label: string };
    bestDeparture?: string;
    alertCount?: number;
    aiInsights?: string[];
    aiSummary?: string;
    weather?: { location: string; temp: number; unit: 'C' | 'F'; condition?: string }[];
    stopsList?: { title: string; detail?: string }[];
    roadAlerts?: { label: string; detail?: string }[];
    hotels?: { name: string; detail?: string }[];
    rentals?: { name: string; detail?: string }[];
}

// Warm brand palette (RGB)
const AMBER: [number, number, number] = [232, 106, 42];
const INK: [number, number, number] = [33, 29, 25];
const MUTED: [number, number, number] = [120, 113, 105];
const HAIR: [number, number, number] = [225, 218, 208];

export function generateItineraryPdf(data: ItineraryData) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 48; // margin
    const contentW = pageW - M * 2;
    let y = M;

    const ensure = (needed: number) => {
        if (y + needed > pageH - M) {
            doc.addPage();
            y = M;
        }
    };

    const sectionTitle = (label: string) => {
        ensure(40);
        y += 6;
        doc.setDrawColor(...HAIR);
        doc.setLineWidth(0.8);
        doc.line(M, y, pageW - M, y);
        y += 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...AMBER);
        doc.text(label.toUpperCase(), M, y);
        y += 16;
    };

    const bodyLine = (text: string, opts: { bold?: boolean; color?: [number, number, number]; size?: number; indent?: number } = {}) => {
        const size = opts.size ?? 10.5;
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(...(opts.color ?? INK));
        const x = M + (opts.indent ?? 0);
        const lines = doc.splitTextToSize(text, contentW - (opts.indent ?? 0));
        lines.forEach((ln: string) => {
            ensure(size + 6);
            doc.text(ln, x, y);
            y += size + 5;
        });
    };

    const keyValueRow = (label: string, value: string) => {
        ensure(18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...MUTED);
        doc.text(label, M, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...INK);
        doc.text(value, M + 150, y);
        y += 17;
    };

    // ── Header band ──
    doc.setFillColor(...AMBER);
    doc.rect(0, 0, pageW, 8, 'F');
    y = M + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    doc.text('Wayvue', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('Trip Intelligence', pageW - M, y, { align: 'right' });
    y += 26;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    const routeTitle = `${data.start}  →  ${data.destination}`;
    doc.splitTextToSize(routeTitle, contentW).forEach((ln: string) => {
        doc.text(ln, M, y);
        y += 20;
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    const dep = [data.departureDate, data.departureTime].filter(Boolean).join(' · ');
    const meta = [
        data.isRoundTrip ? 'Round trip' : 'One-way',
        data.preference ? `${data.preference} route` : null,
        dep ? `Departs ${dep}` : null,
        data.isRoundTrip && data.returnDate ? `Returns ${[data.returnDate, data.returnTime].filter(Boolean).join(' · ')}` : null,
    ].filter(Boolean).join('   •   ');
    if (meta) { y += 2; bodyLine(meta, { color: MUTED }); }

    // ── Trip verdict + key metrics ──
    sectionTitle('Trip Summary');
    if (data.tripScore) {
        keyValueRow('Trip score', `${data.tripScore.score}/100 - ${data.tripScore.label}`);
    }
    if (data.metrics.time) keyValueRow('Drive time', data.metrics.time);
    if (data.metrics.distance) keyValueRow('Distance', data.metrics.distance);
    if (data.metrics.fuel && data.metrics.fuel !== '0 gal') keyValueRow('Fuel (est.)', data.metrics.fuel);
    if (data.metrics.ev && data.metrics.ev !== '$0') keyValueRow('EV charging (est.)', data.metrics.ev);
    if (data.metrics.tollCost && data.metrics.tollCost !== '$0') {
        keyValueRow('Tolls (est.)', `${data.metrics.tollCost}${data.metrics.tollEstimated ? ' estimated' : ''}`);
    }
    if (data.bestDeparture) keyValueRow('Best departure', data.bestDeparture);
    if (typeof data.alertCount === 'number') keyValueRow('Road alerts', String(data.alertCount));
    if (data.stops && data.stops.length) keyValueRow('Planned stops', data.stops.join(', '));

    // ── AI insights ──
    if (data.aiSummary || (data.aiInsights && data.aiInsights.length)) {
        sectionTitle('Wayvue AI Insights');
        if (data.aiSummary) bodyLine(data.aiSummary);
        (data.aiInsights || []).forEach(ins => {
            ensure(16);
            doc.setFillColor(...AMBER);
            doc.circle(M + 3, y - 3, 1.6, 'F');
            bodyLine(ins, { indent: 14 });
            y += 2;
        });
    }

    // ── Weather ──
    if (data.weather && data.weather.length) {
        sectionTitle('Weather Along The Route');
        data.weather.forEach(w => {
            keyValueRow(w.location, `${w.temp}°${w.unit}${w.condition ? ` · ${w.condition}` : ''}`);
        });
    }

    // ── Stops ──
    if (data.stopsList && data.stopsList.length) {
        sectionTitle('Suggested Stops');
        data.stopsList.forEach(s => {
            bodyLine(`• ${s.title}${s.detail ? ` - ${s.detail}` : ''}`);
        });
    }

    // ── Road alerts ──
    if (data.roadAlerts && data.roadAlerts.length) {
        sectionTitle('Road Alerts');
        data.roadAlerts.forEach(a => {
            bodyLine(`• ${a.label}${a.detail ? ` - ${a.detail}` : ''}`);
        });
    }

    // ── Stays & rentals ──
    if ((data.hotels && data.hotels.length) || (data.rentals && data.rentals.length)) {
        sectionTitle('Stays & Rentals');
        (data.hotels || []).forEach(h => bodyLine(`Hotel - ${h.name}${h.detail ? ` (${h.detail})` : ''}`));
        (data.rentals || []).forEach(r => bodyLine(`Rental - ${r.name}${r.detail ? ` (${r.detail})` : ''}`));
    }

    // ── Footer on every page ──
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        doc.text(`Generated by Wayvue · ${generated}`, M, pageH - 24);
        doc.text(`${p} / ${pages}`, pageW - M, pageH - 24, { align: 'right' });
    }

    const safe = (s: string) => s.split(',')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    doc.save(`wayvue-${safe(data.start)}-to-${safe(data.destination)}.pdf`);
}
