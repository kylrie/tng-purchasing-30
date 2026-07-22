// Pure tests for The Fun Roof menu mapping. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    FUN_ROOF_MENU_GROUPS,
    classifyFunRoofCategory,
    mapFunRoofRecord,
    loadFunRoofMenu,
    orderFunRoofItemsImageFirst,
    isExcludedFromFunRoofQrMenu,
    type FunRoofItem,
} from './funRoofMenu';
import { FUN_ROOF_MENU_SNAPSHOT } from './data/funRoofMenu.snapshot';

const NAV = new Map<string, string>(); // subcategory -> group
for (const g of FUN_ROOF_MENU_GROUPS) for (const s of g.subcategories) NAV.set(s, g.key);

/** Snapshot records that remain visible in the customer QR menu (exclusion applied). */
const VISIBLE_RECORDS = FUN_ROOF_MENU_SNAPSHOT.filter(r => !isExcludedFromFunRoofQrMenu(r.name));

test('nav is Drinks · Food · Play with the venue sub-tabs', () => {
    assert.deepEqual(FUN_ROOF_MENU_GROUPS.map(g => g.key), ['Drinks', 'Food', 'Play']);
    assert.ok(FUN_ROOF_MENU_GROUPS[0].subcategories.includes('Classics'));
    assert.ok(FUN_ROOF_MENU_GROUPS[0].subcategories.includes('Brandy & Cognac'), 'Hennessy sub-tab present');
    assert.ok(!FUN_ROOF_MENU_GROUPS[1].subcategories.includes('Ice Cream'), 'empty Ice Cream tab removed');
    // Food restructure (2026-07-17): Pizza + Bar Chows merged into one Food tab; Add-ons separate.
    assert.deepEqual(FUN_ROOF_MENU_GROUPS[1].subcategories, ['Food', 'Add-ons'], 'Food merged (no Pizza / Bar Chows tabs)');
    assert.deepEqual(FUN_ROOF_MENU_GROUPS[2].subcategories, ['Packages'], 'Games tab removed (packages only)');
});

test('COMPLETENESS: every non-excluded snapshot item maps to a visible nav tab (nothing hidden)', () => {
    const items = loadFunRoofMenu();
    assert.equal(items.length, VISIBLE_RECORDS.length, 'only the QR-only exclusion list is dropped');
    for (const it of items) {
        assert.ok(NAV.has(it.category), `"${it.name}" → unknown sub-tab "${it.category}"`);
        assert.equal(NAV.get(it.category), it.group, `"${it.name}" group/sub mismatch`);
        assert.equal(it.isAvailable, true);
    }
    let reachable = 0;
    for (const g of FUN_ROOF_MENU_GROUPS)
        for (const s of g.subcategories)
            reachable += items.filter(i => i.group === g.key && i.category === s).length;
    assert.equal(reachable, items.length, 'every item reachable via the nav');
});

test('sheet categories map to the right group/sub-tab', () => {
    const c = classifyFunRoofCategory;
    assert.deepEqual(c('Classics'), { group: 'Drinks', subcategory: 'Classics' });
    assert.deepEqual(c('Whiskey'), { group: 'Drinks', subcategory: 'Whiskey' });
    assert.deepEqual(c('Tequila/Mescal'), { group: 'Drinks', subcategory: 'Tequila' });
    assert.deepEqual(c('The Fun Roof Bestsellers'), { group: 'Food', subcategory: 'Food' });
    assert.deepEqual(c('Pizza'), { group: 'Food', subcategory: 'Food' });
    assert.deepEqual(c('Bar Chows'), { group: 'Food', subcategory: 'Food' });
    assert.deepEqual(c('Add Ons'), { group: 'Food', subcategory: 'Add-ons' });
    assert.deepEqual(c('Packages'), { group: 'Play', subcategory: 'Packages' });
});

test('unknown category still lands in a visible bucket (never dropped)', () => {
    const r = classifyFunRoofCategory('Something New');
    assert.ok(NAV.has(r.subcategory));
});

