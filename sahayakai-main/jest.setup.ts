import '@testing-library/jest-dom';
import 'whatwg-fetch'; // Polyfill fetch
import React from 'react';

// Polyfill TextEncoder/TextDecoder for jsdom env (Node has them globally,
// but jsdom strips them — needed by transitive imports in some Server Action files).
import { TextEncoder, TextDecoder } from 'util';
if (typeof (global as any).TextEncoder === 'undefined') {
    (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
    (global as any).TextDecoder = TextDecoder;
}

// Polyfill Response, Request, Headers for Node environment
global.Response = class Response {
    constructor(body?: any, init?: any) {
        return {
            ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
            status: init?.status || 200,
            json: () => Promise.resolve(JSON.parse(body || '{}')),
            text: () => Promise.resolve(body || ''),
            headers: new Map(),
        } as any;
    }
    static json(data: any, init?: any) {
        const body = JSON.stringify(data);
        return {
            ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
            status: init?.status || 200,
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(body),
            headers: new Map(),
        };
    }
} as any;

global.Request = class Request {
    constructor(input: any, init?: any) {
        return {
            url: input,
            method: init?.method || 'GET',
            headers: new Map(),
        } as any;
    }
} as any;

global.Headers = class Headers extends Map { } as any;

// Mock scrollIntoView
if (typeof window !== 'undefined') {
    Element.prototype.scrollIntoView = jest.fn();
}

// Mock IntersectionObserver
const observe = jest.fn();
const unobserve = jest.fn();
const disconnect = jest.fn();

if (typeof window !== 'undefined') {
    window.IntersectionObserver = jest.fn(() => ({
        observe,
        unobserve,
        disconnect,
    })) as any;
}


// Mock ResizeObserver
if (typeof window !== 'undefined') {
    window.ResizeObserver = jest.fn(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
    })) as any;
}


// Mock window.matchMedia
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(), // deprecated
            removeListener: jest.fn(), // deprecated
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
}


// Mock performance API
const performanceMock = {
    getEntriesByType: jest.fn().mockReturnValue([]),
    now: jest.fn().mockReturnValue(Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    timeOrigin: Date.now(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    toJSON: jest.fn(),
};

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'performance', {
        writable: true,
        value: performanceMock,
    });
}


Object.defineProperty(global, 'performance', {
    writable: true,
    value: performanceMock,
});

global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    takeRecords: jest.fn(),
})) as any;

(global.PerformanceObserver as any).supportedEntryTypes = [];



// Mock Canvas context
if (typeof window !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn(),
        setTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        measureText: jest.fn().mockReturnValue({ width: 0 }),
        transform: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
    });
}

// ─── Global mocks shared across suites ────────────────────────────────────────
//
// These mocks live in setup so individual test files don't have to declare
// them. Test files that need different behaviour can still call `jest.mock()`
// at the top of the file — that overrides setup-level mocks because module
// mocks declared in a test file are hoisted ABOVE setup execution.

// `firebase-admin` (and its `jwks-rsa` → `jose` ESM transitive) blows up at
// import time with `Unexpected token 'export'` under Jest's CJS transform.
// Tests that need to assert on firebase-admin behaviour mock it themselves;
// every other test gets a no-op shim so importing the module doesn't crash.
jest.mock('firebase-admin', () => ({
    apps: [],
    initializeApp: jest.fn(),
    credential: {
        cert: jest.fn(),
        applicationDefault: jest.fn(),
    },
    firestore: jest.fn(() => ({ collection: jest.fn() })),
    auth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
    storage: jest.fn(() => ({ bucket: jest.fn() })),
}), { virtual: false });

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({ collection: jest.fn() })),
    FieldValue: {
        serverTimestamp: jest.fn(),
        increment: jest.fn((n: number) => ({ __increment: n })),
        arrayUnion: jest.fn((...vals: any[]) => ({ __arrayUnion: vals })),
        arrayRemove: jest.fn((...vals: any[]) => ({ __arrayRemove: vals })),
        delete: jest.fn(() => ({ __delete: true })),
    },
    Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date(), seconds: 0, nanoseconds: 0 })),
        fromDate: jest.fn((d: Date) => ({ toDate: () => d, seconds: d.getTime() / 1000, nanoseconds: 0 })),
    },
}), { virtual: false });

