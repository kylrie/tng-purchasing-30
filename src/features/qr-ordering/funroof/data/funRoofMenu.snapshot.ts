// The Fun Roof (business unit b1 · "THE FUN GUYS CORP.") — PUBLIC MENU SNAPSHOT
//
// GENERATED, READ-ONLY. Do not hand-edit. Source of truth = the owner's APPROVED
// FINAL MENU Google Sheet (id 1395Cm2XGiXDgIgjuaYPkrcZZUf_tHee2GYc_5kjAPDs),
// tabs "TFR BAR" (gid 777072053) + "TFR FOOD". Prices are the sheet's
// "MENU SRP (INCLUSIVE OF VAT AND SC)" column — what the customer pays, VAT and
// 10% service charge included. Play (Packages/Games) items are carried over
// unchanged from the previous curated menu (kept per owner decision — they appear
// in no sheet tab). fr### ids are stable across regens for the same product;
// new sheet items get new ids (fr136+).
//
// Regenerate: export the two tabs as CSV and re-run the gen-snapshot script
// (see git history of this file). No backend writes, no POS coupling.
// Snapshot taken: 2026-07-16. Items: 93.
// Categories (in menu order): {"The Fun Roof Bestsellers":2,"Pizza":3,"Bar Chows":4,"Add Ons":1,"Whiskey":8,"Vodka":4,"Tequila/Mescal":11,"Rum":4,"Gin":4,"Ice Cold":2,"Liqueur":2,"Brandy & Cognac":2,"Non-Alcoholic":11,"Beers":7,"Classics":18,"Packages":3,"Games":7}

export interface FunRoofMenuRecord {
    id: string;
    /** Raw menu section from the sheet (mapped to nav sub-tabs by funRoofMenu.ts). */
    category: string;
    name: string;
    sellingPrice: number;
    description?: string;
    /** Serving/size qualifier, e.g. "Bottle", "Shot", "Per pax", "440ml cup". */
    serving?: string;
    /** Menu tag, e.g. "Bestseller", "Chef's Reco", "Best Deal". */
    tag?: string;
}

