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
    assert.deepEqual(FUN_ROOF_MENU_GROUPS[2].subcategories, ['Packages', 'Games']);
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
    assert.deepEqual(c('The Fun Roof Bestsellers'), { group: 'Food', subcategory: 'Bestsellers' });
    assert.deepEqual(c('Pizza'), { group: 'Food', subcategory: 'Pizza' });
    assert.deepEqual(c('Add Ons'), { group: 'Food', subcategory: 'Add-ons' });
    assert.deepEqual(c('Games'), { group: 'Play', subcategory: 'Games' });
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
    // 73 bar + 10 food from the sheet + 10 Play carried over = 93, no duplicate ids
    assert.equal(items.length, 93);
    assert.equal(new Set(items.map(i => i.id)).size, 93, 'ids unique');

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

    // Play carried over unchanged (10 items, same ids/prices)
    const play = items.filter(i => i.group === 'Play');
    assert.equal(play.length, 10);
    assert.equal(play.find(i => i.name === 'UNLI PLAY ALL NIGHT')?.sellingPrice, 500);
    assert.equal(play.find(i => i.name === 'CRAZY GOLF')?.id, 'fr129');
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

test('QR-only exclusion list is empty (approved sheet superseded it): nothing filtered', () => {
    // The old exclusions (Seattle Dog, Wagyu Onigiri) are no longer in the snapshot at all.
    const items = loadFunRoofMenu();
    assert.equal(items.length, FUN_ROOF_MENU_SNAPSHOT.length, 'no item filtered by the exclusion list');
    assert.equal(isExcludedFromFunRoofQrMenu('seattle dog'), false, 'mechanism intact, list empty');
    assert.ok(items.some(i => /not calamari/i.test(i.name) && i.category === 'Bar Chows'), 'Bar Chows intact');
});
