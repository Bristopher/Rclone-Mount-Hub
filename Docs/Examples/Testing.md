# Testing Guide

Complete guide for running tests in the OptionsMania project.

## Overview

This monorepo contains two test suites:
- **Backend (FastAPI)**: Python tests using pytest and unittest
- **Frontend (Next.js)**: JavaScript/TypeScript tests (to be implemented)

## Backend Testing

### Test Framework

We use Python's built-in `unittest` framework with `unittest.IsolatedAsyncioTestCase` for async test support. Tests are run using **pytest** which provides excellent support for unittest-based tests.

## Prerequisites

```bash
# Install dependencies (includes pytest)
uv sync

# Verify pytest is installed
uv run pytest --version
```

## Running Tests with pytest (Recommended)

pytest provides better test discovery, more informative output, and excellent unittest support.

### Basic Commands

```bash
# Run all tests
uv run pytest

# Run with verbose output
uv run pytest -v

# Run with very verbose output (shows test docstrings)
uv run pytest -vv

# Run and show print statements
uv run pytest -s

# Run and stop on first failure
uv run pytest -x
```

### Running Specific Tests

```bash
# Run specific test file
uv run pytest tests/api/db/test_adapters.py

# Run specific test class
uv run pytest tests/api/db/test_adapters.py::TestSQLiteAdapter

# Run specific test method
uv run pytest tests/api/db/test_adapters.py::TestSQLiteAdapter::test_connection

# Run tests matching pattern
uv run pytest -k "adapter"
uv run pytest -k "test_connection"
```

### Test Discovery

```bash
# Show all tests without running
uv run pytest --collect-only

# Show test structure
uv run pytest --collect-only -q
```

### Coverage Reports

```bash
# Run with coverage
uv run pytest --cov=apps

# Generate HTML coverage report
uv run pytest --cov=apps --cov-report=html

# View coverage report
# Open htmlcov/index.html in browser

# Coverage for specific module
uv run pytest --cov=apps.api.db --cov-report=term-missing

# Coverage with branch coverage
uv run pytest --cov=apps --cov-branch
```

### Parallel Execution

```bash
# Install pytest-xdist first
uv add pytest-xdist --dev

# Run tests in parallel (auto-detect CPU count)
uv run pytest -n auto

# Run with specific number of workers
uv run pytest -n 4
```

### Output Options

```bash
# Short test summary
uv run pytest --tb=short

# Show only failed tests
uv run pytest --tb=line

# Show local variables on failure
uv run pytest --tb=long --showlocals

# Quiet mode (less output)
uv run pytest -q

# Show passed tests
uv run pytest -v --tb=no
```

## Running Tests with unittest (Alternative)

While pytest is recommended, you can also run tests directly with unittest:

```bash
# Run all tests
uv run python -m unittest discover tests/

# Run specific test file
uv run python -m unittest tests.api.db.test_adapters

# Run with verbose output
uv run python -m unittest tests.api.db.test_adapters -v

# Run specific test class
uv run python -m unittest tests.api.db.test_adapters.TestSQLiteAdapter

# Run specific test method
uv run python -m unittest tests.api.db.test_adapters.TestSQLiteAdapter.test_connection
```

## Test Organization

```
tests/
├── api/
│   ├── db/
│   │   ├── test_adapters.py          # Database adapter tests
│   │   └── test_manager.py           # Database manager tests
│   ├── utils/
│   │   └── test_timekeeper.py          # Datetime utility tests
│   └── services/
│       └── finviz/screener/options/tickers/
│           └── test_repository.py    # Repository pattern tests
```

## Test Categories

### 1. Unit Tests

Test individual components in isolation.

```bash
# Run all unit tests
uv run pytest tests/

# Run adapter tests only
uv run pytest tests/api/db/test_adapters.py -v

# Run manager tests only
uv run pytest tests/api/db/test_manager.py -v

# Run datetime tests only
uv run pytest tests/api/utils/test_timekeeper.py -v

# Run repository tests only
uv run pytest tests/api/services/finviz/screener/options/tickers/test_repository.py -v
```

### 2. Integration Tests

Test multiple components working together.

```bash
# Run integration tests (when implemented)
uv run pytest tests/integration/ -v
```

### 3. End-to-End Tests

Test complete workflows.

```bash
# Run e2e tests (when implemented)
uv run pytest tests/e2e/ -v
```

## Writing Tests

### Basic unittest Test Structure

```python
import unittest

class TestMyFeature(unittest.TestCase):
    """Test suite for my feature."""

    def setUp(self):
        """Set up test fixtures before each test."""
        self.data = {"key": "value"}

    def tearDown(self):
        """Clean up after each test."""
        self.data = None

    def test_feature_works(self):
        """Test that feature works correctly."""
        result = my_feature(self.data)
        self.assertEqual(result, expected_value)

    def test_feature_handles_errors(self):
        """Test error handling."""
        with self.assertRaises(ValueError):
            my_feature(None)
```

### Async Test Structure

