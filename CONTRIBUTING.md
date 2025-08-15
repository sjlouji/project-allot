# Contributing

Thank you for your interest in contributing to the Last-Mile Delivery Assignment Engine! This document provides guidelines for contributing.

## Code Standards

- **Language**: TypeScript 5.x with strict mode enabled
- **Style**: Follow project conventions (see existing code)
- **Comments**: Clear logic documentation for complex algorithms
- **Testing**: All features must include tests (jest)
- **Format**: Run `pnpm format` before submitting

## Getting Started

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Run tests: `pnpm test`
4. Run examples: `npx ts-node examples/food-delivery.ts`

## Making Changes

### For bug fixes:

1. Create a test that reproduces the bug
2. Fix the code
3. Verify the test passes
4. Submit a pull request

### For new features:

1. Open an issue to discuss the feature
2. Create tests for the feature
3. Implement the feature
4. Update documentation (if needed)
5. Submit a pull request

## Testing

All changes must include tests:

```bash
pnpm test                   # Run all tests
pnpm test --coverage        # Check coverage
```

Minimum coverage: 80%

## Documentation

When adding new features or changing behavior:

1. Update relevant documentation in `docs/`
2. Add code examples if applicable
3. Update the README if it's a major feature

## Opening Issues

When reporting bugs or requesting features, use the provided templates:

- **Bug Report**: Report unexpected behavior or errors
  - Include steps to reproduce
  - Provide minimal code example
  - Describe expected vs actual behavior

- **Feature Request**: Propose new functionality
  - Explain motivation and use case
  - Suggest implementation approach
  - Consider impact on existing code

Templates are automatically loaded when you create an issue on GitHub.

## Pull Request Process

1. Write clear, descriptive commit messages
2. Use the PR template (automatically loaded)
3. Include a summary of changes
4. Link related issues (e.g., `Closes #123`)
5. Ensure all tests pass (`pnpm test`)
6. Request review from maintainers

The PR template includes checklist items to ensure:
- Code follows conventions
- Tests are included and passing
- Documentation is updated
- No breaking changes (or documented if intentional)

## Code Review

When reviewing PRs, consider:

- Does it solve the stated problem?
- Are there tests covering the logic?
- Is the code readable and maintainable?
- Does it follow project conventions?
- Are there any edge cases?

## Architecture

The engine is organized into stages:

- **Stage 1**: Candidate Generation (`src/core/candidate-generation.ts`)
- **Stage 2**: Scoring (`src/core/scoring.ts`)
- **Stage 3**: Optimization (`src/core/optimizers.ts`)

Supporting modules:

- Batching & routing (`src/batching/`)
- ETA estimation (`src/eta/`)
- Surge detection (`src/surge/`)
- Configuration (`src/config/`)

See [Algorithms Deep Dive](./docs/algorithms.md) for technical details.

## Questions?

- Check the [Getting Started Guide](./docs/getting-started.md)
- Read the [Configuration Reference](./docs/configuration.md)
- Look at [Examples](./examples/README.md)
- Open an issue on GitHub

---

Thank you for contributing!
