# Confusing Error Messages When Pipe Dependencies Are Missing in Tests

> **Minimal reproduction for NestJS issue:** When using parameter decorators with pipes that have injected dependencies, missing dependencies in test modules produce misleading error messages.

## Issue Description

When using a custom parameter decorator with a pipe that has injected dependencies (via `@Inject(REQUEST)` or other providers), and those dependencies are not properly provided in the **test module**, NestJS produces misleading error messages that point to unrelated code locations rather than indicating the actual problem: missing providers for the pipe.

**Key Finding:** This issue is **specific to the testing environment with pipes in decorators**. NestJS provides helpful error messages in all other scenarios.

## Current Behavior (Confusing)

When a pipe's constructor dependency isn't provided in a test module, the error message:
1. Points to a seemingly random line in the controller (often where the result is first used)
2. Shows generic errors like `TypeError: Cannot read properties of undefined (reading 'xyz')`
3. Provides no indication that a provider is missing
4. Makes debugging extremely difficult, especially in large codebases

### Example Error Message

```
TypeError: Cannot read properties of undefined (reading 'assign')

  at MyController.getData (my.controller.ts:17:17)
  at Object.<anonymous> (my.controller.spec.ts:44:22)
```

This error points to `logger.assign()` - a completely unrelated line! It doesn't mention that `GetUserPipe` needs `REQUEST`, or that `REQUEST` is missing from the test providers.

## Expected Behavior (Helpful)

The error should clearly indicate:
1. That a pipe's dependency is missing
2. Which pipe needs the dependency  
3. What dependency token is missing
4. Where in the test setup to add the missing provider

### Example Expected Error Message

```
Error: Cannot instantiate pipe 'GetUserPipe' in parameter decorator
  Missing required provider: REQUEST (via @Inject(REQUEST))
  
  Required by: GetUserPipe (user.decorator.ts:8)
  Used in: MyController.getData (my.controller.ts:15)
  Test file: my.controller.spec.ts
  
Suggestion: Provide both the pipe and its dependencies:
  
  providers: [
    GetUserPipe,
    {
      provide: REQUEST,
      useValue: { /* mock request object */ }
    }
  ]
  
Or override the pipe in your test:
  
  .overridePipe(GetUserPipe)
  .useValue({ transform: jest.fn() })
```

## Testing Matrix: When Does This Occur?

We tested various scenarios to identify when the confusing error happens:

| Scenario | Environment | Error Quality | Example Error |
|----------|-------------|---------------|---------------|
| **Pipe dependency missing** | Testing | ❌ **Confusing** | `TypeError: Cannot read properties of undefined (reading 'assign')` at unrelated line |
| **Service dependency missing** | Testing | ✅ **Clear** | `Nest can't resolve dependencies of UserService (?)...` |
| **Pipe dependency missing** | Live/Bootstrap | ✅ **Clear** | `Nest can't resolve dependencies of GetUserPipe (?)...` |
| **Service dependency missing** | Live/Bootstrap | ✅ **Clear** | `Nest can't resolve dependencies of UserService (?)...` |

**Conclusion:** The confusing error **only occurs** when:
1. Using a pipe with injected dependencies
2. In a parameter decorator
3. Within the Jest/NestJS testing module
4. The dependency is missing from providers

In all other scenarios (live app, regular services), NestJS provides clear, helpful error messages during module compilation.

## Minimal Reproduction

```bash
git clone https://github.com/mnalsup/reproduce-undefined-injects.git
cd reproduce-undefined-injects
npm install
npm test
```

You'll see:
- ❌ `my.controller.spec.ts` fails with confusing error pointing to `logger.assign()`
- ✅ `my.controller.fixed.spec.ts` passes with proper mocks

### Key Files

- `user.decorator.ts` - A decorator with a pipe that injects `REQUEST` (30 lines)
- `my.controller.ts` - A controller using the decorator (23 lines)
- `my.controller.spec.ts` - **Broken test** (missing REQUEST mock)
- `my.controller.fixed.spec.ts` - **Working test** (with proper mocks)

