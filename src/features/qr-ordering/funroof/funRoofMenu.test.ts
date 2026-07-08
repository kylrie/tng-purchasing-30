// Pure tests for The Fun Roof menu mapping. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    FUN_ROOF_MENU_GROUPS,
    classifyFunRoofCategory,
    mapFunRoofRecord,
    loadFunRoofMenu,
} from './funRoofMenu';
import { FUN_ROOF_MENU_SNAPSHOT } from './data/funRoofMenu.snapshot';

const NAV = new Map<string, string>(); // subcategory -> group
for (const g of FUN_ROOF_MENU_GROUPS) for (const s of g.subcategories) NAV.set(s, g.key);

test('nav is Drinks · Food · Play with the venue sub-tabs', () => {
    assert.deepEqual(FUN_ROOF_MENU_GROUPS.map(g => g.key), ['Drinks', 'Food', 'Play']);
    assert.ok(FUN_ROOF_MENU_GROUPS[0].subcategories.includes('Classics'));
    assert.deepEqual(FUN_ROOF_MENU_GROUPS[2].subcategories, ['Packages', 'Games']);
});

test('COMPLETENESS: every snapshot item maps to a visible nav tab (nothing hidden)', () => {
    const items = loadFunRoofMenu();
    assert.equal(items.length, FUN_ROOF_MENU_SNAPSHOT.length, 'no items dropped');
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