test('field-whitelist + tag/serving/bestSeller mapping', () => {
    const it = mapFunRoofRecord({ id: 'x', name: 'PORK SISIG', category: 'The Fun Roof Bestsellers', sellingPrice: 450, description: 'Grilled pork', tag: 'Bestseller' });
    assert.deepEqual(Object.keys(it).sort(), ['bestSeller', 'category', 'description', 'group', 'id', 'isAvailable', 'name', 'sellingPrice', 'tag']);
    assert.equal(it.bestSeller, true);
    assert.equal(it.group, 'Food');

    const shot = mapFunRoofRecord({ id: 'y', name: 'JACK DANIELS', category: 'Whiskey', sellingPrice: 300, serving: 'Shot' });
    assert.equal(shot.serving, 'Shot');
    assert.equal(shot.bestSeller, false);
    assert.equal('description' in shot, false); // no invented fields
});

test('the real snapshot has the expected shape (bottle/shot pairs present, prices sane)', () => {
    const items = loadFunRoofMenu();
    const jd = items.filter(i => /^JACK DANIELS$/i.test(i.name));
    assert.equal(jd.length, 2); // Bottle + Shot
    assert.deepEqual(jd.map(i => i.serving).sort(), ['Bottle (700ml)', 'Shot']);
    assert.ok(items.every(i => Number.isFinite(i.sellingPrice) && i.sellingPrice > 0));
});

test('FINAL APPROVED SHEET (2026-07-16): counts, prices, removals, Play preserved', () => {
    const items = loadFunRoofMenu();
    // 73 bar + 10 food from the sheet + 3 Packages (7 individual Games are
    // QR-excluded per owner, 2026-07-16 pre-freeze fix) = 86, no duplicate ids
    assert.equal(items.length, 86);
    assert.equal(new Set(items.map(i => i.id)).size, 86, 'ids unique');

    // spot prices = the sheet's "MENU SRP (INCLUSIVE OF VAT AND SC)" column
    const price = (name: string, serving?: string) => {
        const hit = items.find(i => i.name === name && (serving === undefined || i.serving === serving));
        assert.ok(hit, `${name}${serving ? ` (${serving})` : ''} present`);
        return hit!.sellingPrice;
    };
    assert.equal(price('BOTTLED WATER'), 100);
    assert.equal(price('SAN MIG APPLE'), 200);
    assert.equal(price('PORK SISIG'), 500);
    assert.equal(price('PATRON ANEJO', 'Bottle'), 11000);
    assert.equal(price('HENNESSY', 'Shot'), 600);
    assert.equal(price('COCO AMARETTO SOUR'), 440);
    assert.equal(price('FR ICED TEA'), 300);
    assert.equal(price('STEAMED RICE'), 130);

    // items dropped by the approved sheet are gone
    for (const gone of [/SEATTLE DOG/i, /WAGYU ONIGIRI/i, /LECHON BELLY/i, /GREYGOOSE/i, /DON PAPA/i, /JOHNNIE WALKER BLUE/i, /SULA CHOCOLATE/i, /ICE CREAM|440ML CUP|115ML CUP/i, /SINUGLAW/i])
        assert.equal(items.some(i => gone.test(i.name)), false, `${gone} removed`);

    // Play = the 3 Package items only (ids/prices unchanged); Games hidden
    const play = items.filter(i => i.group === 'Play');
    assert.equal(play.length, 3);
    assert.deepEqual(play.map(i => i.id).sort(), ['fr126', 'fr127', 'fr128']);
    assert.equal(play.find(i => i.name === 'UNLI PLAY ALL NIGHT')?.sellingPrice, 500);
    assert.ok(play.every(i => i.imageUrl), 'every kept Play item has its image');
});

test('the 7 individual Games are hidden from the QR menu (packages kept)', () => {
    const GAMES = ['CRAZY GOLF', 'BATTING CAGE', 'EXTREME BASKETBALL', 'SHURIKEN THROW', 'SHUFFLE BOARD', 'CURLING', 'FEATHER BOWLING'];
    // Sanity: all 7 really exist in the raw snapshot, so this test is meaningful.
    for (const g of GAMES)
        assert.ok(FUN_ROOF_MENU_SNAPSHOT.some(r => r.name === g), `${g} is in the snapshot`);
    const items = loadFunRoofMenu();
    for (const g of GAMES)
        assert.equal(items.some(i => i.name === g), false, `${g} hidden from QR menu`);
    // Exactly the 7 Games are filtered; nothing else dropped.
    assert.equal(items.length, FUN_ROOF_MENU_SNAPSHOT.length - 7, 'exactly 7 items excluded');
});

