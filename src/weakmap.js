/* @flow */

import { isWindow, isWindowClosed } from 'cross-domain-utils/src';

import { hasNativeWeakMap } from './native';
import { noop, safeIndexOf } from './util';

export class CrossDomainSafeWeakMap<K : Object, V : mixed> {

    name : string
    weakmap : WeakMap<K, V>
    keys : Array<K>
    values : Array<V>

    constructor() {
        // eslint-disable-next-line no-bitwise
        this.name = `__weakmap_${ Math.random() * 1e9 >>> 0 }__`;

        if (hasNativeWeakMap()) {
            try {
                this.weakmap = new WeakMap();
            } catch (err) {
                // pass
            }
        }

        this.keys  = [];
        this.values = [];
    }

    _cleanupClosedWindows() {

        let weakmap = this.weakmap;
        let keys = this.keys;

        for (let i = 0; i < keys.length; i++) {
            let value = keys[i];

            if (isWindow(value) && isWindowClosed(value)) {

                if (weakmap) {
                    try {
                        weakmap.delete(value);
                    } catch (err) {
                        // pass
                    }
                }

                keys.splice(i, 1);
                this.values.splice(i, 1);

                i -= 1;
            }
        }
    }

    isSafeToReadWrite(key : K) : boolean {

        if (isWindow(key)) {
            return false;
        }

        try {
            noop(key && key.self);
            noop(key && key[this.name]);
        } catch (err) {
            return false;
        }

        return true;
    }

    set(key : K, value : V) {

        if (!key) {
            throw new Error(`WeakMap expected key`);
        }

        let weakmap = this.weakmap;

        if (weakmap) {
            try {
                weakmap.set(key, value);
            } catch (err) {
                delete this.weakmap;
            }
        }

        if (this.isSafeToReadWrite(key)) {
            try {
                let name = this.name;
                let entry = key[name];

                if (entry && entry[0] === key) {
                    entry[1] = value;
                } else {
                    Object.defineProperty(key, name, {
                        value:    [ key, value ],
                        writable: true
                    });
                }

                return;

            } catch (err) {
                // pass
            }
        }

        this._cleanupClosedWindows();

        let keys = this.keys;
        let values = this.values;
        let index = safeIndexOf(keys, key);

        if (index === -1) {
            keys.push(key);
            values.push(value);
        } else {
            values[index] = value;
        }
    }

    get(key : K) : V | void {

        if (!key) {
            throw new Error(`WeakMap expected key`);
        }

        let weakmap = this.weakmap;

        if (weakmap) {
            try {
                if (weakmap.has(key)) {
                    return weakmap.get(key);
                }
                
            } catch (err) {
                delete this.weakmap;
            }
        }

        if (this.isSafeToReadWrite(key)) {
            try {
                let entry = key[this.name];

                if (entry && entry[0] === key) {
                    return entry[1];
                }

                return;
            } catch (err) {
                // pass
            }
        }

        this._cleanupClosedWindows();

        let keys = this.keys;
        let index = safeIndexOf(keys, key);

        if (index === -1) {
            return;
        }

        return this.values[index];
    }

    delete(key : K) {

        if (!key) {
            throw new Error(`WeakMap expected key`);
        }

        let weakmap = this.weakmap;

        if (weakmap) {
            try {
                weakmap.delete(key);
            } catch (err) {
                delete this.weakmap;
            }
        }

        if (this.isSafeToReadWrite(key)) {
            try {
                let entry = key[this.name];

                if (entry && entry[0] === key) {
                    entry[0] = entry[1] = undefined;
                }
            } catch (err) {
                // pass
            }
        }

        this._cleanupClosedWindows();

        let keys = this.keys;
        let index = safeIndexOf(keys, key);

        if (index !== -1) {
            keys.splice(index, 1);
            this.values.splice(index, 1);
        }
    }

    has(key : K) : boolean {

        if (!key) {
            throw new Error(`WeakMap expected key`);
        }

        let weakmap = this.weakmap;

        if (weakmap) {
            try {
                if (weakmap.has(key)) {
                    return true;
                }
            } catch (err) {
                delete this.weakmap;
            }
        }

        if (this.isSafeToReadWrite(key)) {
            try {
                let entry = key[this.name];

                if (entry && entry[0] === key) {
                    return true;
                }

                return false;
            } catch (err) {
                // pass
            }
        }

        this._cleanupClosedWindows();

        let index = safeIndexOf(this.keys, key);
        return index !== -1;
    }

    getOrSet(key : K, getter : () => V) : V {
        if (this.has(key)) {
            // $FlowFixMe
            return this.get(key);
        }

        let value = getter();
        this.set(key, value);
        return value;
    }
}
