# FAQ

### 1. Can I use the VIS.js library in new projects?
No. The original library has been archived and is no longer maintained. It is recommended not to use it in new components.
---

### 2. Do I need to have the EMR Framework running?
Yes. VIS has been adapted to run *within* the Framework. Running `npm run` directly in the VIS project does not work.
---

### 3. How do I update the VIS version in the Framework?
1. Run `npm run watch`
2. Copy the contents of `dist/`
3. Replace the files in the Framework in: `C:\HTML5\emr-tasy-framework\packages\framework\node_modules\vis\dist`, for example.

### 4. How do I make a correct PR?
- Always use the `version-flowsheet-v3.0.0.0` branch
- Include changed files in `dist/`
- Follow the recommended commit pattern: [Git - Commit Patterns](https://share.philips.com/sites/ArchitectureInnovation/SitePages/Git---Commit-Patterns.aspx)
---

### 5. What are the current technical risks?

- Use of Node 8.15.1 (deprecated)
- Project without automated tests
- Original library discontinued