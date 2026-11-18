import { test } from '@playwright/test';
import * as fs from 'fs';
import { importText, openApp } from '../helpers/exchange';

// Diagnostic: the consumers of one product on one island, as the calculator sees them. XT_DIAG = file|island|product.
const DIAG = process.env.XT_DIAG;

test.describe('xt diag', () => {
    test.skip(!DIAG, 'XT_DIAG not set');

    test('consumers of a product', async ({ page }) => {
        test.setTimeout(10 * 60 * 1000);
        const [file, island, product] = DIAG!.split('|');
        await openApp(page);
        const res = await importText(page, fs.readFileSync(file, 'utf-8'));
        if (!res.ok) throw new Error(String(res.error));
        const rows = await page.evaluate(
            ({ island, product }) => {
                const isl = window.view.islands().find((i) => i.name() === island)!;
                const p = isl.products.find((x) => String(x.guid) === product)!;
                const out: string[] = [];
                out.push(`total demand ${p.totalDemand()} production ${p.totalCurrentProduction()}`);
                for (const d of p.demands()) {
                    out.push(`${d.consumer.name()} (${d.consumer.guid}) ${d.amount()}`);
                }
                out.push(`default supplier ${p.defaultSupplier().type}`);
                for (const f of p.factories) {
                    out.push(
                        `factory ${f.guid} boost ${f.boost()} extraGoodFactor ${f.extraGoodFactor()} output ${f.outputAmount()} ` +
                            `required ${f.buildings.required()} fromProduct ${f.demandFromProduct()} viaExtraGoods ${f.throughputByExtraGoodSupplier()}`,
                    );
                    for (const b of f.buffs()) {
                        if (b.scaling() !== 0) out.push(`    buff ${b.buff.guid} ${b.buff.name()} scaling ${b.scaling()} productivity ${b.productivityUpgrade()}`);
                    }
                }
                for (const e of p.extraGoodProductionList.entries) {
                    out.push(`extra good from ${e.factory.name()} (${e.factory.guid}): ${e.amount()} per ${e.additionalOutputCycle} cycles, scaling ${e.item.scaling()}`);
                }
                return out;
            },
            { island, product },
        );
        console.log(rows.join('\n'));
    });
});