```python
import unittest

class TestAsyncFeature(unittest.IsolatedAsyncioTestCase):
    """Test suite for async feature."""

    async def asyncSetUp(self):
        """Set up async test fixtures."""
        self.conn = await create_connection()

    async def asyncTearDown(self):
        """Clean up async resources."""
        await self.conn.close()

    async def test_async_operation(self):
        """Test async operation."""
        result = await async_function()
        self.assertEqual(result, expected_value)
```

### Common Assertions

```python
# Equality
self.assertEqual(a, b)
self.assertNotEqual(a, b)

# Boolean
self.assertTrue(condition)
self.assertFalse(condition)

# None checks
self.assertIsNone(value)
self.assertIsNotNone(value)

# Membership
self.assertIn(item, container)
self.assertNotIn(item, container)

# Exceptions
self.assertRaises(ExceptionType, function, args)
with self.assertRaises(ExceptionType):
    function()

# Numeric comparisons
self.assertGreater(a, b)
self.assertLess(a, b)
self.assertGreaterEqual(a, b)
self.assertLessEqual(a, b)

# String matching
self.assertRegex(text, pattern)
self.assertStartsWith(text, prefix)  # Custom
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install uv
        uses: astral-sh/setup-uv@v1

      - name: Set up Python
        run: uv python install 3.11

      - name: Install dependencies
        run: uv sync

      - name: Run tests
        run: uv run pytest --cov=apps --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
```

## Debugging Tests

### Using pytest with pdb

```bash
# Drop into debugger on failure
uv run pytest --pdb

# Drop into debugger at start of test
uv run pytest --trace
```

### Using VSCode

Add to `.vscode/settings.json`:

```json
{
  "python.testing.pytestEnabled": true,
  "python.testing.unittestEnabled": false,
  "python.testing.pytestArgs": [
    "tests"
  ]
}
```

Then use VSCode's built-in test explorer.

## Test Best Practices

### 1. Test Naming

```python
def test_feature_does_something():
    """Test that feature does something specific."""
    pass

def test_feature_handles_edge_case():
    """Test edge case handling."""
    pass

def test_feature_raises_error_on_invalid_input():
    """Test error handling with invalid input."""
    pass
```

### 2. Test Independence

Each test should be independent and not rely on other tests:

```python
async def asyncSetUp(self):
    """Set up fresh state for each test."""
    self.db = await create_test_db()

async def asyncTearDown(self):
    """Clean up after each test."""
    await self.db.close()
```

### 3. Use Descriptive Assertions

```python
# Bad
self.assertTrue(len(results) == 3)

# Good
self.assertEqual(len(results), 3, "Expected 3 results")
```

### 4. Test One Thing

```python
# Bad - tests multiple things
def test_user_creation_and_login(self):
    user = create_user()
    self.assertIsNotNone(user)
    login(user)
    self.assertTrue(is_logged_in(user))

# Good - separate tests
def test_user_creation(self):
    user = create_user()
    self.assertIsNotNone(user)

def test_user_login(self):
    user = create_user()
    login(user)
    self.assertTrue(is_logged_in(user))
```

## Troubleshooting

### Import Errors

```bash
# Ensure PYTHONPATH is set
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Or run from project root
cd /path/to/OptionsMania
uv run pytest
```

### Async Test Failures

Make sure test class inherits from `unittest.IsolatedAsyncioTestCase`:

```python
class TestAsync(unittest.IsolatedAsyncioTestCase):
    async def test_something(self):
        await async_operation()
```

### Database Connection Issues

For tests requiring database:

