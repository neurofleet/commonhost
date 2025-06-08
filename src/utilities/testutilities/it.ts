export async function it(description: string, testFunction: () => void | Promise<void>) {
    try {
        await testFunction();
        // on success
        console.log('  \x1b[32m%s\x1b[0m', '  \u2713 ' + description);
    } catch (error) {
        // on error
        console.log('  \x1b[31m%s\x1b[0m', '  \u2717 ' + description);
        console.error(error);
    }
}