test('image-first ordering is a pure re-order: same ids, none added/dropped, no field mutated', () => {
    const mapped = VISIBLE_RECORDS.map(mapFunRoofRecord);
    const ordered = loadFunRoofMenu();
    assert.equal(ordered.length, mapped.length, 'no item added or dropped (beyond the QR exclusion)');
    assert.deepEqual([...ordered.map(i => i.id)].sort(), [...mapped.map(i => i.id)].sort(), 'same id set');
    // identity fields untouched — compare each item by id against its mapped source
    const byId = new Map(mapped.map(i => [i.id, i]));
    for (const it of ordered) {
        const src = byId.get(it.id)!;
        assert.deepEqual(it, src, `"${it.name}" fields unchanged (name/price/category/group/image/serving/tag)`);
    }
});

test('INVARIANT: within every sub-tab, image items come before non-image items', () => {
    const items = loadFunRoofMenu();
    for (const g of FUN_ROOF_MENU_GROUPS) {
        for (const sub of g.subcategories) {
            const tab = items.filter(i => i.group === g.key && i.category === sub);
            const firstNoImage = tab.findIndex(i => !i.imageUrl);
            if (firstNoImage === -1) continue; // all have images
            // no image item may appear before a non-image one → nothing after the first gap has an image
            const anyImageAfterGap = tab.slice(firstNoImage).some(i => !!i.imageUrl);
            assert.equal(anyImageAfterGap, false, `${g.key}/${sub}: an image item is stranded below a blank one`);
        }
    }
});

test('image-first ordering is STABLE (preserves relative order within each half)', () => {
    const mk = (id: string, hasImg: boolean): FunRoofItem => ({
        id, name: id, group: 'Drinks', category: 'Classics', sellingPrice: 1,
        bestSeller: false, isAvailable: true, ...(hasImg ? { imageUrl: `/x/${id}.jpg` } : {}),
    });
    // A no-img, B img, C no-img, D img  →  B, D, A, C
    const input = [mk('A', false), mk('B', true), mk('C', false), mk('D', true)];
    assert.deepEqual(orderFunRoofItemsImageFirst(input).map(i => i.id), ['B', 'D', 'A', 'C']);
});

test('FOOD MERGE (2026-07-17): bestsellers + pizza + bar chows in one Food tab, add-ons separate, no duplicates', () => {
    const items = loadFunRoofMenu();
    const foodTab = items.filter(i => i.group === 'Food' && i.category === 'Food');
    const addOns = items.filter(i => i.group === 'Food' && i.category === 'Add-ons');
    // 2 bestsellers + 3 pizza + 4 bar chows merged; 1 add-on separate (per snapshot header)
    assert.equal(foodTab.length, 9, 'Pizza + Bar Chows + Bestsellers merged under Food');
    assert.equal(addOns.length, 1, 'Add-ons stays its own tab');
    // Best Seller flags survive the merge (the view surfaces them on top)
    const best = foodTab.filter(i => i.bestSeller);
    assert.deepEqual(best.map(i => i.name).sort(), ['PORK SISIG', 'TFR SMASHED SLIDERS']);
    // one entry per item — nothing duplicated by the merge
    assert.equal(new Set(foodTab.map(i => i.id)).size, foodTab.length, 'no duplicate items in Food');
});

test('QR-only exclusion mechanism: only the 7 Games are on the list', () => {
    assert.equal(isExcludedFromFunRoofQrMenu('crazy golf'), true);
    assert.equal(isExcludedFromFunRoofQrMenu('seattle dog'), false, 'old exclusions gone from the source entirely');
    assert.ok(loadFunRoofMenu().some(i => /not calamari/i.test(i.name) && i.category === 'Food'), 'Bar Chows items intact (merged under Food)');
});
