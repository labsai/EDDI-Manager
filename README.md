# EDDI Manager — moved to labsai/EDDI

> [!IMPORTANT]
> **This repository is archived and read-only.** The EDDI Manager now lives in the main EDDI
> repository, at **[`labsai/EDDI` → `ui/manager`](https://github.com/labsai/EDDI/tree/main/ui/manager)**.
> Its full commit history came with it. Nothing here is maintained any more.

The EDDI Manager is the admin dashboard for [EDDI](https://github.com/labsai/EDDI), the open-source
multi-agent orchestration middleware for conversational AI. It has always shipped inside the EDDI
Docker image. Since September 2026 it is also developed, tested and released there, in the same
repository as the backend it talks to.

**🌐 Website:** [eddi.technology](https://eddi.technology/) · **📖 Docs:** [docs.labs.ai](https://docs.labs.ai/) · **🐳 Docker:** [hub.docker.com/r/labsai/eddi](https://hub.docker.com/r/labsai/eddi)

---

## Where everything went

| You are looking for | It is now |
| --- | --- |
| The source | [`labsai/EDDI/ui/manager`](https://github.com/labsai/EDDI/tree/main/ui/manager) |
| The README: features, development, tech stack | [`ui/manager/README.md`](https://github.com/labsai/EDDI/blob/main/ui/manager/README.md) |
| How to contribute | [`ui/manager/CONTRIBUTING.md`](https://github.com/labsai/EDDI/blob/main/ui/manager/CONTRIBUTING.md) and the repository-wide [`CONTRIBUTING.md`](https://github.com/labsai/EDDI/blob/main/CONTRIBUTING.md) |
| Instructions for AI coding assistants | [`ui/manager/AGENTS.md`](https://github.com/labsai/EDDI/blob/main/ui/manager/AGENTS.md) |
| Bug reports and feature requests | [`labsai/EDDI` issues](https://github.com/labsai/EDDI/issues) |
| Pull requests | [`labsai/EDDI` pull requests](https://github.com/labsai/EDDI/pulls), changing files under `ui/manager/` |
| Reporting a security vulnerability | [`SECURITY.md`](https://github.com/labsai/EDDI/blob/main/SECURITY.md): privately, to **security@labs.ai**, never in a public issue |
| A running Manager | Install EDDI and open `http://localhost:7070/manage`: [EDDI quick start](https://github.com/labsai/EDDI#-quick-start) |

## What changed for developers

- **One repository, one pull request.** A change that touches both the backend API and the
  Manager is now one pull request, tested together in CI against the image built from that commit.
- **The Manager is built by Maven.** `./mvnw package` in `labsai/EDDI` runs `npm ci` and
  `npm run build` for the Manager and copies the bundle into the jar. The
  `deploy-to-local-eddi-repo` scripts in this repository are obsolete, and nothing is committed as a
  build output any more.
- **Frontend development is unchanged.** In a clone of `labsai/EDDI`, `cd ui/manager`, then
  `npm install` and `npm run dev` (port 3000, proxying the API to an EDDI on port 7070).

## The history

Every commit from this repository is in `labsai/EDDI` under `ui/manager/`, with its original author,
date and message:

```bash
git clone https://github.com/labsai/EDDI.git
cd EDDI
git log -- ui/manager
```

`git blame` and `git log --follow` work on those files as they did here. **Commit hashes are not the
same**, though: moving the files into `ui/manager/` rewrote every commit, so a link to a commit in
this repository does not resolve in `labsai/EDDI`. Search that history by message instead:
`git log --grep="<words from the message>" -- ui/manager`.

## Moving an unmerged branch across

Pull requests still open here were not carried over. To bring a branch into `labsai/EDDI`, export
its commits as patches and apply them under the new path:

```bash
# In your clone of this repository, on the branch
git format-patch main --output-directory ../manager-patches

# In a clone of labsai/EDDI, on a new branch from main
git switch -c my-branch origin/main
git am --directory=ui/manager ../manager-patches/*.patch
```

`--directory=ui/manager` is what places the changes under the new path. If a patch no longer applies
because the code has moved on, `git am --3way` usually resolves it.

## License

[Apache 2.0](LICENSE)
