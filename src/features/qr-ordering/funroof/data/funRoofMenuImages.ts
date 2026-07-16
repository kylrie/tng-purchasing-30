// The Fun Roof (b1) — menu item → local image asset map.
//
// Kept SEPARATE from funRoofMenu.snapshot.ts (which is generated/read-only) so
// images can be attached without hand-editing the generated menu. The mapper
// (funRoofMenu.ts) looks each id up here and, when present, sets item.imageUrl.
// Items with no entry keep the existing category fallback tile in the view.
//
// Assets live in /public/funroof/menu (served at /funroof/menu/*). They are
// project-owned static files — NEVER hotlink the owner's OneDrive, Google Drive,
// or any remote host from production. Scope is b1 only; nothing here touches
// b3/Inflatable.
//
// Sources: (a) owner-provided folder "TFR MENU IMAGES" (FOOD/, DRINK/BOTTLES/,
// CLASSIC DRINKS/), and (b) 2026-07-16: the per-row Google Drive image links in
// the owner's APPROVED FINAL MENU sheet, downloaded + processed locally (photos
// ~800px long edge JPEG q85; product renders padded to 600x600 on white).
// Bottle + shot records of the same product share one image.

export const FUN_ROOF_MENU_IMAGES: Readonly<Record<string, string>> = {
    // ── Food — owner FOOD/ photos (kept) + sheet images ──
    fr000: '/funroof/menu/pork-sisig.jpg',                 // PORK SISIG
    fr001: '/funroof/menu/tfr-smashed-sliders.jpg',        // TFR SMASHED SLIDERS
    fr003: '/funroof/menu/pepperoni.jpg',                  // PEPPERONI PIZZA
    fr004: '/funroof/menu/prosciutto-arugula.jpg',         // PROSCIUTTO & ARUGULA PIZZA
    fr005: '/funroof/menu/four-cheese.jpg',                // FOUR CHEESE PIZZA
    fr007: '/funroof/menu/not-calamari.jpg',               // NOT CALAMARI
    fr011: '/funroof/menu/chicken-tenders.jpg',            // CHICKEN TENDERS (BUFFALO)
    fr148: '/funroof/menu/chicken-tenders.jpg',            // CHICKEN TENDERS (SPICE RUB) — same sheet photo
    fr014: '/funroof/menu/tfr-fries.jpg',                  // TFR FRIES
    fr017: '/funroof/menu/steamed-rice.jpg',               // STEAMED RICE (sheet)

    // ── Classics (cocktails) — owner CLASSIC DRINKS/ photos (kept) + sheet images ──
    fr114: '/funroof/menu/amaretto-sour.jpg',              // AMARETTO SOUR
    fr115: '/funroof/menu/cosmopolitan.jpg',               // COSMOPOLITAN (sheet)
    fr116: '/funroof/menu/classic-margarita.jpg',          // CLASSIC MARGARITA
    fr117: '/funroof/menu/classic-whisky-sour.jpg',        // CLASSIC WHISKY SOUR (sheet)
    fr118: '/funroof/menu/gin-and-tonic.jpg',              // GIN AND TONIC (sheet)
    fr119: '/funroof/menu/long-island-iced-tea.jpg',       // LONG ISLAND ICED TEA
    fr120: '/funroof/menu/negroni.jpg',                    // NEGRONI (sheet)
    fr121: '/funroof/menu/old-fashioned.jpg',              // OLD FASHIONED (sheet)
    fr122: '/funroof/menu/pina-colada.jpg',                // PINA COLADA
    fr123: '/funroof/menu/rhum-and-coke.jpg',              // RHUM AND COKE (sheet)
    fr124: '/funroof/menu/white-russian.jpg',              // WHITE RUSSIAN
    fr125: '/funroof/menu/whisky-highball.jpg',            // WHISKY HIGHBALL (sheet)
    fr141: '/funroof/menu/pink-guava-margarita.jpg',       // PINK GUAVA MARGARITA (sheet)
    fr142: '/funroof/menu/mojodojo-mojito.jpg',            // MOJODOJO MOJITO (sheet)
    fr143: '/funroof/menu/pink-af.jpg',                    // PINK AF (sheet)
    fr144: '/funroof/menu/the-tipsy-ube.jpg',              // THE TIPSY UBE (sheet)
    fr145: '/funroof/menu/coco-amaretto-sour.jpg',         // COCO AMARETTO SOUR (sheet)
    fr146: '/funroof/menu/sula-negroni.jpg',               // SULA NEGRONI (sheet)

    // ── Whiskey (bottle + shot share one image) ──
    fr024: '/funroof/menu/jw-black.jpg',                   // JOHNNIE WALKER BLACK LABEL
    fr025: '/funroof/menu/jw-black.jpg',
    fr030: '/funroof/menu/jameson.jpg',                    // JOHN JAMESON
    fr031: '/funroof/menu/jameson.jpg',
    fr034: '/funroof/menu/jack-daniels.jpg',               // JACK DANIELS (sheet)
    fr035: '/funroof/menu/jack-daniels.jpg',
    fr038: '/funroof/menu/charles-and-james.jpg',          // CHARLES AND JAMES
    fr039: '/funroof/menu/charles-and-james.jpg',

    // ── Vodka ──
    fr040: '/funroof/menu/absolut-blue.jpg',               // ABSOLUT BLUE
    fr041: '/funroof/menu/absolut-blue.jpg',
    fr044: '/funroof/menu/belvedere.jpg',                  // BELVEDERE
    fr045: '/funroof/menu/belvedere.jpg',

    // ── Tequila / Mezcal ──
    fr046: '/funroof/menu/jose-cuervo-reposado.jpg',       // JOSE CUERVO REPOSADO
    fr047: '/funroof/menu/jose-cuervo-reposado.jpg',
    fr054: '/funroof/menu/patron-silver.jpg',              // PATRON SILVER (sheet)
    fr055: '/funroof/menu/patron-silver.jpg',
    fr056: '/funroof/menu/patron-anejo.jpg',               // PATRON ANEJO (sheet)
    fr057: '/funroof/menu/patron-anejo.jpg',
    fr058: '/funroof/menu/olmeca.jpg',                     // OLMECA
    fr059: '/funroof/menu/olmeca.jpg',
    fr060: '/funroof/menu/cazadores.jpg',                  // CAZADORES
    fr061: '/funroof/menu/cazadores.jpg',
    fr147: '/funroof/menu/fresh-lemon.jpg',                // FRESH LEMON (sheet)

    // ── Rum ──
    fr062: '/funroof/menu/bacardi-gold.jpg',               // BACARDI GOLD
    fr063: '/funroof/menu/bacardi-gold.jpg',
    fr064: '/funroof/menu/bacardi-white.jpg',              // BACARDI WHITE (Superior)
    fr065: '/funroof/menu/bacardi-white.jpg',

    // ── Gin ──
    fr074: '/funroof/menu/tanqueray.jpg',                  // TANQUERAY DRY
    fr075: '/funroof/menu/tanqueray.jpg',
    fr080: '/funroof/menu/beefeater.jpg',                  // BEEFEATER LONDON DRY GIN
    fr081: '/funroof/menu/beefeater.jpg',

    // ── Ice Cold / Liqueur / Brandy & Cognac ──
    fr082: '/funroof/menu/jagermeister.jpg',               // JAGERMEISTER (bottle)
    fr083: '/funroof/menu/jagermeister.jpg',               // JAGERMEISTER (shot)
    fr093: '/funroof/menu/baileys.jpg',                    // BAILEYS
    fr094: '/funroof/menu/baileys.jpg',
    fr139: '/funroof/menu/hennessy.jpg',                   // HENNESSY (sheet; shot)
    fr140: '/funroof/menu/hennessy.jpg',                   // HENNESSY (bottle)

    // ── Non-Alcoholic ──
    fr095: '/funroof/menu/nature-spring.jpg',              // BOTTLED WATER (Nature Spring — padded square so the clear bottle is visible)
    fr096: '/funroof/menu/coke-pitcher.jpg',               // COKE PITCHER (sheet)
    fr097: '/funroof/menu/coke-regular.webp',             // COKE REGULAR IN CAN (owner original)
    fr098: '/funroof/menu/coke-zero.webp',                // COKE ZERO IN CAN (owner original)
    fr099: '/funroof/menu/sprite-pitcher.jpg',             // SPRITE PITCHER (sheet)
    fr100: '/funroof/menu/sprite-can.jpg',                 // SPRITE IN CAN (sheet)
    fr101: '/funroof/menu/red-bull.jpg',                   // RED BULL IN CAN (sheet)
    fr102: '/funroof/menu/fr-iced-tea.jpg',                // FR ICED TEA (sheet)
    fr103: '/funroof/menu/schweppes-soda-water.jpg',       // SCHWEPPES SODA WATER (sheet)
    fr104: '/funroof/menu/schweppes-tonic-water.jpg',      // SCHWEPPES TONIC WATER (sheet)
    fr105: '/funroof/menu/little-miss-sunshine.jpg',       // LITTLE MISS SUNSHINE

    // ── Beers ──
    fr106: '/funroof/menu/heineken.jpg',                   // HEINEKEN ORIGINAL
    fr107: '/funroof/menu/san-mig-apple.jpg',              // SAN MIG APPLE (sheet)
    fr110: '/funroof/menu/san-mig-super-dry.jpg',          // SAN MIG SUPER DRY (sheet)
    fr112: '/funroof/menu/tiger-crystal.jpg',              // TIGER CRYSTAL LIGHT
    fr136: '/funroof/menu/draft-beer.jpg',                 // DRAFT BEER - SAN MIG PALE (sheet; shared)
    fr137: '/funroof/menu/draft-beer.jpg',                 // DRAFT BEER - SAN MIG LIGHT (sheet; shared)
    fr138: '/funroof/menu/smirnoff.jpg',                   // SMIRNOFF (sheet)

    // ── Play photos → the 3 Package items (one each, per owner) ──
    fr126: '/funroof/menu/unli-play-all-night.jpg',        // UNLI PLAY ALL NIGHT
    fr127: '/funroof/menu/unli-slushie-and-play.jpg',      // UNLI SLUSHIE AND PLAY
    fr128: '/funroof/menu/unli-slushie-shots.jpg',         // UNLI SLUSHIE SHOTS
};

/** Return the local image asset for a snapshot item id, or undefined. */
export function funRoofImageFor(id: string): string | undefined {
    return FUN_ROOF_MENU_IMAGES[id];
}
