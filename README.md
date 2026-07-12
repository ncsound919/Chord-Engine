# Deterministic Chord Engine

A Steely Dan/Isley Brothers/Stevie Wonder inspired deterministic harmonic generator.

## Features
- Deterministic harmony generation
- Real-time audio engine
- Interactive transport controls

## Security & Maintenance
- **Security**: The application uses environment variables for sensitive configuration. Ensure `.env` is properly set up with necessary keys.
- **Maintenance**: All project logic is maintained directly in the source files. Ad-hoc patch scripts have been removed.

## Testing
The application includes a comprehensive test suite using Vitest.

To run the tests:
```bash
npm run test
```
All core components, hooks, and audio engine logic are covered by unit and smoke tests.
