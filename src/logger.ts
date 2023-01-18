export interface Logger {
    error: typeof console.error
    log: typeof console.log
    debug: typeof console.debug
}

export const makeLogger = (debugLoggingOn: boolean): Logger => {
    return {
        error: console.error,
        log: console.log,
        debug: debugLoggingOn
            ? console.debug
            : () => {
                  /* no-op debug logging */
              },
    }
}
