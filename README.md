# nimiapp-inscape

Inscape helps adults explore Jungian personality patterns through daily observations and reflections, with data stored locally.

## The experience

Inscape is a private place to explore a lived moment, a difficult choice, or a relationship. A type code is an optional starting point; you can begin without one.

- **Today:** choose your inner weather, turn over an exploration card, or bring in a real moment. Save the note on its own or ask the local AI to explore it.
- **Inner roundtable:** hear eight cognitive-function perspectives on the same decision. Choose a voice to hear its perspective and question, consider another interpretation, and take one small experiment back into life.
- **Between us:** record your own observations of an adult relationship, compare tentative perspectives, revisit a misunderstanding, and explore clearer ways to express your needs.
- **About me:** explore a function map with explicit confidence, or search your field notes. Original words, structured AI readings, feedback, and experiments remain available after reopening.

AI readings retain their source context and can be reopened or individually deleted. Resonance feedback can be changed or withdrawn; type suggestions require their own explicit acceptance. Notes, shared moments, relationship details, and type references can be edited or removed. Failed saves retain the screen and offer retry without duplicating the operation. A reflection can propose a profile adjustment only when you request it, and the adjustment requires a separate acceptance. Each note contributes at most one reversible adjustment. Withdrawing its feedback or editing/deleting its source removes that contribution. Type and Beebe labels follow the current preference evidence and remain unset when it is uncertain. AI requests use the protected Nimi App Access client and a local text route. If the model is unavailable or returns an invalid exploration, the original note remains saved and the error is shown.

Start the desktop development app with `pnpm dev`. It requires Nimi Desktop and a local text model. To continue a specific existing local space, use `pnpm dev -- --list-registrations` and resume the corresponding selector with `pnpm dev -- --resume <selector>`.

The product uses a warm paper palette and a generated [inner landscape illustration](public/images/README.md). Layout previews under `.nimi/local/` are visual inspection artifacts, not the application or proof of working AI.

## Windows package and release

The production target is Windows x86_64 using Desktop-supervised Electron.
Build and inspect the package from this repository:

```bash
pnpm run sync
pnpm exec nimi-app check --production
pnpm exec nimi-app test
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

Before tagging, follow the [GitHub release setup guide](https://github.com/nimiplatform/nimi/blob/main/app-tools/README.md#publishing-on-github), including the `NIMI_REPOSITORY_ADMIN_TOKEN` Actions secret.
A protected annotated version tag on the repository default branch runs the managed build, provenance and immutable Release workflow.
The publisher then submits the immutable Release to [Nimi App Registry](https://github.com/nimiplatform/nimi-app-registry). Registry admission is a separate human review; local builds and GitHub Releases do not create admission or installed state.
