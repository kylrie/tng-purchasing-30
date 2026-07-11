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
// Source: owner-provided folder "TFR MENU IMAGES" (FOOD/, DRINK/BOTTLES/, Games,
// CLASSIC DRINKS/), matched to existing snapshot items by label. Food + cocktail
// photos resized to ~800px on the long edge;
// bottle product shots padded to 600x600 square (owner standard); the clear
// water bottle is likewise squared so it is visible; the Coke cans are kept as
// their original webp. Bottle + shot records of the same product share one image.

export const FUN_ROOF_MENU_IMAGES: Readonly<Record<string, string>> = {
    // ── Food (Bestsellers / Pizza / Bar Chows) — owner FOOD/ photos ──
    fr000: '/funroof/menu/pork-sisig.jpg',                 // PORK SISIG
    fr001: '/funroof/menu/tfr-smashed-sliders.jpg',        // TFR SMASHED SLIDERS
    fr002: '/funroof/menu/sinuglaw-cheese-taco.jpg',       // SINUGLAW CHEESE TACO
    fr003: '/funroof/menu/pepperoni.jpg',                  // PEPPERONI
    fr004: '/funroof/menu/prosciutto-arugula.jpg',         // PROSCIUTTO & ARUGULA
    fr005: '/funroof/menu/four-cheese.jpg',                // FOUR CHEESE
    fr007: '/funroof/menu/not-calamari.jpg',               // NOT CALAMARI
    fr008: '/funroof/menu/wagyu-onigiri.jpg',              // WAGYU ONIGIRI
    fr009: '/funroof/menu/kaldereta-birria-cheese-taco.jpg', // KALDERETA BIRRIA CHEESE TACO
    fr010: '/funroof/menu/lechon-belly.jpg',               // LECHON BELLY
    fr011: '/funroof/menu/chicken-tenders.jpg',            // CHICKEN TENDERS
    fr012: '/funroof/menu/shrimp-spam-croquettes.jpg',     // SHRIMP & SPAM CROQUETTES
    fr013: '/funroof/menu/truffled-shrimp-popcorn.jpg',    // TRUFFLED SHRIMP POPCORN
    fr014: '/funroof/menu/tfr-fries.jpg',                  // TFR FRIES

    // ── Classics (cocktails) — owner CLASSIC DRINKS/ photos ──
    fr114: '/funroof/menu/amaretto-sour.jpg',              // AMARETTO SOUR
    fr116: '/funroof/menu/classic-margarita.jpg',          // CLASSIC MARGARITA
    fr119: '/funroof/menu/long-island-iced-tea.jpg',       // LONG ISLAND ICED TEA
    fr122: '/funroof/menu/pina-colada.jpg',                // PINA COLADA
    fr124: '/funroof/menu/white-russian.jpg',              // WHITE RUSSIAN

    // ── Whiskey (bottle + shot share one image) ──
    fr020: '/funroof/menu/jw-blue.jpg',                    // JOHNNIE WALKER BLUE LABEL
    fr021: '/funroof/menu/jw-blue.jpg',
    fr024: '/funroof/menu/jw-black.jpg',                   // JOHNNIE WALKER BLACK LABEL
    fr025: '/funroof/menu/jw-black.jpg',
    fr030: '/funroof/menu/jameson.jpg',                    // JAMESON IRISH WHISKEY
    fr031: '/funroof/menu/jameson.jpg',
    fr032: '/funroof/menu/jameson-black-barrel.jpg',       // JAMESON BLACK BARREL
    fr033: '/funroof/menu/jameson-black-barrel.jpg',
    fr038: '/funroof/menu/charles-and-james.jpg',          // CHARLES AND JAMES
    fr039: '/funroof/menu/charles-and-james.jpg',

    // ── Vodka ──
    fr040: '/funroof/menu/absolut-blue.jpg',               // ABSOLUT BLUE
    fr041: '/funroof/menu/absolut-blue.jpg',
    fr042: '/funroof/menu/grey-goose.jpg',                 // GREYGOOSE
    fr043: '/funroof/menu/grey-goose.jpg',
    fr044: '/funroof/menu/belvedere.jpg',                  // BELVEDERE
    fr045: '/funroof/menu/belvedere.jpg',

    // ── Tequila / Mezcal ──
    fr046: '/funroof/menu/jose-cuervo-reposado.jpg',       // JOSE CUERVO ESPECIAL REPOSADO
    fr047: '/funroof/menu/jose-cuervo-reposado.jpg',
    fr058: '/funroof/menu/olmeca.jpg',                     // OLMECA
    fr059: '/funroof/menu/olmeca.jpg',
    fr060: '/funroof/menu/cazadores.jpg',                  // CAZADORES
    fr061: '/funroof/menu/cazadores.jpg',

    // ── Rum ──
    fr062: '/funroof/menu/bacardi-gold.jpg',               // BACARDI GOLD
    fr063: '/funroof/menu/bacardi-gold.jpg',
    fr064: '/funroof/menu/bacardi-white.jpg',              // BACARDI WHITE (Superior)
    fr065: '/funroof/menu/bacardi-white.jpg',
    fr068: '/funroof/menu/captain-morgan.jpg',             // CAPTAIN MORGAN SPICE
    fr069: '/funroof/menu/captain-morgan.jpg',

    // ── Gin ──
    fr074: '/funroof/menu/tanqueray.jpg',                  // TANQUERAY DRY
    fr075: '/funroof/menu/tanqueray.jpg',
    fr080: '/funroof/menu/beefeater.jpg',                  // BEEFEATER
    fr081: '/funroof/menu/beefeater.jpg',

    // ── Ice Cold / Liqueur ──
    fr082: '/funroof/menu/jagermeister.jpg',               // JAGERMEISTER (bottle)
    fr083: '/funroof/menu/jagermeister.jpg',               // JAGERMEISTER (shot)
    fr093: '/funroof/menu/baileys.jpg',                    // BAILEYS
    fr094: '/funroof/menu/baileys.jpg',

    // ── Non-Alcoholic ──
    fr095: '/funroof/menu/nature-spring.jpg',              // BOTTLED WATER (Nature Spring — padded square so the clear bottle is visible)
    fr097: '/funroof/menu/coke-regular.webp',             // COKE REGULAR IN CAN (owner original)
    fr098: '/funroof/menu/coke-zero.webp',                // COKE ZERO IN CAN (owner original)

    // ── Beers ──
    fr106: '/funroof/menu/heineken.jpg',                   // HEINEKEN ORIGINAL
    fr112: '/funroof/menu/tiger-crystal.jpg',              // TIGER CRYSTAL

    // ── Drink (signature) that exists in the snapshot ──
    fr105: '/funroof/menu/little-miss-sunshine.jpg',       // LITTLE MISS SUNSHINE

    // ── Play photos → the 3 Package items (one each, per owner) ──
    fr126: '/funroof/menu/unli-play-all-night.jpg',        // UNLI PLAY ALL NIGHT
    fr127: '/funroof/menu/unli-slushie-and-play.jpg',      // UNLI SLUSHIE AND PLAY
    fr128: '/funroof/menu/unli-slushie-shots.jpg',         // UNLI SLUSHIE SHOTS
};

/** Return the local image asset for a snapshot item id, or undefined. */
export function funRoofImageFor(id: string): string | undefined {
    return FUN_ROOF_MENU_IMAGES[id];
}
