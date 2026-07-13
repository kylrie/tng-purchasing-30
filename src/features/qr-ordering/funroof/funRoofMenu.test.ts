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
    const jwBlue = items.filter(i => /JOHNNIE WALKER BLUE LABEL/i.test(i.name));
    assert.equal(jwBlue.length, 2); // Bottle + Shot
    assert.deepEqual(jwBlue.map(i => i.serving).sort(), ['Bottle', 'Shot']);
    assert.ok(items.every(i => Number.isFinite(i.sellingPrice) && i.sellingPrice > 0));
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

test('QR-only exclusion: Seattle Dog and Wagyu Onigiri are hidden from the customer menu', () => {
    // Sanity: both names really exist in the raw snapshot, so this test is meaningful.
    assert.ok(FUN_ROOF_MENU_SNAPSHOT.some(r => /^seattle dog$/i.test(r.name.trim())), 'Seattle Dog is in the snapshot');
    assert.ok(FUN_ROOF_MENU_SNAPSHOT.some(r => /^wagyu onigiri$/i.test(r.name.trim())), 'Wagyu Onigiri is in the snapshot');

    const items = loadFunRoofMenu();
    assert.equal(items.filter(i => /seattle dog/i.test(i.name)).length, 0, 'Seattle Dog not in QR menu');
    assert.equal(items.filter(i => /wagyu onigiri/i.test(i.name)).length, 0, 'Wagyu Onigiri not in QR menu');

    // Exactly two items removed vs the full snapshot; nothing else dropped.
    assert.equal(items.length, FUN_ROOF_MENU_SNAPSHOT.length - 2, 'exactly 2 items removed');
    // A neighbouring Bar Chows item is untouched (surrounding items still visible).
    assert.ok(items.some(i => /not calamari/i.test(i.name) && i.category === 'Bar Chows'), 'other Bar Chows items remain');
});