```python
async def asyncSetUp(self):
    """Set up in-memory database."""
    self.db = SQLiteAdapter(database_path=":memory:")
    await self.db.connect()
```

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest unittest support](https://docs.pytest.org/en/stable/how-to/unittest.html)
- [unittest Documentation](https://docs.python.org/3/library/unittest.html)
- [unittest.IsolatedAsyncioTestCase](https://docs.python.org/3/library/unittest.html#unittest.IsolatedAsyncioTestCase)
- [uv Documentation](https://github.com/astral-sh/uv)

## Quick Reference - Backend

```bash
# Essential commands
uv run pytest                              # Run all tests
uv run pytest -v                           # Verbose output
uv run pytest -k "pattern"                 # Run tests matching pattern
uv run pytest --cov=apps                   # With coverage
uv run pytest --pdb                        # Debug on failure
uv run pytest -n auto                      # Parallel execution
uv run pytest --collect-only               # Show tests without running

# Coverage
uv run pytest --cov=apps --cov-report=html # Generate HTML report
uv run pytest --cov=apps --cov-report=term-missing  # Show missing lines

# Specific tests
uv run pytest tests/api/db/test_adapters.py::TestSQLiteAdapter::test_connection

# Stop on first failure
uv run pytest -x

# Show local variables on failure
uv run pytest --showlocals
```

---

## Frontend Testing

### Test Framework (To Be Implemented)

The Next.js frontend will use the following testing stack:
- **Unit Tests**: Vitest (fast, Vite-native test runner)
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright (headless browser testing)

### Prerequisites

```bash
cd web
pnpm install
```

### Running Tests (When Implemented)

```bash
# Run all tests
cd web
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run E2E tests in UI mode
pnpm test:e2e:ui
```

### Test Organization (Planned)

```
web/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   └── button.test.tsx      # Component tests next to components
│   │   ├── portfolio/
│   │   │   ├── portfolio-view.tsx
│   │   │   └── portfolio-view.test.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── utils.ts
│   │   └── utils.test.ts            # Utility tests
│   └── hooks/
│       ├── use-prices.ts
│       └── use-prices.test.ts       # Hook tests
├── tests/
│   ├── e2e/
│   │   ├── portfolio.spec.ts        # E2E tests for portfolio page
│   │   ├── bots.spec.ts             # E2E tests for bots page
│   │   └── orders.spec.ts           # E2E tests for orders page
│   └── fixtures/
│       └── mock-data.ts             # Shared test fixtures
├── vitest.config.ts                 # Vitest configuration
└── playwright.config.ts             # Playwright configuration
```

### Writing Frontend Tests (When Implemented)

#### Component Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('applies variant styles', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByText('Delete')
    expect(button).toHaveClass('bg-destructive')
  })
})
```

#### Hook Test Example

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { usePrices } from './use-prices'

describe('usePrices', () => {
  it('fetches prices for tickers', async () => {
    const { result } = renderHook(() => usePrices(['AAPL', 'MSFT']))

    await waitFor(() => {
      expect(result.current.prices.size).toBe(2)
    })

    expect(result.current.prices.get('AAPL')).toBeDefined()
    expect(result.current.prices.get('MSFT')).toBeDefined()
  })

  it('handles WebSocket updates', async () => {
    const { result } = renderHook(() => usePrices(['AAPL']))

    // Simulate WebSocket price update
    // (implementation depends on your WebSocket testing strategy)

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })
  })
})
```

#### E2E Test Example

```typescript
import { test, expect } from '@playwright/test'

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/portfolio')
  })

  test('displays account summary', async ({ page }) => {
    await expect(page.getByText('Total Value')).toBeVisible()
    await expect(page.getByText('Buying Power')).toBeVisible()
    await expect(page.getByText('Day P&L')).toBeVisible()
  })

  test('switches between accounts', async ({ page }) => {
    await page.getByRole('button', { name: 'Account 1' }).click()
    await page.getByRole('menuitem', { name: 'Account 2' }).click()

    await expect(page.getByText('Account 2')).toBeVisible()
  })

  test('loads positions table', async ({ page }) => {
    const table = page.getByRole('table')
    await expect(table).toBeVisible()

    const rows = page.getByRole('row')
    await expect(rows).not.toHaveCount(0)
  })
})
```

### VS Code Integration - Frontend

Add to `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "pnpm test",
  "playwright.reuseBrowser": true
}
```

### Recommended VS Code Extensions - Frontend

- **Vitest** (vitest.explorer) - Test explorer integration
- **Playwright Test** (ms-playwright.playwright) - E2E test runner

### Testing Best Practices - Frontend

1. **Test User Behavior, Not Implementation**
   ```typescript
   // Bad - tests implementation
   expect(component.state.isOpen).toBe(true)

   // Good - tests user-visible behavior
   expect(screen.getByRole('dialog')).toBeVisible()
   ```

2. **Use Mock Data Source for Tests**
   ```typescript
   // Set mock data source in test setup
   process.env.NEXT_PUBLIC_DATA_SOURCE = 'mock'
   ```

3. **Isolate Component Tests**
   ```typescript
   // Mock external dependencies
   vi.mock('@/data/streams/use-prices', () => ({
     usePrices: vi.fn(() => ({
       prices: new Map([['AAPL', { last: 150.00 }]]),
       isConnected: true
     }))
   }))
   ```

4. **Test Loading and Error States**
   ```typescript
   it('shows loading state', () => {
     render(<PositionsTable isLoading={true} />)
     expect(screen.getByRole('progressbar')).toBeVisible()
   })

   it('shows error message', () => {
     render(<PositionsTable error="Failed to load" />)
     expect(screen.getByText('Failed to load')).toBeVisible()
   })
   ```

### Quick Reference - Frontend

```bash
# Unit and component tests
cd web
pnpm test                              # Run all tests
pnpm test:watch                        # Watch mode
pnpm test:coverage                     # With coverage
pnpm test button.test.tsx              # Run specific test file

# E2E tests
pnpm test:e2e                          # Run all E2E tests
pnpm test:e2e:ui                       # Run with Playwright UI
pnpm test:e2e portfolio.spec.ts        # Run specific E2E test

# Debug
pnpm test --ui                         # Vitest UI mode
pnpm test:e2e --debug                  # Playwright debug mode
```

---

## Running All Tests

To run both backend and frontend tests:

```bash
# From project root

# Backend tests
uv run pytest --cov=apps

# Frontend tests (when implemented)
cd web && pnpm test

# Or use VS Code tasks
# Terminal > Run Task > "Test: All"
```
