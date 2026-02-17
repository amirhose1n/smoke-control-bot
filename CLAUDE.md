# smokeControl

Backend API for smoke control system built with Node.js and Express.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript/TypeScript

## Project Structure

```
src/           - Application source code
  routes/      - Express route handlers
  controllers/ - Business logic controllers
  models/      - Data models
  middleware/  - Express middleware
  config/      - Configuration files
  utils/       - Utility functions
tests/         - Test files
```

## Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm start` - Start production server
- `npm test` - Run tests

## Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Keep route handlers thin; business logic goes in controllers
- Use async/await over callbacks
- Validate all incoming request data
- Return consistent JSON response format: `{ success, data, error }`
