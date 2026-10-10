# Contributing

Thanks for helping out!

- Fork the repository and open a pull request against `develop` (the default branch). `master` is the release branch.
- Keep pull requests small and focused. Describe what changes for the user.
- Run the checks from the README before pushing (`tsc`, tests, build). CI runs the same steps.
- Every user-visible text is an i18n key: add it to all locale files in `src/i18n/locales/` (`i18n.test.ts` checks this).
- Prefer generic solutions driven by API/gallery configs over special cases for a single source.
- Pull requests from forks are built and tested, but get no preview environment.

Changes that need the backend go into [martin-bett/mtgprint](https://github.com/martin-bett/mtgprint) as a separate pull request.
