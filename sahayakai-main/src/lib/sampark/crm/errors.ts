/**
 * Errors every CRM source adapter (REST, MCP, CSV) throws. The importer shows
 * `message` to the school admin for names matching /^(Crm|Csv|Import)/, so a
 * message here must NEVER carry a secret, a response body or a phone number.
 */

export class CrmUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CrmUrlError';
    }
}

export class CrmFetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CrmFetchError';
    }
}
