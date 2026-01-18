# Project Guidelines

## Code Quality

### No Magic Values
- All constants must be defined in `lib/constants.ts`
- Use descriptive names (e.g., `PAR_THRESHOLD` instead of `0.995`)
- Group related constants together with comments

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- No `any` type allowed (`@typescript-eslint/no-explicit-any: error`)
- Explicit return types required for functions
- Use `noUncheckedIndexedAccess` for safer array/object access

### Testability
- Functions must be independent and pure where possible
- Use Dependency Injection (DI) for external dependencies
- API clients passed as parameters, not imported directly
- Hooks accept optional `apiClient` parameter for mocking

### ESLint Rules
- No unused variables (prefix with `_` if intentionally unused)
- No console.log (use console.warn/error if needed)
- Prefer `const` over `let`
- React hooks exhaustive-deps enforced

## Architecture

### Data Sources
- **MOEX API**: Bond prices, coupons, YTM (real-time data)
- **CBR API**: Key rate history (cached 24h)
- **data/rate-scenarios.json**: Future rate forecasts (user-editable)

### No Hardcoded Data
- Bond data fetched from MOEX, not hardcoded presets
- Key rate from CBR API, not static values
- Rate scenarios stored in JSON, not in code

### Price/YTM Calculation
- Calculate dynamically using DCF formula
- No lookup tables - use `calculateBondPriceDCF()` and `estimateYTMFromKeyRate()`

## Project Structure

```
/app            - Next.js App Router pages and API routes
/components     - React components (client-side)
/hooks          - Custom React hooks with DI support
/lib            - Business logic, API clients, utilities
  /constants.ts - Centralized constants
  /calculations.ts - Bond calculation functions
  /api-client.ts - API client interface for DI
/types          - TypeScript type definitions
/data           - JSON data files (scenarios, etc.)
/__tests__      - Vitest tests
```

## Testing (Vitest)

- Tests in `__tests__/` or `*.test.ts` files
- Mock API clients for hook tests
- Test pure calculation functions with known inputs
- Use `describe` and `it` blocks

## Commits

- Russian or English commit messages acceptable
- Include Co-Authored-By for AI-assisted code
