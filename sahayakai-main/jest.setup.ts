import '@testing-library/jest-dom';
import 'whatwg-fetch'; // Polyfill fetch
import React from 'react';

// Polyfill Response, Request, Headers for Node environment
global.Response = class Response {
    constructor(body?: any, init?: any) {
        return {
            ok: init?.status >= 200 && init?.status < 300,
            status: init?.status || 200,
            json: () => Promise.resolve(JSON.parse(body || '{}')),
            text: () => Promise.resolve(body || ''),
            headers: new Map(),
        } as any;
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

// Mock IntersectionObserver
const observe = jest.fn();
const unobserve = jest.fn();
const disconnect = jest.fn();

window.IntersectionObserver = jest.fn(() => ({
    observe,
    unobserve,
    disconnect,
})) as any;

// Mock ResizeObserver
window.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
})) as any;

// Mock window.matchMedia
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

Object.defineProperty(window, 'performance', {
    writable: true,
    value: performanceMock,
});

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


