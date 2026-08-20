# Update CLAUDE Files with Relevant Knowledge from This Session

FYI: You manage persistent memory using two main file types: `AGENTS.md` for shared or global project context,
and `CLAUDE.local.md` for private, developer-specific notes. The system recursively searches upward from the current
working directory to load all relevant `AGENTS.md` and `CLAUDE.local.md` files, ensuring both project-level and personal
context are available. Subdirectory `AGENTS.md` files are only loaded when working within those subfolders,
keeping the active context focused and efficient.


**Summary of Memory File Behavior:**
- **Shared Project Memory (`AGENTS.md`):**
  - Located in the repository root or any working directory
  - Checked into version control for team-wide context sharing
  - Loaded recursively from the current directory up to the root
- **Local, Non-Shared Memory (`CLAUDE.local.md`):**
  - Placed alongside or above working files, excluded from version control
  - Stores private, developer-specific notes and settings
  - Loaded recursively like `AGENTS.md`
- **On-Demand Subdirectory Loading:**
  - `AGENTS.md` files in child folders are loaded only when editing files in those subfolders
  - Prevents unnecessary context bloat

---

**Instructions:**  
If during your session:

* You learned something new about the project
* I corrected you on a specific implementation detail
* I corrected source code you generated
* You struggled to find specific information and had to infer details about the project
* You lost track of the project structure and had to look up information in the source code

...that is relevant, was not known initially, and should be persisted, add it to the appropriate `AGENTS.md` (for shared context) or
`CLAUDE.local.md` (for private notes) file. If the information is relevant for a subdirectory only,
place or update it in the `AGENTS.md` file within that subdirectory.

When specific information belongs to a particular subcomponent, ensure you place it in the CLAUDE file for that component.
For example:
* Information A belongs exclusively to writing html code with knockout bindings → put it in `templates/AGENTS.md`
* Information B belongs exclusively to programming in typescript → put it in `src/AGENTS.md`
* Information C belongs exclusively to testing -> put it in `tests/AGENTS.md`. If you wrote a new test, add new GUIDs to the list of frequently used GUIDs.

If you added a new command that developpers need to run / test / debug the application → update `README.md`

If you create a new `AGENTS.md`, create a `CLAUDE.md` and a `GEMINI.md` file in the same folder with the following content:
```
@AGENTS.md
```

This ensures important knowledge is retained and available in future sessions. 
**Important**: Keept the information concise and compact. Provide a short, result-oriented **summary** of the final architecture and encountered pitfalls. Document the state as-is, do not use "new" or "updated".