jest.mock('firebase-admin/auth', () => ({
    getAuth: jest.fn(() => ({
        verifyIdToken: jest.fn(),
        getUser: jest.fn(),
        createUser: jest.fn(),
    })),
}), { virtual: false });

jest.mock('firebase-admin/storage', () => ({
    getStorage: jest.fn(() => ({ bucket: jest.fn() })),
}), { virtual: false });

// `@/lib/firebase-admin` is the project's lazy initializer. Stub it so route
// tests don't trigger Secret Manager / network at import-time.
jest.mock('@/lib/firebase-admin', () => ({
    initializeFirebase: jest.fn(async () => undefined),
    getDb: jest.fn(async () => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(async () => ({ exists: false, data: () => ({}) })),
                set: jest.fn(async () => undefined),
                update: jest.fn(async () => undefined),
                delete: jest.fn(async () => undefined),
            })),
            where: jest.fn(() => ({ get: jest.fn(async () => ({ docs: [] })) })),
            add: jest.fn(async () => ({ id: 'mock-id' })),
        })),
        runTransaction: jest.fn(async (fn: any) => fn({
            get: jest.fn(async () => ({ exists: false, data: () => ({}) })),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        })),
        batch: jest.fn(() => ({
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            commit: jest.fn(async () => undefined),
        })),
    })),
    getAuthInstance: jest.fn(async () => ({
        verifyIdToken: jest.fn(async () => ({ uid: 'mock-uid' })),
        getUser: jest.fn(),
    })),
    getStorageInstance: jest.fn(async () => ({ bucket: jest.fn() })),
}));

// `firebase/database` is used by the presence-dot component and the typing
// indicator. Tests that don't mock it explicitly get a no-op so `ref()`,
// `onValue()`, `remove()`, etc. never crash.
jest.mock('firebase/database', () => ({
    getDatabase: jest.fn(() => ({})),
    ref: jest.fn(() => ({})),
    onValue: jest.fn(() => jest.fn()),
    off: jest.fn(),
    set: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    push: jest.fn(() => ({ key: 'mock-key' })),
    child: jest.fn(() => ({})),
    get: jest.fn(async () => ({ exists: () => false, val: () => null })),
    onDisconnect: jest.fn(() => ({
        set: jest.fn(async () => undefined),
        update: jest.fn(async () => undefined),
        remove: jest.fn(async () => undefined),
        cancel: jest.fn(async () => undefined),
    })),
    serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
}));

// `@/context/language-context`: components have grown `useLanguage()` calls.
// Provide a stub so tests don't have to wrap every render in a provider.
jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({
        language: 'English',
        setLanguage: jest.fn(async () => undefined),
        t: (key: string) => key,
        isLoaded: true,
    }),
    LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// `idb` (used by the offline message outbox via `@/lib/indexed-db`) requires
// a real `indexedDB` global. jsdom doesn't provide one, so importing the
// module crashes the entire test process. Stub it to a no-op object store.
jest.mock('idb', () => {
    const makeStore = () => ({
        get: jest.fn(async () => undefined),
        getAll: jest.fn(async () => []),
        put: jest.fn(async () => undefined),
        add: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
        clear: jest.fn(async () => undefined),
        index: jest.fn(() => ({
            get: jest.fn(async () => undefined),
            getAll: jest.fn(async () => []),
        })),
    });
    const fakeDB = {
        get: jest.fn(async () => undefined),
        getAll: jest.fn(async () => []),
        put: jest.fn(async () => undefined),
        add: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
        clear: jest.fn(async () => undefined),
        getAllFromIndex: jest.fn(async () => []),
        getFromIndex: jest.fn(async () => undefined),
        transaction: jest.fn(() => ({
            store: makeStore(),
            done: Promise.resolve(),
            objectStore: jest.fn(() => makeStore()),
        })),
        close: jest.fn(),
    };
    return {
        openDB: jest.fn(async () => fakeDB),
        deleteDB: jest.fn(async () => undefined),
        unwrap: jest.fn((x: any) => x),
        wrap: jest.fn((x: any) => x),
    };
});
