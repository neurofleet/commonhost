export async function describe(description: string, testFunction: () => void | Promise<void>) {
    console.log("Running test suite: " + description);
    try {
        await testFunction();
    } catch (error) {
        // on error
        console.log('  \x1b[31m%s\x1b[0m', '  \u2717 ' + description);
        console.error(error);
    }
}