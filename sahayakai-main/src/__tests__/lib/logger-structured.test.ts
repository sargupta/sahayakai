/**
 * @jest-environment node
 */
/**
 * Class gate for the 2026-09-11 "errors are unfindable in Log Explorer" defect.
 *
 * `console.error(prefix, errorObject)` makes Node pretty-print the Error with
 * util.inspect: the message and every stack frame land on separate lines.
 * Cloud Run ingests stdout line by line, so one failure became a dozen
 * entries, each with no severity and no message field. Querying
 * `severity>=ERROR` returned request logs with empty payloads and none of the
 * actual errors. The billing reconciliation job failed 104 times across four
 * days and the reason was effectively unfindable.
 *
 * The gate asserts the CLASS: on the server in production, every log event is
 * exactly one line of valid JSON carrying a Cloud Logging severity — whatever
 * is passed to it, including Errors with multi-line stacks and unserialisable
 * payloads.
 */
// The logger ships a copy of each entry to the Cloud Logging API as well as
// stdout. That is irrelevant to this gate and would leave an open handle.
jest.mock('@google-cloud/logging', () => ({
    Logging: class { log() { return { entry: () => ({}), write: async () => undefined }; } },
}), { virtual: true });

const ORIGINAL_ENV = process.env.NODE_ENV;

function loadLoggerAsProdServer() {
    jest.resetModules();
    // NODE_ENV is readonly in the Next types; the runtime value is what the
    // logger branches on.
    (process.env as Record<string, string>).NODE_ENV = "production";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/lib/logger").logger as typeof import("@/lib/logger").logger;
}

describe("logger structured output (server, production)", () => {
    let errSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let infoSpy: jest.SpyInstance;

    beforeEach(() => {
        errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (process.env as Record<string, string>).NODE_ENV = ORIGINAL_ENV as string;
    });

    const onlyCall = (spy: jest.SpyInstance) => {
        expect(spy).toHaveBeenCalledTimes(1);
        const args = spy.mock.calls[0];
        // Exactly one argument: more than one and Node formats them apart,
        // which is how the multi-line dump happened.
        expect(args).toHaveLength(1);
        return args[0] as string;
    };

    it("emits one single-line JSON record for an error, stack included", () => {
        const logger = loadLoggerAsProdServer();
        const err = new Error("Reconciliation completed with errors");
        logger.error("Billing reconciliation run-42 failed", err, "BILLING_RECON_ALERT");

        const line = onlyCall(errSpy);
        expect(line.split("\n")).toHaveLength(1);

        const parsed = JSON.parse(line);
        expect(parsed.severity).toBe("ERROR");
        expect(parsed.message).toContain("Billing reconciliation run-42 failed");
        expect(parsed.message).toContain("Reconciliation completed with errors");
        expect(parsed.context).toBe("BILLING_RECON_ALERT");
        // Error Reporting reads stack_trace; it must not be loose on stdout.
        expect(typeof parsed.stack_trace).toBe("string");
        expect(parsed.stack_trace).toContain("Error: Reconciliation completed with errors");
    });

    it.each([
        ["warn", "WARNING"],
        ["info", "INFO"],
    ])("maps %s to Cloud Logging severity %s", (method, severity) => {
        const logger = loadLoggerAsProdServer();
        const spy = method === "warn" ? warnSpy : infoSpy;
        (logger as unknown as Record<string, (m: string, c?: string) => void>)[method]("hello", "CTX");
        const parsed = JSON.parse(onlyCall(spy));
        expect(parsed.severity).toBe(severity);
        expect(parsed.message).toBe("hello");
    });

    it("survives an unserialisable payload rather than losing the event", () => {
        const logger = loadLoggerAsProdServer();
        const circular: Record<string, unknown> = { name: "loop" };
        circular.self = circular;
        logger.error("boom", new Error("inner"), "CTX", circular);

        const parsed = JSON.parse(onlyCall(errSpy));
        expect(parsed.severity).toBe("ERROR");
        expect(parsed.message).toContain("boom");
        expect(parsed.dataOmitted).toBe("unserialisable");
    });

    it("does not also emit the human-readable line, which would double every entry", () => {
        const logger = loadLoggerAsProdServer();
        logger.error("once", new Error("x"));
        expect(errSpy).toHaveBeenCalledTimes(1);
    });

    it("keeps a non-Error thrown value instead of dropping it", () => {
        const logger = loadLoggerAsProdServer();
        logger.error("string failure", "ECONNRESET", "NET");
        const parsed = JSON.parse(onlyCall(errSpy));
        expect(parsed.error).toBe("ECONNRESET");
    });
});
