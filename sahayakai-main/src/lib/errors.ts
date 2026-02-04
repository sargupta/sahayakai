export class BaseError extends Error {
    constructor(
        message: string,
        public errorCode: string,
        public context?: any
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            errorCode: this.errorCode,
            context: this.context,
            stack: this.stack
        };
    }
}

export class FlowExecutionError extends BaseError {
    constructor(message: string, context?: any) {
        super(message, 'AI-FLOW-001', context);
    }
}

export class SchemaValidationError extends BaseError {
    constructor(message: string, public validationErrors?: any) {
        super(message, 'AI-SCHEMA-001', { validationErrors });
    }
}

export class PersistenceError extends BaseError {
    constructor(message: string, public operation?: string) {
        super(message, 'DB-PERSIST-001', { operation });
    }
}

export class InputValidationError extends BaseError {
    constructor(message: string, public validationErrors?: any) {
        super(message, 'API-INPUT-001', { validationErrors });
    }
}

export class RateLimitError extends BaseError {
    constructor(message: string, public retryAfter?: number) {
        super(message, 'API-RATE-001', { retryAfter });
    }
}

export class AuthenticationError extends BaseError {
    constructor(message: string, context?: any) {
        super(message, 'AUTH-TOKEN-001', context);
    }
}

export class NetworkError extends BaseError {
    constructor(message: string, context?: any) {
        super(message, 'NET-CALL-001', context);
    }
}
