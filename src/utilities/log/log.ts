type Level = 'info' | 'warn' | 'error' | 'debug';



export function log(msg: string, level: Level) {
    switch(level) {
        case 'info':
            console.log(msg);
            break;
        case 'warn':
            console.warn(msg);
            break;
        case 'error':
            console.error(msg);
            break;
        case 'debug':
            console.debug(msg);
            break;
        default:
            throw new Error('Invalid log level');
    }
}