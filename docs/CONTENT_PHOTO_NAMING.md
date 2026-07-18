# Content Photo Naming

Owner-supplied photos enter `content-intake/photos/`. Nothing in that folder is public automatically. Approved photos move to `assets/images/` only during a later controlled milestone; never delete, overwrite, or edit the original high-resolution source.

## Approved pattern

Use:

```text
{intake-key}-{sequence}.{extension}
```

Examples:

```text
blue-stone-bracelet-01.jpg
blue-stone-bracelet-02.jpg
vintage-serving-tray-01.webp
```

Allowed final public extensions are `.jpg`, `.jpeg`, `.png`, and `.webp`.

## Rules

- Use lowercase ASCII letters, numbers, and hyphens only.
- Do not use spaces, parentheses, underscores, or path segments.
- Use a unique filename for every photo.
- Use a two-digit sequence: `01`, `02`, and so on.
- Give the primary photo sequence `01`.
- Match the filename's intake key to the Find's `intake_key` exactly.
- Preserve the original high-resolution source elsewhere; intake and later processing must not overwrite it.
- HEIC is not accepted as a final public format. It requires later conversion to JPG or WebP.
- Do not perform bulk conversion during M07A.