/** The complete Fun Roof menu, exactly as approved by the owner (read-only). */
export const FUN_ROOF_MENU_SNAPSHOT: FunRoofMenuRecord[] = [
    {
        "id": "fr000",
        "category": "The Fun Roof Bestsellers",
        "name": "PORK SISIG",
        "sellingPrice": 500,
        "description": "Grilled, crispy pork with a spicy, tangy kick served sizzling hot with an egg on top for that perfect bite!",
        "tag": "Bestseller"
    },
    {
        "id": "fr001",
        "category": "The Fun Roof Bestsellers",
        "name": "TFR SMASHED SLIDERS",
        "sellingPrice": 650,
        "description": "Smashed beef patty, cheddar, smoked BBQ mayo, caramelized onion, jack cheese sauce, crispy chips.",
        "tag": "Bestseller"
    },
    {
        "id": "fr003",
        "category": "Pizza",
        "name": "PEPPERONI PIZZA",
        "sellingPrice": 650,
        "description": "Mozzarella, tomato concasse, pepperoni and burrata."
    },
    {
        "id": "fr004",
        "category": "Pizza",
        "name": "PROSCIUTTO & ARUGULA PIZZA",
        "sellingPrice": 750,
        "description": "Fresh flour dough, concasse, mozzarella, prosciutto crudo, arugula & burrata."
    },
    {
        "id": "fr005",
        "category": "Pizza",
        "name": "FOUR CHEESE PIZZA",
        "sellingPrice": 650,
        "description": "Mozzarella, feta, blue cheese and parmesan with parsley as garnish."
    },
    {
        "id": "fr007",
        "category": "Bar Chows",
        "name": "NOT CALAMARI",
        "sellingPrice": 380,
        "description": "Deep fried crispy enoki mushroom with special sauce.",
        "tag": "Chef's Reco"
    },
    {
        "id": "fr011",
        "category": "Bar Chows",
        "name": "CHICKEN TENDERS (BUFFALO)",
        "sellingPrice": 380
    },
    {
        "id": "fr148",
        "category": "Bar Chows",
        "name": "CHICKEN TENDERS (SPICE RUB)",
        "sellingPrice": 380
    },
    {
        "id": "fr014",
        "category": "Bar Chows",
        "name": "TFR FRIES",
        "sellingPrice": 300,
        "description": "Shoestring potatoes and cajun."
    },
    {
        "id": "fr017",
        "category": "Add Ons",
        "name": "STEAMED RICE",
        "sellingPrice": 130
    },
    {
        "id": "fr024",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLACK LABEL",
        "sellingPrice": 4400,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr025",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLACK LABEL",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr030",
        "category": "Whiskey",
        "name": "JOHN JAMESON",
        "sellingPrice": 3300,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr031",
        "category": "Whiskey",
        "name": "JOHN JAMESON",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr034",
        "category": "Whiskey",
        "name": "JACK DANIELS",
        "sellingPrice": 4400,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr035",
        "category": "Whiskey",
        "name": "JACK DANIELS",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr038",
        "category": "Whiskey",
        "name": "CHARLES AND JAMES",
        "sellingPrice": 2200,
        "serving": "Bottle (1L)"
    },
    {
        "id": "fr039",
        "category": "Whiskey",
        "name": "CHARLES AND JAMES",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr040",
        "category": "Vodka",
        "name": "ABSOLUT BLUE",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr041",
        "category": "Vodka",
        "name": "ABSOLUT BLUE",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr044",
        "category": "Vodka",
        "name": "BELVEDERE",
        "sellingPrice": 6000,
        "serving": "Bottle"
    },
    {
        "id": "fr045",
        "category": "Vodka",
        "name": "BELVEDERE",
        "sellingPrice": 650,
        "serving": "Shot"
    },
    {
        "id": "fr046",
        "category": "Tequila/Mescal",
        "name": "JOSE CUERVO REPOSADO",
        "sellingPrice": 3400,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr047",
        "category": "Tequila/Mescal",
        "name": "JOSE CUERVO REPOSADO",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr054",
        "category": "Tequila/Mescal",
        "name": "PATRON SILVER",
        "sellingPrice": 9000,
        "serving": "Bottle (750ml)"
    },
    {
        "id": "fr055",
        "category": "Tequila/Mescal",
        "name": "PATRON SILVER",
        "sellingPrice": 600,
        "serving": "Shot"
    },
    {
        "id": "fr056",
        "category": "Tequila/Mescal",
        "name": "PATRON ANEJO",
        "sellingPrice": 11000,
        "serving": "Bottle"
    },
    {
        "id": "fr057",
        "category": "Tequila/Mescal",
        "name": "PATRON ANEJO",
        "sellingPrice": 750,
        "serving": "Shot"
    },
    {
        "id": "fr058",
        "category": "Tequila/Mescal",
        "name": "OLMECA",
        "sellingPrice": 4000,
        "serving": "Bottle"
    },
    {
        "id": "fr059",
        "category": "Tequila/Mescal",
        "name": "OLMECA",
        "sellingPrice": 400,
        "serving": "Shot"
    },
    {
        "id": "fr060",
        "category": "Tequila/Mescal",
        "name": "CAZADORES",
        "sellingPrice": 5500,
        "serving": "Bottle (750ml)"
    },
    {
        "id": "fr061",
        "category": "Tequila/Mescal",
        "name": "CAZADORES",
        "sellingPrice": 400,
        "serving": "Shot"
    },
    {
        "id": "fr147",
        "category": "Tequila/Mescal",
        "name": "FRESH LEMON",
        "sellingPrice": 50
    },
    {
        "id": "fr062",
        "category": "Rum",
        "name": "BACARDI GOLD",
        "sellingPrice": 3300,
        "serving": "Bottle (750ml)"
    },
    {
        "id": "fr063",
        "category": "Rum",
        "name": "BACARDI GOLD",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr064",
        "category": "Rum",
        "name": "BACARDI WHITE",
        "sellingPrice": 3300,
        "serving": "Bottle"
    },
    {
        "id": "fr065",
        "category": "Rum",
        "name": "BACARDI WHITE",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr074",
        "category": "Gin",
        "name": "TANQUERAY DRY",
        "sellingPrice": 4400,
        "serving": "Bottle (750ml)"
    },
    {
        "id": "fr075",
        "category": "Gin",
        "name": "TANQUERAY DRY",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr080",
        "category": "Gin",
        "name": "BEEFEATER LONDON DRY GIN",
        "sellingPrice": 3300,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr081",
        "category": "Gin",
        "name": "BEEFEATER LONDON DRY GIN",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr082",
        "category": "Ice Cold",
        "name": "JAGERMEISTER",
        "sellingPrice": 3400,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr083",
        "category": "Ice Cold",
        "name": "JAGERMEISTER",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr093",
        "category": "Liqueur",
        "name": "BAILEYS",
        "sellingPrice": 3300,
        "serving": "Bottle (700ml)"
    },
    {
        "id": "fr094",
        "category": "Liqueur",
        "name": "BAILEYS",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr140",
        "category": "Brandy & Cognac",
        "name": "HENNESSY",
        "sellingPrice": 8000,
        "serving": "Bottle"
    },
    {
        "id": "fr139",
        "category": "Brandy & Cognac",
        "name": "HENNESSY",
        "sellingPrice": 600,
        "serving": "Shot"
    },
    {
        "id": "fr095",
        "category": "Non-Alcoholic",
        "name": "BOTTLED WATER",
        "sellingPrice": 100
    },
    {
        "id": "fr096",
        "category": "Non-Alcoholic",
        "name": "COKE PITCHER",
        "sellingPrice": 350
    },
    {
        "id": "fr097",
        "category": "Non-Alcoholic",
        "name": "COKE REGULAR IN CAN",
        "sellingPrice": 130
    },
    {
        "id": "fr098",
        "category": "Non-Alcoholic",
        "name": "COKE ZERO IN CAN",
        "sellingPrice": 130
    },
    {
        "id": "fr099",
        "category": "Non-Alcoholic",
        "name": "SPRITE PITCHER",
        "sellingPrice": 350
    },
    {
        "id": "fr100",
        "category": "Non-Alcoholic",
        "name": "SPRITE IN CAN",
        "sellingPrice": 130
    },
    {
        "id": "fr101",
        "category": "Non-Alcoholic",
        "name": "RED BULL IN CAN",
        "sellingPrice": 300
    },
    {
        "id": "fr102",
        "category": "Non-Alcoholic",
        "name": "FR ICED TEA",
        "sellingPrice": 300
    },
    {
        "id": "fr103",
        "category": "Non-Alcoholic",
        "name": "SCHWEPPES SODA WATER",
        "sellingPrice": 100
    },
    {
        "id": "fr104",
        "category": "Non-Alcoholic",
        "name": "SCHWEPPES TONIC WATER",
        "sellingPrice": 100
    },
    {
        "id": "fr105",
        "category": "Non-Alcoholic",
        "name": "LITTLE MISS SUNSHINE",
        "sellingPrice": 400
    },
    {
        "id": "fr106",
        "category": "Beers",
        "name": "HEINEKEN ORIGINAL",
        "sellingPrice": 250
    },
    {
        "id": "fr107",
        "category": "Beers",
        "name": "SAN MIG APPLE",
        "sellingPrice": 200
    },
    {
        "id": "fr110",
        "category": "Beers",
        "name": "SAN MIG SUPER DRY",
        "sellingPrice": 250
    },
    {
        "id": "fr112",
        "category": "Beers",
        "name": "TIGER CRYSTAL LIGHT",
        "sellingPrice": 200
    },
    {
        "id": "fr138",
        "category": "Beers",
        "name": "SMIRNOFF",
        "sellingPrice": 200
    },
    {
        "id": "fr136",
        "category": "Beers",
        "name": "DRAFT BEER - SAN MIG PALE",
        "sellingPrice": 200
    },
    {
        "id": "fr137",
        "category": "Beers",
        "name": "DRAFT BEER - SAN MIG LIGHT",
        "sellingPrice": 200
    },
    {
        "id": "fr114",
        "category": "Classics",
        "name": "AMARETTO SOUR",
        "sellingPrice": 400
    },
    {
        "id": "fr115",
        "category": "Classics",
        "name": "COSMOPOLITAN",
        "sellingPrice": 400
    },
    {
        "id": "fr116",
        "category": "Classics",
        "name": "CLASSIC MARGARITA",
        "sellingPrice": 400
    },
    {
        "id": "fr117",
        "category": "Classics",
        "name": "CLASSIC WHISKY SOUR",
        "sellingPrice": 400
    },
    {
        "id": "fr118",
        "category": "Classics",
        "name": "GIN AND TONIC",
        "sellingPrice": 350
    },
    {
        "id": "fr119",
        "category": "Classics",
        "name": "LONG ISLAND ICED TEA",
        "sellingPrice": 400
    },
    {
        "id": "fr120",
        "category": "Classics",
        "name": "NEGRONI",
        "sellingPrice": 400
    },
    {
        "id": "fr121",
        "category": "Classics",
        "name": "OLD FASHIONED",
        "sellingPrice": 400
    },
    {
        "id": "fr122",
        "category": "Classics",
        "name": "PINA COLADA",
        "sellingPrice": 400
    },
    {
        "id": "fr123",
        "category": "Classics",
        "name": "RHUM AND COKE",
        "sellingPrice": 350
    },
    {
        "id": "fr124",
        "category": "Classics",
        "name": "WHITE RUSSIAN",
        "sellingPrice": 400
    },
    {
        "id": "fr125",
        "category": "Classics",
        "name": "WHISKY HIGHBALL",
        "sellingPrice": 400
    },
    {
        "id": "fr141",
        "category": "Classics",
        "name": "PINK GUAVA MARGARITA",
        "sellingPrice": 400
    },
    {
        "id": "fr142",
        "category": "Classics",
        "name": "MOJODOJO MOJITO",
        "sellingPrice": 400
    },
    {
        "id": "fr143",
        "category": "Classics",
        "name": "PINK AF",
        "sellingPrice": 440
    },
    {
        "id": "fr144",
        "category": "Classics",
        "name": "THE TIPSY UBE",
        "sellingPrice": 440
    },
    {
        "id": "fr145",
        "category": "Classics",
        "name": "COCO AMARETTO SOUR",
        "sellingPrice": 440
    },
    {
        "id": "fr146",
        "category": "Classics",
        "name": "SULA NEGRONI",
        "sellingPrice": 440
    },
    {
        "id": "fr126",
        "category": "Packages",
        "name": "UNLI PLAY ALL NIGHT",
        "sellingPrice": 500,
        "description": "Except beer pong.",
        "tag": "Til you drop"
    },
    {
        "id": "fr127",
        "category": "Packages",
        "name": "UNLI SLUSHIE AND PLAY",
        "sellingPrice": 999,
        "description": "Except beer pong.",
        "tag": "Best Deal"
    },
    {
        "id": "fr128",
        "category": "Packages",
        "name": "UNLI SLUSHIE SHOTS",
        "sellingPrice": 650,
        "serving": "2 hour limit",
        "tag": "7 PM–9 PM | 9 PM–11 PM"
    },
    {
        "id": "fr129",
        "category": "Games",
        "name": "CRAZY GOLF",
        "sellingPrice": 300,
        "serving": "Per pax"
    },
    {
        "id": "fr130",
        "category": "Games",
        "name": "BATTING CAGE",
        "sellingPrice": 300,
        "serving": "1 round 20 balls | Per pax"
    },
    {
        "id": "fr131",
        "category": "Games",
        "name": "EXTREME BASKETBALL",
        "sellingPrice": 100,
        "serving": "Per pax"
    },
    {
        "id": "fr132",
        "category": "Games",
        "name": "SHURIKEN THROW",
        "sellingPrice": 300,
        "serving": "10 mins | 2-4 pax"
    },
    {
        "id": "fr133",
        "category": "Games",
        "name": "SHUFFLE BOARD",
        "sellingPrice": 200,
        "serving": "Best of 3 | 4-6 pax"
    },
    {
        "id": "fr134",
        "category": "Games",
        "name": "CURLING",
        "sellingPrice": 200,
        "serving": "Best of 3 | 4-6 pax"
    },
    {
        "id": "fr135",
        "category": "Games",
        "name": "FEATHER BOWLING",
        "sellingPrice": 200,
        "serving": "Best of 3 | 4-6 pax"
    }
];
