# Repository workflow

- For requested implementation changes, once the work is complete and verified, commit and push the current branch without waiting for separate confirmation.
- Stage and commit only files that belong to the current task. Preserve unrelated dirty or untracked work.
- A push to the repository is expected to trigger the automatic Cloudflare production deployment. After pushing, check the deployment run and verify the production result when possible.
- Do not run an additional manual production deployment when the push-triggered deployment is working, unless the user explicitly asks for it or automatic deployment is blocked.
