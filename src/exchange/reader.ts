// Reader of the exchange format (U4): one pass over the parsed file, envelope check, typed document,
// capture of everything the calculator does not model. Pure: no storage, no DOM, no window.

import {
    Computed,
    ExchangeDocument,
    ReadError,
    ReadErrorCode,
    ReadProblem,
    ReadProblemCode,
    ReadResult,
    UnknownField,
    UnknownKind,
} from "./types";

export const FORMAT_MARKER = "anno117-exchange";
export const SUPPORTED_FORMAT_VERSION = "1.0";
const SUPPORTED_MAJOR = 1;
const OWN_EXTENSION = "calculator";

type Prim = "guid" | "int" | "num" | "bool" | "str" | "any" | "instance" | "guidOrNone";

// Shape of the catalog keys the calculator reads. Anything not listed in an "obj" is unknown and captured.
type Shape =
    | { k: "prim"; t: Prim }
    | { k: "obj"; keys: Record<string, Shape>; ext?: boolean }
    | { k: "open" } // a JSON object whose content is kept as is, no capture below it
    | { k: "map"; value: Shape }
    | { k: "arr"; item: Shape }
    | { k: "kept" }; // catalog key the calculator does not model: captured whole at its original location

const prim = (t: Prim): Shape => ({ k: "prim", t });
const obj = (keys: Record<string, Shape>, ext = false): Shape => ({ k: "obj", keys, ext });
const arr = (item: Shape): Shape => ({ k: "arr", item });
const map = (value: Shape): Shape => ({ k: "map", value });
const OPEN: Shape = { k: "open" };
const KEPT: Shape = { k: "kept" };
const GUID = prim("guid");
const INT = prim("int");
const NUM = prim("num");
const BOOL = prim("bool");
const STR = prim("str");

const ISLAND_SHAPE = obj(
    {
        id: STR,
        name: STR,
        session: GUID,
        gameIsland: obj({ sessionGuid: GUID, islandId: INT, areaIndex: INT, areaKey: INT, name: STR }),
        islandFile: KEPT,
        islandSize: KEPT,
        fertilities: map(BOOL),
        fertilitiesComplete: BOOL,
        patron: GUID,
        devotion: NUM,
        buildings: map(obj({ built: INT, planned: INT, fullyUtilize: BOOL })),
        residencesByLevel: map(INT),
        population: KEPT,
        disabledNeeds: map(arr(GUID)),
        needNotes: map(map(STR)),
        products: map(obj({ producer: prim("guidOrNone"), notes: STR })),
        factories: map(
            obj({
                items: arr(obj({ item: GUID, boosted: BOOL })),
                effects: arr(GUID),
                aqueduct: BOOL,
                modules: map(BOOL),
                manualProductivity: NUM,
            }),
        ),
        itemHolders: KEPT,
        itemStorage: KEPT,
        moduleAttachments: KEPT,
        effects: map(NUM),
        appliedEffects: KEPT,
        rangeBuffs: KEPT,
        residenceItems: KEPT,
        islandItems: KEPT,
        villaCoverage: KEPT,
        residenceEffects: KEPT,
        publicCoverages: KEPT,
        notes: map(STR),
        harbour: KEPT,
        position: KEPT,
        materials: OPEN,
        romanization: KEPT,
        wonders: KEPT,
        extraDemand: KEPT,
        minimumStock: map(NUM),
        layout: KEPT,
    },
    true,
);

const DOCUMENT_SHAPE = obj(
    {
        format: STR,
        formatVersion: STR,
        generator: obj({ name: STR, version: STR }),
        source: obj({ kind: STR, file: STR, savegameFormatVersion: prim("any"), gameVersion: STR, saveTime: STR }),
        name: KEPT,
        settings: obj({ dlcs: arr(INT), difficulty: OPEN, volcano: OPEN, seasons: OPEN, map: KEPT }),
        fleet: KEPT,
        effects: obj({ global: map(NUM), bySession: map(map(NUM)) }),
        research: obj({
            researched: arr(GUID),
            counts: map(INT),
            queue: arr(GUID),
            knowledgePerMinute: NUM,
            basis: STR,
        }),
        dominantPatron: KEPT,
        trade: obj({
            routes: arr(
                obj(
                    {
                        id: STR,
                        name: STR,
                        manual: BOOL,
                        stations: arr(
                            obj(
                                {
                                    island: STR,
                                    slots: arr(
                                        obj({ product: GUID, mode: STR, slot: INT, amount: NUM }, true),
                                    ),
                                },
                                true,
                            ),
                        ),
                        ships: arr(obj({ type: GUID, slots: INT, count: INT, modules: prim("any") })),
                    },
                    true,
                ),
            ),
            imports: arr(
                obj({
                    island: STR,
                    product: GUID,
                    amount: NUM,
                    basis: STR,
                    suppliers: arr(obj({ island: STR, governor: GUID, share: NUM, amount: NUM, default: BOOL })),
                }),
            ),
            governorHarbours: arr(OPEN),
            visits: arr(OPEN),
        }),
        history: KEPT,
        live: KEPT,
        account: KEPT,
        unlocatedItems: KEPT,
        // `computed` and `islands` are handled outside the generic walk
    },
    true,
);