## Root Cause Analysis

When NestJS's testing module instantiates a controller with parameter decorators:
1. The pipe is instantiated with its dependencies during test module compilation
2. If a dependency is missing, it's set to `undefined` (no compilation error!)
3. The test begins and the pipe executes during parameter decoration
4. When the pipe tries to access properties on `undefined`, it throws at runtime
5. The error stack trace points to where the undefined value is first used, not where the pipe dependency is missing

This differs from regular services where NestJS detects missing dependencies during module compilation and throws a clear error before any code executes.

### Why Only in Tests?

The key difference is that in the **live application**, NestJS validates all dependencies during bootstrap and throws clear errors. However, in the **testing environment** with pipes in decorators:

1. Pipes used in decorators are instantiated lazily during test execution
2. The test module compiler doesn't validate pipe dependencies the same way it validates service dependencies
3. The error only manifests when the pipe actually executes and tries to use `undefined`

## The Fix

### Option 1: Provide the pipe and its dependencies

```typescript
import { REQUEST } from '@nestjs/core';
import { GetUserPipe } from './user.decorator';

providers: [
  GetUserPipe,
  {
    provide: REQUEST,
    useValue: {
      headers: { 'x-user-id': '1' },
    },
  },
]
```

### Option 2: Override the pipe entirely

```typescript
.overridePipe(GetUserPipe)
.useValue({
  transform: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
})
```

This avoids needing to provide `REQUEST` at all since you're replacing the pipe implementation.

## Impact

This issue significantly impacts developer experience **specifically in testing**:
- Wastes hours debugging misleading error messages in tests
- Makes it difficult to adopt pipes with DI in projects due to confusing test setup
- Creates confusion for developers new to NestJS testing who try to use decorators with pipes
- The real issue (missing provider) is completely obscured
- Only happens in tests, making it even more confusing (works in dev, fails in tests with unclear errors)

## Proposed Solutions

### Solution 1: Eager Validation (Recommended)
During test module compilation, eagerly validate that all pipe dependencies (including those in parameter decorators) are available, just like regular service dependencies. This would catch the error at compile time with a clear message.

### Solution 2: Better Runtime Error Context
When a pipe throws an error during execution in tests, wrap it with context about:
- Which pipe failed
- What dependencies it requires
- Where it's being used (which decorator, which parameter)

### Solution 3: Documentation
Add prominent documentation about properly mocking pipe dependencies in tests, especially for pipes used in parameter decorators.

## Environment

- NestJS version: ^10.0.0
- Node version: 20.x
- Testing framework: Jest 29.x
- TypeScript version: ^5.0.0

## Additional Context

This issue is particularly problematic when:
- Using third-party libraries that provide decorators with pipes
- Working with complex authentication/authorization flows that use custom decorators
- Onboarding new developers who aren't familiar with NestJS's DI in test contexts
- Migrating from one decorator pattern to another (e.g., switching from guards to decorator-based approaches)
- The pipe works perfectly in the live app but fails mysteriously in tests

### Real-World Impact

We encountered this when adopting a third-party SDK that provided a user decorator with pipes. The app worked fine in development, but tests failed with:

```
TypeError: Cannot read properties of undefined (reading 'assign')
  at MyController.someMethod (my.controller.ts:17:17)
```

It took significant debugging time to realize we needed to mock `REQUEST` and other services for the pipe, because the error pointed to a completely unrelated line in our controller logic.

### Comparison with Regular Services

For contrast, when we tested the **same scenario with a regular service** instead of a pipe:

```typescript
// UserService depends on LoggerService
// Test forgets to provide LoggerService
```

NestJS immediately threw a helpful error during test compilation:
```
Nest can't resolve dependencies of the UserService (?). 
Please make sure that the argument LoggerService at index [0] is available in the RootTestModule context.
```

This is the quality of error message we'd like to see for pipes in decorators as well.

---

**To submit this issue to NestJS:** Copy this README content to https://github.com/nestjs/nest/issues/new and link to this reproduction repository.
