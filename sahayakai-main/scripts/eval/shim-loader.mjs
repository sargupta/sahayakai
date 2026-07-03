export function resolve(specifier, context, next) {
    if (specifier === 'server-only') {
        return { shortCircuit: true, url: 'data:text/javascript,export {}' };
    }
    return next(specifier, context);
}
