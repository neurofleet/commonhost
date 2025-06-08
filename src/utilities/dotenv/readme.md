# Dotenv

## What is Dotenv?

Dotenv is a utility that loads environment variables from a `.env` file into `process.env`.

## How to use Dotenv?

### Initialize

Call `initialize()` in your `main.ts` file. This will load the `.env` file into `process.env`.

```typescript
import { initialize } from './dotenv';

initialize();
```

#### Alternate .env file path

You can specify a different path to the `.env` file by passing it as an argument to `initialize()`.

```typescript
import { initialize } from './dotenv';

initialize('/path/to/my/.env/file');
```

### Load Variables

Call `load()` to load a variable from the `.env` file or from `process.env`. If the variable is not found in the `.env` file, it will be loaded from `process.env`. If the variable is not found in `process.env` either, an error will be thrown.

```typescript
import { load } from './dotenv';

const myVariable = load('MY_VARIABLE');
```

### Load Variables with a Default Value

You can also pass a default value to `load()` as a second argument. If the variable is not found in the `.env` file or in `process.env`, the default value will be returned.

```typescript
import { load } from './dotenv';

const myVariable = load('MY_VARIABLE', 'default_value');
```

### Reload Variables

If you need to reload the `.env` file, you can call `reload()`. This is useful if you have changed the `.env` file and need to reload the variables.

```typescript
import { reload } from './dotenv';

reload();
```