class Reader {
    unknown: UnknownField[] = [];
    problems: ReadProblem[] = [];

    problem(pointer: string, code: ReadProblemCode, message: string): void {
        this.problems.push({ pointer, code, message });
    }

    capture(pointer: string, value: unknown, scope: string, kind: UnknownKind): void {
        this.unknown.push({ pointer, value, scope, kind });
    }

    // Returns the (possibly coerced) value, or undefined when the value is dropped.
    coercePrim(value: unknown, t: Prim, pointer: string): unknown {
        switch (t) {
            case "any":
                return value;
            case "str":
                if (typeof value === "string") return value;
                break;
            case "bool":
                if (typeof value === "boolean") return value;
                break;
            case "instance":
                if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return value;
                break;
            case "guidOrNone":
                if (value === "none") return value;
                return this.coercePrim(value, "guid", pointer);
            case "guid":
            case "int": {
                if (typeof value === "number" && Number.isInteger(value)) return value;
                if (typeof value === "string" && /^\s*[+-]?\d+\s*$/.test(value)) {
                    const n = parseInt(value, 10);
                    this.problem(pointer, "coerced", `numeric string ${JSON.stringify(value)} read as ${n}`);
                    return n;
                }
                break;
            }
            case "num":
                if (typeof value === "number" && Number.isFinite(value)) return value;
                if (typeof value === "string" && /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(value)) {
                    const n = parseFloat(value);
                    this.problem(pointer, "coerced", `numeric string ${JSON.stringify(value)} read as ${n}`);
                    return n;
                }
                break;
        }
        this.problem(pointer, "wrong-type", `expected ${t}, got ${describe(value)}; value dropped`);
        return undefined;
    }

    // Walks `value` against `shape`; returns the value to keep, or undefined to drop it from the parent.
    walk(value: unknown, shape: Shape, pointer: string, scope: string): unknown {
        switch (shape.k) {
            case "prim":
                return this.coercePrim(value, shape.t, pointer);
            case "kept":
                return value; // captured by the parent, which knows the key
            case "open":
                if (isPlainObject(value)) return value;
                this.problem(pointer, "wrong-type", `expected object, got ${describe(value)}; value dropped`);
                return undefined;
            case "arr": {
                if (!Array.isArray(value)) {
                    this.problem(pointer, "wrong-type", `expected array, got ${describe(value)}; value dropped`);
                    return undefined;
                }
                const out: unknown[] = [];
                value.forEach((el, i) => {
                    const kept = this.walk(el, shape.item, `${pointer}/${i}`, scope);
                    if (kept !== undefined) out.push(kept);
                });
                return out;
            }
            case "map": {
                if (!isPlainObject(value)) {
                    this.problem(pointer, "wrong-type", `expected object, got ${describe(value)}; value dropped`);
                    return undefined;
                }
                for (const key of Object.keys(value)) {
                    const kept = this.walk(value[key], shape.value, `${pointer}/${escapePointer(key)}`, scope);
                    if (kept === undefined) delete value[key];
                    else value[key] = kept;
                }
                return value;
            }
            case "obj": {
                if (!isPlainObject(value)) {
                    this.problem(pointer, "wrong-type", `expected object, got ${describe(value)}; value dropped`);
                    return undefined;
                }
                for (const key of Object.keys(value)) {
                    const child = `${pointer}/${escapePointer(key)}`;
                    if (shape.ext && key === "ext") {
                        this.walkExt(value, child, scope);
                        continue;
                    }
                    const sub = shape.keys[key];
                    if (sub === undefined) {
                        this.capture(child, value[key], scope, "unknown");
                    } else if (sub.k === "kept") {
                        this.capture(child, value[key], scope, "unmodelled");
                    } else {
                        const kept = this.walk(value[key], sub, child, scope);
                        if (kept === undefined) delete value[key];
                        else value[key] = kept;
                    }
                }
                return value;
            }
        }
    }

    // `ext` holds one block per generator. The calculator's own block is read by the importer; every other block
    // is private data of another tool and is captured whole.
    walkExt(parent: Record<string, unknown>, pointer: string, scope: string): void {
        const ext = parent.ext;
        if (!isPlainObject(ext)) {
            this.problem(pointer, "wrong-type", `expected object, got ${describe(ext)}; value dropped`);
            delete parent.ext;
            return;
        }
        for (const name of Object.keys(ext)) {
            if (name === OWN_EXTENSION) continue;
            this.capture(`${pointer}/${escapePointer(name)}`, ext[name], scope, "unknown");
        }
    }

