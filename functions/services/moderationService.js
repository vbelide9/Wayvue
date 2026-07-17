// Image moderation (NSFW screening) — PLACEHOLDER / pluggable seam.
//
// Purpose: screen user-uploaded post photos for explicit content before they go live in the
// community feed. The client calls POST /api/moderate/image with { url } right after upload;
// if this returns { ok: false }, the client removes the image and blocks the post.
//
// Status: no-op unless a provider is configured. Real NSFW detection needs an ML service —
// there's no reliable client-side or keyless option. Set MODERATION_PROVIDER + its key to
// activate. Until then this returns { ok: true, configured: false } and the ACTIVE protection
// is the existing report → auto-hide trigger (schema §11f) plus author delete.
//
// To wire a provider, implement screen() below. Common options:
//   • AWS Rekognition  DetectModerationLabels        (AWS_* creds, MODERATION_PROVIDER=rekognition)
//   • Google Cloud Vision  SafeSearch                 (GOOGLE_* creds, =vision)
//   • Hive / Sightengine / Moderation API (HTTP)      (<PROVIDER>_API_KEY, =sightengine|hive)
// Each takes the image URL (or bytes), returns category scores; flag when adult/violence/gore
// crosses your threshold. Keep it fail-open (return ok:true on provider error) so an outage
// doesn't block all posting — or fail-closed if you'd rather be strict.

const MODERATION_PROVIDER = process.env.MODERATION_PROVIDER || null;

const hasModerationProvider = Boolean(MODERATION_PROVIDER);

/**
 * Screen an image URL for disallowed content.
 * @param {{ url?: string }} params
 * @returns {Promise<{ ok: boolean, configured: boolean, reason?: string }>}
 */
async function screen({ url } = {}) {
    if (!hasModerationProvider) {
        return { ok: true, configured: false };
    }
    if (!url) {
        return { ok: true, configured: true };
    }
    // TODO: call MODERATION_PROVIDER here and translate its category scores into ok/reason.
    // e.g. Sightengine:
    //   const r = await fetch(`https://api.sightengine.com/1.0/check.json?models=nudity-2.0&url=${...}&api_user=${...}&api_secret=${...}`);
    //   const j = await r.json();
    //   if (j.nudity?.sexual_activity > 0.6 || j.nudity?.sexual_display > 0.6)
    //     return { ok: false, configured: true, reason: 'This image was flagged as explicit and can’t be posted.' };
    return { ok: true, configured: true };
}

module.exports = { screen, hasModerationProvider };
