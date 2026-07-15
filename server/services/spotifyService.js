// Spotify catalog search for the collaborative trip playlist.
//
// Uses the Client Credentials flow (an APP-level token — no user login), so members can
// search the catalog and build the trip playlist without connecting a Spotify account.
// The playlist itself lives in Wayvue (public.trip_tracks); Spotify only supplies the song
// metadata + "Open in Spotify" links.
//
// Degrades cleanly: with no SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET it returns
// { configured:false, tracks:[] } and the UI shows an "unconfigured" state — the rest of
// the app is unaffected (same pattern as viatorService).
//
// Note: Spotify's `preview_url` is null for many tracks (Spotify restricted it for newer
// apps in late 2024), so the client treats the 30s preview as best-effort and relies on the
// "Open in Spotify" external link as the primary play path.
const axios = require('axios');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || null;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || null;
const hasSpotifyCredentials = Boolean(CLIENT_ID && CLIENT_SECRET);

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 5000) return cachedToken;
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const resp = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }, timeout: 10000 },
    );
    cachedToken = resp.data.access_token;
    tokenExpiresAt = now + (resp.data.expires_in || 3600) * 1000;
    return cachedToken;
}

function mapTrack(t) {
    const images = t.album && Array.isArray(t.album.images) ? t.album.images : [];
    return {
        spotifyId: t.id,
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map(a => a.name).join(', '),
        album: (t.album && t.album.name) || '',
        imageUrl: (images[1] && images[1].url) || (images[0] && images[0].url) || null,
        previewUrl: t.preview_url || null,
        externalUrl: (t.external_urls && t.external_urls.spotify) || null,
        durationMs: t.duration_ms || 0,
    };
}

/**
 * Search the Spotify catalog for tracks.
 * @returns {Promise<{ configured: boolean, tracks: Array }>}
 */
async function searchTracks(query) {
    if (!hasSpotifyCredentials) return { configured: false, tracks: [] };
    const q = (query || '').trim();
    if (!q) return { configured: true, tracks: [] };
    try {
        const token = await getAppToken();
        const resp = await axios.get('https://api.spotify.com/v1/search', {
            params: { q, type: 'track', limit: 20 },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
        });
        const items = (resp.data && resp.data.tracks && resp.data.tracks.items) || [];
        return { configured: true, tracks: items.filter(t => t && t.id).map(mapTrack) };
    } catch (e) {
        console.error('[spotify] search failed:', (e.response && e.response.data) || e.message);
        return { configured: true, tracks: [] };
    }
}

module.exports = { searchTracks, hasSpotifyCredentials };
