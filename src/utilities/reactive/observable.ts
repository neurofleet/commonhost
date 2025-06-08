import { Observer } from "./subject.js";

export type Observable<T> = {
    subscribe: (
        onData: (value: T) => void, 
        onError?: (error: any) => void, 
        onComplete?: () => void
    ) => Observer;
    pipe<T2>(transform: (value: T) => T2): Observable<T2>;
};

