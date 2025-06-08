import { Observable } from "./observable.js";

export type Observer = {
    unsubscribe: () => void;
};

type ObserverInternal<T> = {
    onData: (value: T) => void;
    onError: (error: any) => void;
    onComplete?: () => void;
};

export class Subject<T> {
    private observers = new Set<ObserverInternal<T>>();
    private activeConsumers = 0;
    private upstream?: Subject<any>;

    constructor() {}

    __incrementActiveConsumerCount() {
        this.activeConsumers++;
        if (this.activeConsumers === 1 && this.upstream) {
            this.upstream.__incrementActiveConsumerCount();
        }
    }
    __decrementActiveConsumerCount() {
        this.activeConsumers--;
        if (this.activeConsumers === 0 && this.upstream) {
            this.upstream.__decrementActiveConsumerCount();
        }
    }
    public subscribe(
        onData: (value: T) => void, 
        onError: (error: any) => void = (error) => console.error("Uncaught error in subject", error),
        onComplete: () => void = () => {}
    ): Observer {
        const observer = ({
            onData,
            onError,
            onComplete
        });
        this.observers.add(observer);
        this.__incrementActiveConsumerCount();
        return {
            unsubscribe: () => {
                this.observers.delete(observer)
                this.__decrementActiveConsumerCount();
            }
        };
    }
    __subscribePipe(
        onData: (value: T) => void, 
        onError: (error: any) => void = (error) => console.error("Uncaught error in subject", error),
        onComplete: () => void = () => {}
    ): Observer {
        const observer = ({
            onData,
            onError,
            onComplete
        });
        this.observers.add(observer);
        return {
            unsubscribe: () => {
                this.observers.delete(observer)
            }      
        };
    }


    public next(value: T) {
        this.observers.forEach(observer => observer.onData(value));}
    public error(error: any) {this.observers.forEach(observer => observer.onError?.(error));}
    public complete() {this.observers.forEach(observer => observer.onComplete?.());}

    public asObservable(): Observable<T> {return this;}

    public pipe<T2>(transform: (value: T) => T2): Observable<T2> {
        const subject = new Subject<T2>();
        subject.upstream = this;
        this.__subscribePipe(
            value => {
                if (subject.activeConsumers === 0) return;
                try {
                    subject.next(transform(value));
                } catch (error) {
                    subject.error(error);
                }
            },
            error => {
                    if (subject.observers.size === 0) return;
                    subject.error(error);
            },
            () => {
                    if (subject.observers.size === 0) return;
                    subject.complete();
            }
        );
        return subject;
    }

    public __getActiveConsumerCount() {
        return this.activeConsumers;
    }
}