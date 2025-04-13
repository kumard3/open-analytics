var currentScript = document.currentScript;

// Send event to the collector
// event: string - The event type
// data: object - The event data
// trackingId: string - The unique tracking ID for the website
async function sendEvent(event, data, trackingId) {
    // Ensure APP_URL is injected correctly by your bundler or replace it with a direct URL.
    let collectorUrl = process.env.APP_URL + "/analytics";
    let url = new URL(location.href);
    let payload = {
        u: url.toString(), // current URL
        id: trackingId,    // tracking ID from the script tag
        e: { t: event, p: data }, // event type and payload
    };

    // Try to send via navigator.sendBeacon; fallback to fetch if unavailable or failing
    if (
        !(
            navigator.sendBeacon !== undefined &&
            navigator.sendBeacon(collectorUrl, JSON.stringify(payload))
        )
    ) {
        fetch(collectorUrl, {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            method: "POST",
        }).catch((error) => console.error(`fetch() failed: ${error.message}`));
    }
}

// Handles pageview events
function handlePageView() {
    let url = new URL(location.href);
    let referrer = document.referrer;
    sendEvent("pageview", { u: url.toString(), r: referrer });
}

// Handles hash change events (client-side route changes)
function handleHashChange() {
    let url = new URL(location.href);
    let referrer = document.referrer;
    sendEvent("hashchange", { u: url.toString(), r: referrer });
}

function main() {
    const script = document.currentScript;
    const trackingId = new URL(script.src).searchParams.get('id');
    if (!trackingId) return;
    console.log(trackingId, "trackingId");

    // Send initial pageview event
    const payload = {
        url: location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
    };
    sendEvent("pageview", payload, trackingId);

    // Listen for hash changes for single-page app navigation
    window.addEventListener("hashchange", handleHashChange);
}

main();
