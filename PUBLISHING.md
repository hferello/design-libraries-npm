# Publishing and Updating the Package

This project is published to GitHub Packages as:

- `@hferello/design-libraries-npm`
- Registry: `https://npm.pkg.github.com`

## Prerequisites

- You are logged in to GitHub Packages with a classic PAT that has `write:packages` and `read:packages`.
- Your `.npmrc` contains:

```ini
@hferello:registry=https://npm.pkg.github.com
```

## Release workflow

1. Make your changes.
2. Verify locally:

```bash
npm run build
npm run verify
npm pack --dry-run
```

3. Bump the package version:

- Patch (bug fixes): `npm version patch`
- Minor (new backward-compatible features): `npm version minor`
- Major (breaking changes): `npm version major`

4. Publish:

```bash
npm publish
```

## Notes

- You cannot publish the same version twice.
- `prepack` runs automatically during publish and builds all token outputs.
- If publish fails before upload completes, fix the issue and retry.
- Keep release notes/changelog so consumers can see what changed.
