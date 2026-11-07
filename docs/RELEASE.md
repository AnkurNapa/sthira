# Sthira release and maintenance

## Branches

- `main` is what the public sees. It deploys to GitHub Pages only after CI passes.
- Every change happens on a short branch such as `feat/flow-builder` or `fix/knee-filter`, then a pull request into `main`.
- A pull request merges only when `tools/check.sh` passes in CI.

## Versions

Semantic versions: `MAJOR.MINOR.PATCH`.
- PATCH for content fixes and bug fixes.
- MINOR for new features or new poses.
- MAJOR for changes that reset saved data.

Every release adds an entry to CHANGELOG.md and gets a git tag such as `v0.1.0`.

## Release checklist

1. `bash tools/check.sh` passes locally.
2. `CACHE_VERSION` in sw.js is bumped so visitors get the new files.
3. Any changed spoken line is recorded again with tools/voice_build.py.
4. New images, video or figures are listed in media/CREDITS.md or the footer credits.
5. The end to end pass in docs/TEST-PLAN.md is done with screenshots.
6. CHANGELOG.md is updated and the version tagged.
7. After deploy, the live site loads, the quiz completes and a session starts.

## Rollback

Revert the merge commit on `main` and push. Pages redeploys the previous version within minutes. Bump `CACHE_VERSION` again so offline visitors pick up the rollback.

## Maintenance

- Safety rules: any change to poses or CONDITIONS needs the safety review in the test plan.
- Content: new poses go in data.js with a figure if one exists, then the condition lists in plan.js.
- Licences: check the credits page whenever an asset is added or replaced.
- Dependencies: none at run time. The asset tools are pinned by commit in docs/DESIGN.md.
