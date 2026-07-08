// The Fun Roof (business unit b1 · "THE FUN GUYS CORP.") — PUBLIC MENU SNAPSHOT
//
// GENERATED, READ-ONLY. Do not hand-edit. Source of truth = the owner's curated
// "The Fun Roof Menu" Google Sheet (transcribed from the venue's printed menu),
// exported as CSV. This intentionally REPLACES the earlier raw menu_items dump —
// the owner provided this clean list as the correct customer menu.
//
// Regenerate: export the sheet tab as CSV and re-run scripts/gen-snapshot. No
// backend writes, no POS coupling. Prices in PHP (VAT-inclusive, per the sheet).
// Snapshot taken: 2026-07-08. Items: 136.
// Categories (in menu order): {"The Fun Roof Bestsellers":3,"Pizza":3,"Bar Chows":9,"Ice Cream":2,"Add Ons":3,"Whiskey":20,"Vodka":6,"Tequila/Mescal":16,"Rum":10,"Gin":10,"Ice Cold":3,"Liqueur":10,"Non-Alcoholic":11,"Beers":8,"Classics":12,"Packages":3,"Games":7}

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

/** The complete Fun Roof menu, exactly as curated by the owner (read-only). */
export const FUN_ROOF_MENU_SNAPSHOT: FunRoofMenuRecord[] = [
    {
        "id": "fr000",
        "category": "The Fun Roof Bestsellers",
        "name": "PORK SISIG",
        "sellingPrice": 450,
        "description": "Grilled, crispy pork with a spicy, tangy kick served sizzling hot with an egg on top for that perfect bite!",
        "tag": "Bestseller"
    },
    {
        "id": "fr001",
        "category": "The Fun Roof Bestsellers",
        "name": "TFR SMASHED SLIDERS",
        "sellingPrice": 630,
        "description": "Smashed beef patty, cheddar, smoked BBQ mayo, caramelized onion, jack cheese sauce, crispy chips.",
        "tag": "Bestseller"
    },
    {
        "id": "fr002",
        "category": "The Fun Roof Bestsellers",
        "name": "SINUGLAW CHEESE TACO",
        "sellingPrice": 545,
        "description": "Tangy grilled pork and fresh ceviche wrapped in a cheesy taco.",
        "tag": "Bestseller"
    },
    {
        "id": "fr003",
        "category": "Pizza",
        "name": "PEPPERONI",
        "sellingPrice": 655,
        "description": "Mozzarella, tomato concasse, pepperoni and burrata."
    },
    {
        "id": "fr004",
        "category": "Pizza",
        "name": "PROSCIUTTO & ARUGULA",
        "sellingPrice": 645,
        "description": "Fresh flour dough, concasse, mozzarella, prosciutto crudo, arugula & burrata."
    },
    {
        "id": "fr005",
        "category": "Pizza",
        "name": "FOUR CHEESE",
        "sellingPrice": 545,
        "description": "Mozzarella, feta, blue cheese and parmesan with parsley as garnish."
    },
    {
        "id": "fr006",
        "category": "Bar Chows",
        "name": "SEATTLE DOG",
        "sellingPrice": 475,
        "description": "This hotdog's got a punch: creamy cream cheese, pickled cucumbers, and big flavor!",
        "tag": "Chef's Reco"
    },
    {
        "id": "fr007",
        "category": "Bar Chows",
        "name": "NOT CALAMARI",
        "sellingPrice": 350,
        "description": "Deep fried crispy enoki mushroom with special sauce.",
        "tag": "Chef's Reco"
    },
    {
        "id": "fr008",
        "category": "Bar Chows",
        "name": "WAGYU ONIGIRI",
        "sellingPrice": 480,
        "description": "Wagyu strips, Japanese rice, & TFR yakiniku sauce."
    },
    {
        "id": "fr009",
        "category": "Bar Chows",
        "name": "KALDERETA BIRRIA CHEESE TACO",
        "sellingPrice": 400,
        "description": "Braised beef, kaldereta puree, colby jack, cilantro, and onions in a cheesy taco shell."
    },
    {
        "id": "fr010",
        "category": "Bar Chows",
        "name": "LECHON BELLY",
        "sellingPrice": 850,
        "description": "Crispy, tender, and juicy—crispy on the outside, tender inside!"
    },
    {
        "id": "fr011",
        "category": "Bar Chows",
        "name": "CHICKEN TENDERS",
        "sellingPrice": 345,
        "description": "Flavors: sweet buffalo, habanero, and The Fun Rub."
    },
    {
        "id": "fr012",
        "category": "Bar Chows",
        "name": "SHRIMP & SPAM CROQUETTES",
        "sellingPrice": 440,
        "description": "Shrimp, pork fat, spam, sesame, mozzarella and chives."
    },
    {
        "id": "fr013",
        "category": "Bar Chows",
        "name": "TRUFFLED SHRIMP POPCORN",
        "sellingPrice": 450,
        "description": "Prawns, smoked pepper aioli & truffle oil."
    },
    {
        "id": "fr014",
        "category": "Bar Chows",
        "name": "TFR FRIES",
        "sellingPrice": 250,
        "description": "Shoestring potatoes and cajun."
    },
    {
        "id": "fr015",
        "category": "Ice Cream",
        "name": "440ML CUP",
        "sellingPrice": 591,
        "description": "Flavors: vanilla, Brazilian choco, dark choco, choco.",
        "serving": "440ml cup"
    },
    {
        "id": "fr016",
        "category": "Ice Cream",
        "name": "115ML CUP",
        "sellingPrice": 227,
        "description": "Flavors: rocky road, cookie dough, coffee almond fudge, salted caramel vanilla.",
        "serving": "115ml cup"
    },
    {
        "id": "fr017",
        "category": "Add Ons",
        "name": "STEAMED RICE",
        "sellingPrice": 100
    },
    {
        "id": "fr018",
        "category": "Add Ons",
        "name": "GARLIC RICE",
        "sellingPrice": 100
    },
    {
        "id": "fr019",
        "category": "Add Ons",
        "name": "CHEESE SAUCE",
        "sellingPrice": 100
    },
    {
        "id": "fr020",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLUE LABEL",
        "sellingPrice": 15000,
        "serving": "Bottle"
    },
    {
        "id": "fr021",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLUE LABEL",
        "sellingPrice": 1500,
        "serving": "Shot"
    },
    {
        "id": "fr022",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER GOLD",
        "sellingPrice": 5000,
        "serving": "Bottle"
    },
    {
        "id": "fr023",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER GOLD",
        "sellingPrice": 400,
        "serving": "Shot"
    },
    {
        "id": "fr024",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLACK LABEL",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr025",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLACK LABEL",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr026",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLONDE",
        "sellingPrice": 2800,
        "serving": "Bottle"
    },
    {
        "id": "fr027",
        "category": "Whiskey",
        "name": "JOHNNIE WALKER BLONDE",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr028",
        "category": "Whiskey",
        "name": "DEWARS 12",
        "sellingPrice": 3500,
        "serving": "Bottle"
    },
    {
        "id": "fr029",
        "category": "Whiskey",
        "name": "DEWARS 12",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr030",
        "category": "Whiskey",
        "name": "JAMESON IRISH WHISKEY",
        "sellingPrice": 2800,
        "serving": "Bottle"
    },
    {
        "id": "fr031",
        "category": "Whiskey",
        "name": "JAMESON IRISH WHISKEY",
        "sellingPrice": 280,
        "serving": "Shot"
    },
    {
        "id": "fr032",
        "category": "Whiskey",
        "name": "JAMESON BLACK BARREL",
        "sellingPrice": 4000,
        "serving": "Bottle"
    },
    {
        "id": "fr033",
        "category": "Whiskey",
        "name": "JAMESON BLACK BARREL",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr034",
        "category": "Whiskey",
        "name": "JACK DANIELS",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr035",
        "category": "Whiskey",
        "name": "JACK DANIELS",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr036",
        "category": "Whiskey",
        "name": "JIM BEAM WHITE",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr037",
        "category": "Whiskey",
        "name": "JIM BEAM WHITE",
        "sellingPrice": 220,
        "serving": "Shot"
    },
    {
        "id": "fr038",
        "category": "Whiskey",
        "name": "CHARLES AND JAMES",
        "sellingPrice": 2000,
        "serving": "Bottle"
    },
    {
        "id": "fr039",
        "category": "Whiskey",
        "name": "CHARLES AND JAMES",
        "sellingPrice": 200,
        "serving": "Shot"
    },
    {
        "id": "fr040",
        "category": "Vodka",
        "name": "ABSOLUT BLUE",
        "sellingPrice": 2800,
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
        "id": "fr042",
        "category": "Vodka",
        "name": "GREYGOOSE",
        "sellingPrice": 4500,
        "serving": "Bottle"
    },
    {
        "id": "fr043",
        "category": "Vodka",
        "name": "GREYGOOSE",
        "sellingPrice": 455,
        "serving": "Shot"
    },
    {
        "id": "fr044",
        "category": "Vodka",
        "name": "BELVEDERE",
        "sellingPrice": 4000,
        "serving": "Bottle"
    },
    {
        "id": "fr045",
        "category": "Vodka",
        "name": "BELVEDERE",
        "sellingPrice": 400,
        "serving": "Shot"
    },
    {
        "id": "fr046",
        "category": "Tequila/Mescal",
        "name": "JOSE CUERVO ESPECIAL REPOSADO",
        "sellingPrice": 3500,
        "serving": "Bottle"
    },
    {
        "id": "fr047",
        "category": "Tequila/Mescal",
        "name": "JOSE CUERVO ESPECIAL REPOSADO",
        "sellingPrice": 320,
        "serving": "Shot"
    },
    {
        "id": "fr048",
        "category": "Tequila/Mescal",
        "name": "JOSE CUERVO ESPECIAL SILVER",
        "sellingPrice": 3550,
        "serving": "Bottle"
    },
    {
        "id": "fr049",
        "category": "Tequila/Mescal",
        "name": "JOSE CUERVO ESPECIAL SILVER",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr050",
        "category": "Tequila/Mescal",
        "name": "1800 REPOSADO",
        "sellingPrice": 5500,
        "serving": "Bottle"
    },
    {
        "id": "fr051",
        "category": "Tequila/Mescal",
        "name": "1800 REPOSADO",
        "sellingPrice": 400,
        "serving": "Shot"
    },
    {
        "id": "fr052",
        "category": "Tequila/Mescal",
        "name": "1800 BLANCO",
        "sellingPrice": 5000,
        "serving": "Bottle"
    },
    {
        "id": "fr053",
        "category": "Tequila/Mescal",
        "name": "1800 BLANCO",
        "sellingPrice": 400,
        "serving": "Shot"
    },
    {
        "id": "fr054",
        "category": "Tequila/Mescal",
        "name": "PATRON SILVER",
        "sellingPrice": 6400,
        "serving": "Bottle"
    },
    {
        "id": "fr055",
        "category": "Tequila/Mescal",
        "name": "PATRON SILVER",
        "sellingPrice": 500,
        "serving": "Shot"
    },
    {
        "id": "fr056",
        "category": "Tequila/Mescal",
        "name": "PATRON ANEJO",
        "sellingPrice": 6900,
        "serving": "Bottle"
    },
    {
        "id": "fr057",
        "category": "Tequila/Mescal",
        "name": "PATRON ANEJO",
        "sellingPrice": 650,
        "serving": "Shot"
    },
    {
        "id": "fr058",
        "category": "Tequila/Mescal",
        "name": "OLMECA",
        "sellingPrice": 3550,
        "serving": "Bottle"
    },
    {
        "id": "fr059",
        "category": "Tequila/Mescal",
        "name": "OLMECA",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr060",
        "category": "Tequila/Mescal",
        "name": "CAZADORES",
        "sellingPrice": 3550,
        "serving": "Bottle"
    },
    {
        "id": "fr061",
        "category": "Tequila/Mescal",
        "name": "CAZADORES",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr062",
        "category": "Rum",
        "name": "BACARDI GOLD",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr063",
        "category": "Rum",
        "name": "BACARDI GOLD",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr064",
        "category": "Rum",
        "name": "BACARDI WHITE",
        "sellingPrice": 2800,
        "serving": "Bottle"
    },
    {
        "id": "fr065",
        "category": "Rum",
        "name": "BACARDI WHITE",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr066",
        "category": "Rum",
        "name": "DON PAPA",
        "sellingPrice": 4200,
        "serving": "Bottle"
    },
    {
        "id": "fr067",
        "category": "Rum",
        "name": "DON PAPA",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr068",
        "category": "Rum",
        "name": "CAPTAIN MORGAN SPICE",
        "sellingPrice": 2900,
        "serving": "Bottle"
    },
    {
        "id": "fr069",
        "category": "Rum",
        "name": "CAPTAIN MORGAN SPICE",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr070",
        "category": "Rum",
        "name": "MALIBU",
        "sellingPrice": 2545,
        "serving": "Bottle"
    },
    {
        "id": "fr071",
        "category": "Rum",
        "name": "MALIBU",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr072",
        "category": "Gin",
        "name": "BOMBAY SAPPHIRE",
        "sellingPrice": 4000,
        "serving": "Bottle"
    },
    {
        "id": "fr073",
        "category": "Gin",
        "name": "BOMBAY SAPPHIRE",
        "sellingPrice": 300,
        "serving": "Shot"
    },
    {
        "id": "fr074",
        "category": "Gin",
        "name": "TANQUERAY DRY",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr075",
        "category": "Gin",
        "name": "TANQUERAY DRY",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr076",
        "category": "Gin",
        "name": "SUNTORY ROKU",
        "sellingPrice": 3800,
        "serving": "Bottle"
    },
    {
        "id": "fr077",
        "category": "Gin",
        "name": "SUNTORY ROKU",
        "sellingPrice": 350,
        "serving": "Shot"
    },
    {
        "id": "fr078",
        "category": "Gin",
        "name": "HENDRICKS",
        "sellingPrice": 5000,
        "serving": "Bottle"
    },
    {
        "id": "fr079",
        "category": "Gin",
        "name": "HENDRICKS",
        "sellingPrice": 450,
        "serving": "Shot"
    },
    {
        "id": "fr080",
        "category": "Gin",
        "name": "BEEFEATER",
        "sellingPrice": 2500,
        "serving": "Bottle"
    },
    {
        "id": "fr081",
        "category": "Gin",
        "name": "BEEFEATER",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr082",
        "category": "Ice Cold",
        "name": "JAGERMEISTER",
        "sellingPrice": 2500,
        "serving": "Bottle"
    },
    {
        "id": "fr083",
        "category": "Ice Cold",
        "name": "JAGERMEISTER",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr084",
        "category": "Ice Cold",
        "name": "JAGERMEISTER + 3 REDBULL CANS",
        "sellingPrice": 2800,
        "serving": "Bottle"
    },
    {
        "id": "fr085",
        "category": "Liqueur",
        "name": "UBE LIQUEUR",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr086",
        "category": "Liqueur",
        "name": "UBE LIQUEUR",
        "sellingPrice": 255,
        "serving": "Shot"
    },
    {
        "id": "fr087",
        "category": "Liqueur",
        "name": "SULA CHOCOLATE",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr088",
        "category": "Liqueur",
        "name": "SULA CHOCOLATE",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr089",
        "category": "Liqueur",
        "name": "SULA COCONUT",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr090",
        "category": "Liqueur",
        "name": "SULA COCONUT",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr091",
        "category": "Liqueur",
        "name": "SULA COFFEE",
        "sellingPrice": 3000,
        "serving": "Bottle"
    },
    {
        "id": "fr092",
        "category": "Liqueur",
        "name": "SULA COFFEE",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr093",
        "category": "Liqueur",
        "name": "BAILEYS",
        "sellingPrice": 2500,
        "serving": "Bottle"
    },
    {
        "id": "fr094",
        "category": "Liqueur",
        "name": "BAILEYS",
        "sellingPrice": 250,
        "serving": "Shot"
    },
    {
        "id": "fr095",
        "category": "Non-Alcoholic",
        "name": "BOTTLED WATER",
        "sellingPrice": 85
    },
    {
        "id": "fr096",
        "category": "Non-Alcoholic",
        "name": "COKE PITCHER",
        "sellingPrice": 300
    },
    {
        "id": "fr097",
        "category": "Non-Alcoholic",
        "name": "COKE REGULAR IN CAN",
        "sellingPrice": 100
    },
    {
        "id": "fr098",
        "category": "Non-Alcoholic",
        "name": "COKE ZERO IN CAN",
        "sellingPrice": 100
    },
    {
        "id": "fr099",
        "category": "Non-Alcoholic",
        "name": "SPRITE PITCHER",
        "sellingPrice": 300
    },
    {
        "id": "fr100",
        "category": "Non-Alcoholic",
        "name": "SPRITE IN CAN",
        "sellingPrice": 100
    },
    {
        "id": "fr101",
        "category": "Non-Alcoholic",
        "name": "REDBULL",
        "sellingPrice": 200
    },
    {
        "id": "fr102",
        "category": "Non-Alcoholic",
        "name": "FR ICED TEA",
        "sellingPrice": 230
    },
    {
        "id": "fr103",
        "category": "Non-Alcoholic",
        "name": "SCHWEPPES SODA",
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
        "sellingPrice": 180
    },
    {
        "id": "fr107",
        "category": "Beers",
        "name": "SAN MIG APPLE",
        "sellingPrice": 180
    },
    {
        "id": "fr108",
        "category": "Beers",
        "name": "SAN MIG LIGHT",
        "sellingPrice": 180
    },
    {
        "id": "fr109",
        "category": "Beers",
        "name": "SAN MIG PALE PILSEN",
        "sellingPrice": 180
    },
    {
        "id": "fr110",
        "category": "Beers",
        "name": "SAN MIG SUPER DRY CAN",
        "sellingPrice": 180
    },
    {
        "id": "fr111",
        "category": "Beers",
        "name": "HEINEKEN SILVER",
        "sellingPrice": 180
    },
    {
        "id": "fr112",
        "category": "Beers",
        "name": "TIGER CRYSTAL",
        "sellingPrice": 180
    },
    {
        "id": "fr113",
        "category": "Beers",
        "name": "DRAFT BEER 330ML (SAN MIG PALE PILSEN OR SAN MIG LIGHT)",
        "sellingPrice": 180
    },
    {
        "id": "fr114",
        "category": "Classics",
        "name": "AMARETTO SOUR",
        "sellingPrice": 350
    },
    {
        "id": "fr115",
        "category": "Classics",
        "name": "COSMOPOLITAN",
        "sellingPrice": 350
    },
    {
        "id": "fr116",
        "category": "Classics",
        "name": "CLASSIC MARGARITA",
        "sellingPrice": 350
    },
    {
        "id": "fr117",
        "category": "Classics",
        "name": "CLASSIC WHISKY SOUR",
        "sellingPrice": 350
    },
    {
        "id": "fr118",
        "category": "Classics",
        "name": "GIN TONIC",
        "sellingPrice": 350
    },
    {
        "id": "fr119",
        "category": "Classics",
        "name": "LONG ISLAND ICED TEA",
        "sellingPrice": 350
    },
    {
        "id": "fr120",
        "category": "Classics",
        "name": "NEGRONI",
        "sellingPrice": 350
    },
    {
        "id": "fr121",
        "category": "Classics",
        "name": "OLD FASHIONED",
        "sellingPrice": 350
    },
    {
        "id": "fr122",
        "category": "Classics",
        "name": "PINA COLADA",
        "sellingPrice": 350
    },
    {
        "id": "fr123",
        "category": "Classics",
        "name": "RUM COKE",
        "sellingPrice": 350
    },
    {
        "id": "fr124",
        "category": "Classics",
        "name": "WHITE RUSSIAN",
        "sellingPrice": 350
    },
    {
        "id": "fr125",
        "category": "Classics",
        "name": "WHISKY HIGHBALL",
        "sellingPrice": 350
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
