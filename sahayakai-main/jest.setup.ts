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