    // Item records of every place (R56): every record stays verbatim; a missing item GUID and a repeated
    // instance id are reported.
    checkItems(doc: Record<string, unknown>, islands: Record<string, unknown>[]): void {
        const seen = new Map<string, string>();
        const records = (list: unknown, pointer: string): void => {
            if (!Array.isArray(list)) return;
            list.forEach((rec, i) => {
                const p = `${pointer}/${i}`;
                if (!isPlainObject(rec)) {
                    this.problem(p, "item-without-guid", "item record is not an object");
                    return;
                }
                if (typeof rec.item !== "number" || !Number.isInteger(rec.item)) {
                    this.problem(p, "item-without-guid", "item record has no item GUID");
                }
                if (rec.instance !== undefined && (typeof rec.instance === "number" || typeof rec.instance === "string")) {
                    const id = String(rec.instance);
                    const first = seen.get(id);
                    if (first !== undefined) {
                        this.problem(p, "duplicate-instance", `item instance ${id} is also at ${first}; all records kept`);
                    } else {
                        seen.set(id, p);
                    }
                }
            });
        };
        islands.forEach((isl, i) => {
            const base = `/islands/${i}`;
            const holders = isl.itemHolders;
            if (Array.isArray(holders)) {
                holders.forEach((h, j) => {
                    if (!isPlainObject(h)) return;
                    records(h.items, `${base}/itemHolders/${j}/items`);
                    records(h.carried, `${base}/itemHolders/${j}/carried`);
                });
            }
            records(isl.itemStorage, `${base}/itemStorage`);
        });
        const account = doc.account;
        if (isPlainObject(account)) records(account.items, "/account/items");
        records(doc.unlocatedItems, "/unlocatedItems");
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
}

function escapePointer(key: string): string {
    return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function fail(code: ReadErrorCode, error: string): ReadError {
    return { error, code };
}

// Reads the text of an exchange file. Returns an envelope error, or the document with the captured
// unknown fields and the problems found in known keys. Never throws.
export function readExchange(text: string): ReadResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    } catch (e) {
        return fail("not-json", `The file is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!isPlainObject(parsed)) return fail("not-object", "The top level of the file is not an object.");
    const root = parsed;

    if (root.format !== FORMAT_MARKER) {
        return fail("wrong-format", `The file is not an ${FORMAT_MARKER} file (format is ${JSON.stringify(root.format)}).`);
    }
    if (root.formatVersion === undefined) return fail("missing-formatVersion", "The file has no formatVersion.");
    const version = typeof root.formatVersion === "string" ? /^(\d+)\.(\d+)/.exec(root.formatVersion) : null;
    if (!version) {
        return fail("invalid-formatVersion", `formatVersion ${JSON.stringify(root.formatVersion)} is not of the form major.minor.`);
    }
    if (parseInt(version[1], 10) > SUPPORTED_MAJOR) {
        return fail(
            "unsupported-major",
            `The file has format version ${root.formatVersion}; this calculator supports version ${SUPPORTED_FORMAT_VERSION} and older minor versions of major ${SUPPORTED_MAJOR}.`,
        );
    }
    const generator = root.generator;
    if (!isPlainObject(generator) || typeof generator.name !== "string" || generator.name === "") {
        return fail("missing-generator-name", "The file has no generator.name.");
    }
    if (!Array.isArray(root.islands)) return fail("missing-islands", "The file has no islands array.");
    const ids = new Set<string>();
    const islands: Record<string, unknown>[] = [];
    for (let i = 0; i < root.islands.length; i++) {
        const isl: unknown = root.islands[i];
        if (!isPlainObject(isl)) return fail("invalid-island", `islands[${i}] is not an object.`);
        if (typeof isl.id !== "string" || isl.id === "") return fail("missing-island-id", `islands[${i}] has no id.`);
        if (ids.has(isl.id)) return fail("duplicate-island-id", `The island id ${JSON.stringify(isl.id)} appears more than once.`);
        ids.add(isl.id);
        islands.push(isl);
    }

    const reader = new Reader();
    let computed: Computed | undefined;
    if (root.computed !== undefined) {
        if (isPlainObject(root.computed)) computed = root.computed as Computed;
        else reader.problem("/computed", "wrong-type", `expected object, got ${describe(root.computed)}; value dropped`);
        delete root.computed;
    }

    // Documents keep islands outside the generic walk so that each island carries its own scope.
    const islandList = root.islands;
    delete root.islands;
    reader.walk(root, DOCUMENT_SHAPE, "", "document");
    root.islands = islandList;
    islands.forEach((isl, i) => {
        reader.walk(isl, ISLAND_SHAPE, `/islands/${i}`, String(isl.id));
    });
    reader.checkItems(root, islands);

    const result: ReadResult = {
        doc: root as unknown as ExchangeDocument,
        unknown: reader.unknown,
        problems: reader.problems,
    };
    if (computed !== undefined) result.computed = computed;
    return result;
}
