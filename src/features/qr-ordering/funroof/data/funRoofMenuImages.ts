// The Fun Roof (b1) — menu item → local image asset map.
//
// Kept SEPARATE from funRoofMenu.snapshot.ts (which is generated/read-only) so
// images can be attached without hand-editing the generated menu. The mapper
// (funRoofMenu.ts) looks each id up here and, when present, sets item.imageUrl.
// Items with no entry keep the existing category fallback tile in the view.
//
// Assets live in /public/funroof/menu (served at /funroof/menu/*). They are
// project-owned static files — NEVER hotlink the owner's OneDrive or a remote
// host from production. Scope is b1 only; nothing here touches b3/Inflatable.
//
// Sources:
//  - Owner-provided folder "TFR MENU IMAGES" (Drinks/Food/Games), matched to
//    existing snapshot items by label. Optimized to ~1000px JPEG for mobile.
//  - Branded alcohol product shots sourced from official/reputable pages (see
//    funRoofImageSources for the per-asset provenance record) and stored locally.

export const FUN_ROOF_MENU_IMAGES: Readonly<Record<string, string>> = {
    // ── Owner-provided food/drink photos (exact existing-item matches) ──
    fr000: '/funroof/menu/pork-sisig.jpg',            // PORK SISIG
    fr001: '/funroof/menu/tfr-smashed-sliders.jpg',   // TFR SMASHED SLIDERS
    fr002: '/funroof/menu/sinuglaw-cheese-taco.jpg',  // SINUGLAW CHEESE TACO
    fr004: '/funroof/menu/prosciutto-arugula.jpg',    // PROSCIUTTO & ARUGULA
    fr005: '/funroof/menu/four-cheese.jpg',           // FOUR CHEESE
    fr008: '/funroof/menu/wagyu-onigiri.jpg',         // WAGYU ONIGIRI
    fr011: '/funroof/menu/chicken-tenders.jpg',       // CHICKEN TENDERS
    fr012: '/funroof/menu/shrimp-spam-croquettes.jpg',// SHRIMP & SPAM CROQUETTES
    fr105: '/funroof/menu/little-miss-sunshine.jpg',  // LITTLE MISS SUNSHINE

    // ── Owner-provided Play photos → the 3 Package items (one each, per owner) ──
    fr126: '/funroof/menu/unli-play-all-night.jpg',   // UNLI PLAY ALL NIGHT (neon mini-golf)
    fr127: '/funroof/menu/unli-slushie-and-play.jpg', // UNLI SLUSHIE AND PLAY (batting cage)
    fr128: '/funroof/menu/unli-slushie-shots.jpg',    // UNLI SLUSHIE SHOTS (MAD LANES)
};

/** Return the local image asset for a snapshot item id, or undefined. */
export function funRoofImageFor(id: string): string | undefined {
    return FUN_ROOF_MENU_IMAGES[id];
}
