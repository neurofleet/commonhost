// run this file with
// bash: (out of src1)
// npm run build && node ts-js-out/utilities/reactive/subject.spec.js
// old ps: (out of src1)
// npm run build; node ts-js-out/utilities/reactive/subject.spec.js

import { assert } from "../testutilities/assert.js";
import { it } from "../testutilities/it.js";
import { describe, } from "../testutilities/describe.js";
import { Subject } from "./subject.js";

describe('Subject', () => {

    it('should be able to subscribe and unsubscribe', () => {
        const subject = new Subject<number>();
        let count = 0;
        const observer = subject.subscribe(value => count = value);
        subject.next(1);
        assert(count === 1, 'should have received value');
        observer.unsubscribe();
        subject.next(2);
        assert(count === 1, 'should not have received value');
    });

    it('should be able to subscribe and unsubscribe with error', () => {
        const subject = new Subject<number>();
        let count = 0;
        let errorCount = 0;
        const observer = subject.subscribe(
            value => count = value,
            error => errorCount = error
        );
        subject.next(1);
        assert(count === 1, 'should have received value');
        subject.error(2);
        assert(errorCount === 2, 'should have received error');
        observer.unsubscribe();
        subject.next(3);
        assert(count === 1, 'should not have received value');
        subject.error(4);
        assert(errorCount === 2, 'should not have received error');
    });

    it('should be able to subscribe and unsubscribe with complete', () => {
        const subject = new Subject<number>();
        let count = 0;
        let completeCount = 0;
        const observer = subject.subscribe(
            value => count = value,
            undefined,
            () => completeCount++
        );
        subject.next(1);
        assert(count === 1, 'should have received value');
        subject.complete();
        assert(completeCount === 1, 'should have received complete');
        observer.unsubscribe();
        subject.next(2);
        assert(count === 1, 'should not have received value');
        subject.complete();
        assert(completeCount === 1, 'should not have received complete');
    });

    it('should be able to pipe', () => {
        const subject = new Subject<number>();
        let count = 0;
        const piped = subject.pipe(value => value * 2);
        piped.subscribe(value => count = value);
        subject.next(1);
        assert(count === 2, 'should have received value');
        subject.next(2);
        //@ts-ignore, we are measuring side effects.
        assert(count === 4, 'should have received value');
    });

    it('should be able to pipe and unsubscribe', () => {
        const subject = new Subject<number>();
        let count = 0;
        const piped = subject.pipe(value => value * 2);
        const observer = piped.subscribe(value => count = value);
        subject.next(1);
        assert(count === 2, 'should have received value');
        observer.unsubscribe();
        subject.next(2);
        assert(count === 2, 'should not have received value');
    });

    it('should be able to pipe and propagate errors', () => {
        const subject = new Subject<number>();
        let count = 0;
        let propagatedError = undefined;
        const piped = subject.pipe(value => {throw new Error('test error')});
        piped.subscribe(
            value => count = value,
            error => propagatedError = error
        );
        subject.next(1);
        assert(propagatedError !== undefined, 'should have received error');
        assert(propagatedError as any instanceof Error, 'should have received error');
    });

    it('should not execute pipe function if no subscribers but data is sent', () => {
        const subject = new Subject<number>();
        let count = 0;
        const piped = subject.pipe(value => {
            count = value;
            return value * 2;
        });
        subject.next(1);
        assert(count === 0, 'should not have received value');
        piped.subscribe(value => count = value);
        subject.next(2);
        //@ts-ignore, we are measuring side effects.
        assert(count === 4, 'should have received value');
    });

    it('should not execute deep pipe function trees if no subscribers but data is sent', () => {
        const subject = new Subject<number>();
        const counts = [0, 0, 0];
        const outputCounts = [0, 0, 0];
        const makePipeFn = (writeToIdx: number, multiplyBy: number ) => {
            return (value: number) => {
                //debug console.log("pipe", writeToIdx, "value", value);
                counts[writeToIdx] = value;
                return value * multiplyBy;
            }
        };
        const piped_0_1 = subject.pipe(makePipeFn(0, 2));
        const piped_1_2 = piped_0_1.pipe(makePipeFn(1, 3));
        const piped_2_3 = piped_1_2.pipe(makePipeFn(2, 4));
        assert(subject.__getActiveConsumerCount() === 0, 'should not have any observers');
        subject.next(1);
        assert(counts[0] === 0 as any, 'should not have received value');
        const observer_2_3_0 = piped_2_3.subscribe(value => outputCounts[2] = value);
        subject.next(1);
        assert(counts[0] === 1, 'should have received value');
        const observer_1_2_0 = piped_1_2.subscribe(value => outputCounts[2] = value);
        assert(subject.__getActiveConsumerCount() === 1, 'should have effectively one observer');
        assert((piped_1_2 as Subject<number>).__getActiveConsumerCount() === 2, 'should have effectively two observer');
        subject.next(1);
        assert(counts[0] === 1, 'should have received value');
        observer_2_3_0.unsubscribe();
        observer_1_2_0.unsubscribe();
        assert(subject.__getActiveConsumerCount() === 0, 'should not have any observers');
        subject.next(1);
        assert(counts[0] === 1, 'should not have received value');
    });

});
